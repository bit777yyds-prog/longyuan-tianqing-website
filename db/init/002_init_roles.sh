#!/usr/bin/env bash
# ============================================================
# 龙渊天青 Phase 1A — 数据库角色与最小权限初始化
# 由 PostgreSQL 官方镜像在首次启动时于 /docker-entrypoint-initdb.d 执行。
# 安全：本脚本不硬编码任何生产密码；密码从 DATABASE_URL 环境变量解析。
#       若某 URL 未提供，对应角色使用随机密码并在日志中警告。
# ============================================================
set -euo pipefail

# 从 URL 的 user:password@host 段提取密码（支持 URL 编码的特殊字符）
extract_password() {
    local url="$1"
    local userpass
    userpass=$(echo "$url" | sed -n 's|^[^:]*://\([^@#]*\)@.*$|\1|p')
    [ -z "$userpass" ] && return 0
    echo "$userpass" | sed -n 's|^[^:]*:\(.*\)$|\1|p'
}

# URL 解码：将 %XX 转回原始字节（支持密码中的 @、:、#、% 等）
url_decode() {
    local s="$1"
    local out=""
    while [[ "$s" =~ ^([^%]*)%(..)(.*)$ ]]; do
        out="${out}${BASH_REMATCH[1]}$(printf "\\x${BASH_REMATCH[2]}")"
        s="${BASH_REMATCH[3]}"
    done
    printf '%s%s' "$out" "$s"
}

# 对 SQL 字符串常量中的单引号做转义（password 中若含单引号需双写）
sql_escape() {
    echo "$1" | sed "s/'/''/g"
}

random_password() {
    if openssl rand -base64 32 2>/dev/null; then
        return 0
    fi
    # head 会提前关闭管道，在 pipefail 下导致上游收到 SIGPIPE；
    # 临时关闭 pipefail，仅读取已输出的 32 个字符。
    set +o pipefail
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32
    set -o pipefail
}

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-${PGUSER}}"

APP_RW_PASSWORD=$(extract_password "${WEB_DATABASE_URL:-}")
WORKER_PASSWORD=$(extract_password "${WORKER_DATABASE_URL:-}")
SCHEDULER_PASSWORD=$(extract_password "${SCHEDULER_DATABASE_URL:-}")
# approval_event_writer 优先使用独立 URL，否则与 scheduler_jobs_rw 同密码（Phase 1B 可拆分）
APPROVAL_PASSWORD=$(extract_password "${APPROVAL_EVENT_WRITER_DATABASE_URL:-${SCHEDULER_DATABASE_URL:-}}")
# readonly 可独立配置，否则随机（主要用于分析查询，不阻塞应用启动）
READONLY_PASSWORD=$(extract_password "${READONLY_DATABASE_URL:-}")

[ -z "$APP_RW_PASSWORD" ] && { APP_RW_PASSWORD=$(random_password); echo "WARN: WEB_DATABASE_URL 未提供，app_rw 使用随机密码"; }
[ -z "$WORKER_PASSWORD" ] && { WORKER_PASSWORD=$(random_password); echo "WARN: WORKER_DATABASE_URL 未提供，worker_candidate_rw 使用随机密码"; }
[ -z "$SCHEDULER_PASSWORD" ] && { SCHEDULER_PASSWORD=$(random_password); echo "WARN: SCHEDULER_DATABASE_URL 未提供，scheduler_jobs_rw 使用随机密码"; }
[ -z "$APPROVAL_PASSWORD" ] && { APPROVAL_PASSWORD=$(random_password); echo "WARN: APPROVAL_EVENT_WRITER_DATABASE_URL 未提供，approval_event_writer 使用随机密码"; }
[ -z "$READONLY_PASSWORD" ] && { READONLY_PASSWORD=$(random_password); echo "WARN: READONLY_DATABASE_URL 未提供，app_readonly 使用随机密码"; }

