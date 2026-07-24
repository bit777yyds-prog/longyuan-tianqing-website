#!/usr/bin/env bash
# ============================================================
# 验收测试运行器（审计者维护）
# 起一次性 postgres:16 容器 → 加载被测 Schema + 测试角色 + 种子 → 逐个跑 acceptance/*.sql
# 遵守指令六：独立一次性库、事务回滚、不连生产、不落真实密钥、不删数据。
# 需要：docker（或改 PSQL/容器变量指向任一 PostgreSQL 16 测试库）。
# 用法：bash tests/harness/run_all.sh
# ============================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CTR="longyuan-acc-test-$$"
PGPW="acc-test-only"
DB="longyuan_test"
IMG="postgres:16-alpine"

cleanup() { docker rm -f "$CTR" >/dev/null 2>&1 || true; }
trap cleanup EXIT

command -v docker >/dev/null || { echo "需要 docker（审计机若无，请在 CI 运行）"; exit 3; }

echo ">> 启动一次性 Postgres 容器 $CTR"
docker run -d --name "$CTR" -e POSTGRES_PASSWORD="$PGPW" -e POSTGRES_DB="$DB" "$IMG" >/dev/null
for i in $(seq 1 30); do
    docker exec "$CTR" pg_isready -U postgres -d "$DB" >/dev/null 2>&1 && break
    sleep 1
done

PSQL="docker exec -i $CTR psql -v ON_ERROR_STOP=1 -U postgres -d $DB"

echo ">> 加载被测 Schema（只读来源，不修改）"
$PSQL < "$ROOT/db/init/001_agent_native_schema.sql" >/dev/null

echo ">> 复制 Phase 1A 初始化与迁移脚本到容器"
docker cp "$ROOT/db/init/002_init_roles.sh" "$CTR:/tmp/002_init_roles.sh" >/dev/null
# 003 固定读取 /db/migrations（与 docker-compose 挂载点一致）；harness 亦镜像该真实路径，
# 不再用 MIGRATIONS_DIR 覆盖，以免掩盖部署路径问题（见 TEST_REPORT P1A-DEPLOY-1）。
docker exec "$CTR" mkdir -p /db >/dev/null
docker cp "$ROOT/db/migrations" "$CTR:/db/migrations" >/dev/null
docker cp "$ROOT/db/init/003_apply_migrations.sh" "$CTR:/tmp/003_apply_migrations.sh" >/dev/null

echo ">> 应用 Phase 1A 角色初始化脚本"
# 为 002_init_roles.sh 提供最小 DATABASE_URL，密码仅用于测试容器
docker exec -i "$CTR" bash -c '
  export WEB_DATABASE_URL="postgresql://app_rw:test-app-rw@localhost:5432/'"$DB"'"
  export WORKER_DATABASE_URL="postgresql://worker_candidate_rw:test-worker@localhost:5432/'"$DB"'"
  export SCHEDULER_DATABASE_URL="postgresql://scheduler_jobs_rw:test-scheduler@localhost:5432/'"$DB"'"
  export APPROVAL_EVENT_WRITER_DATABASE_URL="postgresql://approval_event_writer:test-writer@localhost:5432/'"$DB"'"
  export READONLY_DATABASE_URL="postgresql://app_readonly:test-readonly@localhost:5432/'"$DB"'"
  bash /tmp/002_init_roles.sh
' >/dev/null

echo ">> 应用 Phase 1A 治理硬化迁移（固定 /db/migrations，与 compose 一致）"
docker exec -i "$CTR" bash /tmp/003_apply_migrations.sh >/dev/null

echo ">> 加载测试角色 fixture"
$PSQL < "$ROOT/tests/fixtures/000_test_roles.sql" >/dev/null

fails=0
run_file() {
    local f="$1"; local single="${2:-yes}"
    echo "------------------------------------------------------------"
    echo ">> RUN $(basename "$f")"
    # 每个文件前重新灌种子（前一文件已回滚，库为空业务数据）
    $PSQL < "$ROOT/tests/fixtures/010_seed.sql" >/dev/null 2>&1
    local flag=""; [ "$single" = "yes" ] && flag="--single-transaction"
    if docker exec -i "$CTR" psql -v ON_ERROR_STOP=1 $flag -U postgres -d "$DB" < "$f"; then
        echo "   => 组内断言全部 PASS"
    else
        echo "   => 组内存在 FAIL"; fails=$((fails+1))
    fi
    # 清理业务数据，保证下一文件干净（事件表用更正而非删除？测试库允许 TRUNCATE 重置）
    # event_ledger 受 BEFORE TRUNCATE 触发器保护，且测试在 --single-transaction 中已回滚，无需清理
    docker exec -i "$CTR" psql -q -U postgres -d "$DB" \
      -c "TRUNCATE approvals, candidate_events, agent_runs, agent_jobs, state_projections,
                   agent_trigger_rules, deliverables, tasks, agent_versions,
                   agent_definitions, prompt_versions, model_configs, projects, actors CASCADE;" >/dev/null 2>&1
}

for f in "$ROOT"/tests/acceptance/*.sql; do
    run_file "$f" yes
done

echo "============================================================"
if [ "$fails" -eq 0 ]; then
    echo "验收运行器：全部测试文件 PASS"; exit 0
else
    echo "验收运行器：$fails 个测试文件存在 FAIL"; exit 1
fi