APP_RW_PASSWORD=$(sql_escape "$(url_decode "$APP_RW_PASSWORD")")
WORKER_PASSWORD=$(sql_escape "$(url_decode "$WORKER_PASSWORD")")
SCHEDULER_PASSWORD=$(sql_escape "$(url_decode "$SCHEDULER_PASSWORD")")
APPROVAL_PASSWORD=$(sql_escape "$(url_decode "$APPROVAL_PASSWORD")")
READONLY_PASSWORD=$(sql_escape "$(url_decode "$READONLY_PASSWORD")")

psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$PGDB" <<SQL
-- ============================================================
-- 1. 创建应用角色（幂等）
-- ============================================================
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
        CREATE ROLE app_rw LOGIN PASSWORD '${APP_RW_PASSWORD}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_candidate_rw') THEN
        CREATE ROLE worker_candidate_rw LOGIN PASSWORD '${WORKER_PASSWORD}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scheduler_jobs_rw') THEN
        CREATE ROLE scheduler_jobs_rw LOGIN PASSWORD '${SCHEDULER_PASSWORD}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'approval_event_writer') THEN
        CREATE ROLE approval_event_writer LOGIN PASSWORD '${APPROVAL_PASSWORD}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
        CREATE ROLE app_readonly LOGIN PASSWORD '${READONLY_PASSWORD}';
    END IF;
END
\$\$;

-- ============================================================
-- 2. 强制最小角色属性（禁止高权限）
-- ============================================================
DO \$\$
DECLARE r record;
BEGIN
    FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN (
        'app_rw','worker_candidate_rw','scheduler_jobs_rw','approval_event_writer','app_readonly'
    ) LOOP
        EXECUTE format(
            'ALTER ROLE %I NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS LOGIN',
            r.rolname
        );
    END LOOP;
END
\$\$;

-- ============================================================
-- 3. public schema 默认权限最小化
-- ============================================================
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;

-- ============================================================
-- 4. 表级权限：先全部撤销，再按需显式授予
--    注意：本脚本在 001_agent_native_schema.sql 之后运行，因此 001
--    中已创建的表均存在。新增表（如 event_types）在其创建迁移中
--    单独授权，默认不继承任何应用角色权限。
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public
    FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;
REVOKE ALL ON TABLE event_ledger
    FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;
REVOKE TRUNCATE ON TABLE event_ledger
    FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;

-- ---------- app_rw：Web 应用主写入角色 ----------
-- 可读写核心业务表（不含事件总账、候选、运行、审批、投影、reviews）
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    actors, projects, works, work_objects, tasks, task_assignments,
    deliverables, schedules, audit_logs, agent_definitions,
    configuration_lifecycle_events
    TO app_rw;
GRANT SELECT, INSERT ON TABLE egress_access_logs, operational_event_outbox TO app_rw;
-- 只读引用：事件总账、候选、运行、审批、投影、配置版本
GRANT SELECT ON TABLE
    event_ledger, candidate_events, agent_runs, agent_jobs,
    state_projections, approvals, reviews, prompt_versions,
    agent_versions, model_configs, agent_trigger_rules
    TO app_rw;

-- ---------- worker_candidate_rw：Worker 领取并执行 Job ----------
-- 只能读取执行 Job 与产生候选所必需的表
GRANT SELECT ON TABLE
    agent_jobs, agent_versions, prompt_versions, model_configs,
    agent_definitions, agent_runs, event_ledger, tasks, works,
    work_objects, deliverables, actors
    TO worker_candidate_rw;
-- 领取/更新 Job 仅限必要字段
GRANT UPDATE (locked_at, locked_by, status, retry_count, last_error, completed_at)
    ON TABLE agent_jobs TO worker_candidate_rw;
-- 可写运行记录、pending 候选、出站日志、运营事件出账
GRANT INSERT ON TABLE
    agent_runs, candidate_events, egress_access_logs, operational_event_outbox
    TO worker_candidate_rw;
-- 明确再次撤销高敏感写权限（防御性）
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE event_ledger FROM worker_candidate_rw;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE state_projections, approvals, reviews FROM worker_candidate_rw;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE candidate_events FROM worker_candidate_rw;

-- ---------- scheduler_jobs_rw：调度与重试 ----------
GRANT SELECT ON TABLE
    agent_jobs, agent_versions, schedules, agent_trigger_rules,
    tasks, works, projects, work_objects, deliverables, actors,
    event_ledger, model_configs, prompt_versions, agent_definitions,
    agent_runs, operational_event_outbox
    TO scheduler_jobs_rw;
-- 生成新 Job、更新调度计划与重试字段
GRANT INSERT ON TABLE agent_jobs TO scheduler_jobs_rw;
GRANT UPDATE (last_run_at, next_run_at, enabled) ON TABLE schedules TO scheduler_jobs_rw;
GRANT UPDATE (locked_at, locked_by, status, retry_count, last_error, completed_at, available_at)
    ON TABLE agent_jobs TO scheduler_jobs_rw;
-- 消费 operational_event_outbox 时需要标记 applied
GRANT INSERT, UPDATE (status, applied_event_id, applied_at) ON TABLE operational_event_outbox TO scheduler_jobs_rw;
-- 明确撤销高敏感写权限（防御性）
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE event_ledger FROM scheduler_jobs_rw;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE state_projections, approvals, reviews, candidate_events FROM scheduler_jobs_rw;

-- ---------- approval_event_writer：唯一可写正式事件，维护投影/reviews/审批 ----------
-- 只读取受信审批事务所必需的表
GRANT SELECT ON TABLE
    event_ledger, candidate_events, agent_runs, agent_jobs,
    tasks, deliverables, operational_event_outbox,
    state_projections, reviews, approvals,
    actors, projects, works, work_objects,
    agent_versions, prompt_versions, model_configs, agent_definitions,
    agent_trigger_rules, configuration_lifecycle_events
    TO approval_event_writer;
-- 正式事件写入权限
GRANT INSERT ON TABLE event_ledger TO approval_event_writer;
-- 投影维护
GRANT INSERT, UPDATE (current_state, version, last_event_id, projection, updated_at)
    ON TABLE state_projections TO approval_event_writer;
-- 候选事件状态更新（applied/rejected/superseded）
GRANT UPDATE (status, resolved_at) ON TABLE candidate_events TO approval_event_writer;
-- 审批记录、审计日志、reviews 读模型
GRANT INSERT ON TABLE approvals, audit_logs, reviews TO approval_event_writer;
GRANT UPDATE ON TABLE reviews TO approval_event_writer;
-- 运营事件出账消费
GRANT UPDATE (status, applied_event_id, applied_at) ON TABLE operational_event_outbox TO approval_event_writer;
-- 明确撤销 event_ledger 变更/清空权限（纵深防御）
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE event_ledger FROM approval_event_writer;

-- ---------- app_readonly：只读分析 ----------
-- 仅对当前已存在的业务与治理表授予 SELECT；未来表不会自动继承
GRANT SELECT ON TABLE
    actors, projects, works, work_objects, tasks, task_assignments,
    deliverables, schedules, audit_logs, agent_definitions,
    configuration_lifecycle_events, event_ledger, candidate_events,
    agent_runs, agent_jobs, state_projections, approvals, reviews,
    prompt_versions, agent_versions, model_configs, agent_trigger_rules,
    egress_access_logs, operational_event_outbox
    TO app_readonly;
-- 确保无任何写入权限
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM app_readonly;

-- ============================================================
-- 5. 禁止对应用角色使用默认权限：新增表不得自动继承权限
-- ============================================================
-- 注意：这里只撤销 PUBLIC 与角色可能拥有的默认权限，不授予任何
--       ALTER DEFAULT PRIVILEGES 给应用角色。
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM app_rw, worker_candidate_rw, scheduler_jobs_rw, approval_event_writer, app_readonly;
SQL

echo "INFO: 数据库角色与最小权限初始化完成"
