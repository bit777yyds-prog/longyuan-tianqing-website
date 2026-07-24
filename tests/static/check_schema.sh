#!/usr/bin/env bash
# ============================================================
# 静态 Schema 检查（无需数据库）—— 审计者维护
# 扫描【整个 db/ 树】(db/init/*.sql, db/init/*.sh, db/migrations/*.sql)，
# 判定不依赖运行时即可确认的判据。Phase 1A 后更新：实现可能落在迁移或 .sh 中。
# 退出码非零表示有 FAIL。
# ============================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCHEMA="$ROOT/db/init/001_agent_native_schema.sql"
DB_SQL="$ROOT/db/init/*.sql $ROOT/db/migrations/*.sql"   # 所有 SQL
DB_ALL="$ROOT/db/init/* $ROOT/db/migrations/*"           # 含 .sh
COMPOSE="$ROOT/docker-compose.yml"
fail=0
pass() { echo "PASS  $1"; }
bad()  { echo "FAIL  $1"; fail=1; }
warn() { echo "WARN  $1"; }

# grep across a set of globs, ignore missing files
gall() { grep -RhiE "$1" $DB_ALL 2>/dev/null; }
gsql() { grep -RhiE "$1" $DB_SQL 2>/dev/null; }

[ -f "$SCHEMA" ] || { echo "FAIL: 找不到 $SCHEMA"; exit 2; }

echo "== 事件不可变 =="
# 26.1c：BEFORE TRUNCATE 守卫（现应实现在迁移中）
if gsql 'BEFORE[[:space:]]+TRUNCATE[[:space:]]+ON[[:space:]]+event_ledger' >/dev/null; then
    pass "26.1c event_ledger 存在 BEFORE TRUNCATE 守卫"
else
    bad  "26.1c event_ledger 无 BEFORE TRUNCATE 守卫；总账可被清空"
fi

echo "== 权限真防线 =="
# 四.4：真实角色与授权（可能在 .sh 中）
if gall 'CREATE[[:space:]]+ROLE' >/dev/null && gall '^[[:space:]]*GRANT' >/dev/null; then
    pass "四.4 db/ 含 CREATE ROLE 与 GRANT"
    # 五个冻结角色齐全
    miss=""
    for role in app_rw worker_candidate_rw scheduler_jobs_rw approval_event_writer app_readonly; do
        gall "CREATE[[:space:]]+ROLE[[:space:]]+$role\b" >/dev/null || miss="$miss $role"
    done
    [ -z "$miss" ] && pass "四.4b 五个冻结角色均创建" || bad "四.4b 缺角色:$miss"
    # 无高权限属性授予
    if gall 'CREATE[[:space:]]+ROLE.*(SUPERUSER|CREATEDB|CREATEROLE|BYPASSRLS)' | grep -viE 'NOSUPERUSER|NOCREATEDB|NOCREATEROLE|NOBYPASSRLS' >/dev/null; then
        bad "四.4c 某角色被授予高权限属性(SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS)"
    else
        pass "四.4c 未发现高权限属性授予"
    fi
else
    bad  "四.4 db/ 无真实 CREATE ROLE/GRANT"
fi

# P1A-LEASTPRIV-2：不存在应用角色全库 SELECT
if gall 'GRANT[[:space:]]+SELECT[[:space:]]+ON[[:space:]]+ALL[[:space:]]+TABLES[[:space:]]+IN[[:space:]]+SCHEMA[[:space:]]+public' >/dev/null; then
    bad "P1A-LEASTPRIV-2 存在应用角色全库/全Schema SELECT（ON ALL TABLES IN SCHEMA public）"
else
    pass "P1A-LEASTPRIV-2 未发现应用角色全库 SELECT"
fi

# P1A-LEASTPRIV-3：approval_event_writer 不得使用 ALL TABLES IN SCHEMA public 授权
if gall 'GRANT[[:space:]]+.*ON[[:space:]]+ALL[[:space:]]+TABLES[[:space:]]+IN[[:space:]]+SCHEMA[[:space:]]+public.*approval_event_writer' >/dev/null; then
    bad "P1A-LEASTPRIV-3 approval_event_writer 仍通过 ALL TABLES IN SCHEMA public 获得权限"
else
    pass "P1A-LEASTPRIV-3 approval_event_writer 未使用全Schema授权"
fi

# P1A-LEASTPRIV-4：无 ALTER DEFAULT PRIVILEGES 授予应用角色
if gall 'ALTER[[:space:]]+DEFAULT[[:space:]]+PRIVILEGES.*GRANT.*TO[[:space:]]*(app_rw|worker_candidate_rw|scheduler_jobs_rw|approval_event_writer|app_readonly)' >/dev/null; then
    bad "P1A-LEASTPRIV-4 存在对应用角色的 ALTER DEFAULT PRIVILEGES GRANT（新增表将自动继承）"
else
    pass "P1A-LEASTPRIV-4 未发现对应用角色授予默认权限"
fi

# P1A-LEASTPRIV-5：应用角色不拥有 public schema
if gall 'ALTER[[:space:]]+SCHEMA[[:space:]]+public[[:space:]]+OWNER[[:space:]]+TO[[:space:]]*(app_rw|worker_candidate_rw|scheduler_jobs_rw|approval_event_writer|app_readonly)' >/dev/null; then
    bad "P1A-LEASTPRIV-5 应用角色被设为 public schema 所有者"
else
    pass "P1A-LEASTPRIV-5 未发现应用角色拥有 public schema"
fi

# P1A-LEASTPRIV-6：应用角色不拥有 event_ledger
if gall 'ALTER[[:space:]]+TABLE[[:space:]]+event_ledger[[:space:]]+OWNER[[:space:]]+TO[[:space:]]*(app_rw|worker_candidate_rw|scheduler_jobs_rw|approval_event_writer|app_readonly)' >/dev/null; then
    bad "P1A-LEASTPRIV-6 应用角色被设为 event_ledger 所有者"
else
    pass "P1A-LEASTPRIV-6 未发现应用角色拥有 event_ledger"
fi

# P1A-LEASTPRIV-7：所有应用角色无 TRUNCATE event_ledger
if gall 'GRANT[[:space:]]+.*TRUNCATE.*ON[[:space:]]+TABLE[[:space:]]+event_ledger' >/dev/null; then
    bad "P1A-LEASTPRIV-7 仍有角色被显式授予 event_ledger 的 TRUNCATE 权限"
else
    pass "P1A-LEASTPRIV-7 未发现显式 TRUNCATE event_ledger 授权"
fi

# P1A-LEASTPRIV-8：只有 approval_event_writer 可 INSERT event_ledger
insert_roles=$(gall 'GRANT[[:space:]]+INSERT[[:space:]]+ON[[:space:]]+TABLE[[:space:]]+event_ledger[[:space:]]+TO[[:space:]]+([^;]+)' | sed -n 's/.*TO[[:space:]]*\([^;]*\).*/\1/p' | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort -u | tr '\n' ' ')
if [ "$insert_roles" = "approval_event_writer " ] || [ "$insert_roles" = "approval_event_writer" ]; then
    pass "P1A-LEASTPRIV-8 仅 approval_event_writer 可 INSERT event_ledger"
else
    bad "P1A-LEASTPRIV-8 event_ledger INSERT 授权角色为: [$insert_roles]（应为 approval_event_writer）"
fi

# P1A-LEASTPRIV-9：Worker 不能审批 candidate（无 UPDATE on candidate_events）
if gall 'GRANT[[:space:]]+UPDATE[[:space:]]+.*ON[[:space:]]+TABLE[[:space:]]+candidate_events[[:space:]]+.*worker_candidate_rw' >/dev/null; then
    bad "P1A-LEASTPRIV-9 worker_candidate_rw 仍被授予 candidate_events UPDATE 权限（可审批）"
else
    pass "P1A-LEASTPRIV-9 worker_candidate_rw 无 candidate_events UPDATE 权限"
fi

# P1A-LEASTPRIV-10：app_rw 不得写 candidate_events / agent_runs / approvals / reviews / state_projections / event_ledger
for tbl in candidate_events agent_runs approvals reviews state_projections event_ledger; do
    if gall "GRANT[[:space:]]+(INSERT|UPDATE|DELETE|TRUNCATE).*ON[[:space:]]+TABLE[[:space:]]+$tbl.*app_rw" >/dev/null; then
        bad "P1A-LEASTPRIV-10 app_rw 仍被授予 $tbl 写权限"
    fi
done
pass "P1A-LEASTPRIV-10 app_rw 无 candidate_events/agent_runs/approvals/reviews/state_projections/event_ledger 写权限"

echo "== 唯一事实源 / reviews =="
# 四.2：reviews 应删除，或改为绑定 event_ledger 的投影（有 source_event_id FK / 只读守卫）
if gsql 'CREATE[[:space:]]+TABLE[[:space:]]+reviews' >/dev/null; then
    if gsql 'reviews_source_event_id_fk|source_event_id[[:space:]]+UUID' >/dev/null \
       && gsql 'REFERENCES[[:space:]]+event_ledger' >/dev/null; then
        pass "四.2 reviews 已绑定 event_ledger（source_event_id 外键存在，读模型改造）"
        gsql 'reviews_readonly_guard' >/dev/null && pass "四.2b reviews 只读守卫触发器在位" \
            || warn "四.2b 未见 reviews 只读守卫触发器（仅靠权限矩阵约束写入）"
    else
        bad "四.2 reviews 表仍在但未绑定为 event_ledger 投影（第二条验收写入路径）"
    fi
else
    pass "四.2 reviews 表已移除"
fi

echo "== 版本不可热改 =="
gsql 'candidate_external_never_auto_approve' >/dev/null && pass "四.8a candidate 外部内容禁自动批准 CHECK" || bad "四.8a 缺 candidate 外部内容 CHECK"
gsql 'external_trigger_never_auto_approve'   >/dev/null && pass "四.8b 触发规则外部内容禁自动批准 CHECK" || bad "四.8b 缺触发规则外部内容 CHECK"
gsql 'reject_shadow_candidate'  >/dev/null && pass "四.9a 影子候选拒绝触发器" || bad "四.9a 缺影子候选拒绝触发器"
gsql 'reject_replay_candidate'  >/dev/null && pass "四.9c 重放候选拒绝触发器" || bad "四.9c 缺重放候选拒绝触发器"
gsql 'prompt_versions_no_mutation'      >/dev/null && pass "P1-4 prompt 不可热改触发器" || bad "P1-4 缺 prompt 不可热改触发器"
gsql 'protect_agent_version_semantics'  >/dev/null && pass "P1-4 agent 版本语义保护触发器" || bad "P1-4 缺 agent 版本保护触发器"
gsql 'protect_model_config_semantics'   >/dev/null && pass "P1-4 model_config 语义保护触发器" || bad "P1-4 缺 model_config 语义保护触发器"

# P1A-MODELCONFIG-1：model_configs 语义字段不可原地更新，运营字段仍可受控更新
if gsql 'protect_model_config_semantics' >/dev/null; then
    if gsql 'verification_status|verified_at|last_healthcheck_at|last_error_at|disabled_at' >/dev/null; then
        pass "P1A-MODELCONFIG-1 model_configs 运营字段已添加，语义保护触发器在位"
    else
        warn "P1A-MODELCONFIG-1 未见 model_configs 运营字段列"
    fi
fi

echo "== 事件类型注册表 =="
gsql 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?event_types' >/dev/null \
  && gsql 'event_ledger_event_type_fk|REFERENCES[[:space:]]+event_types' >/dev/null \
  && pass "S10 event_types 注册表 + event_ledger 外键" || bad "S10 缺 event_types 注册表或外键"

echo "== 越界对象检查 =="
# P1A-SCOPE-1：public_contents 不得在本轮 Phase 1A 迁移中新增
if gsql 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?public_contents' >/dev/null; then
    bad "P1A-SCOPE-1 public_contents 表仍在 Phase 1A 迁移中，属于越界提前实现"
else
    pass "P1A-SCOPE-1 Phase 1A 迁移未新增 public_contents 表"
fi

echo "== 部署接线（green-CI/broken-deploy 检查）=="
# 003 迁移入口依赖 db/migrations；若 docker-compose 只挂载 db/init 而不挂载 db/migrations，
# 则 compose 部署下迁移会静默跳过（CI/harness 会另行 rig 路径而掩盖）。
if [ -f "$ROOT/db/init/003_apply_migrations.sh" ]; then
    if grep -qE 'db/migrations' "$COMPOSE" 2>/dev/null; then
        pass "接线 docker-compose 挂载了 db/migrations"
    else
        bad "接线 003_apply_migrations.sh 依赖 db/migrations，但 docker-compose 未挂载它 → compose 部署将静默跳过全部 Phase 1A 迁移（含 TRUNCATE 守卫）。建议：挂载 ./db/migrations，或把迁移改名为 db/init/004_*.sql 由 entrypoint 直接执行"
    fi
fi

echo "------------------------------------------------------------"
[ "$fail" -eq 0 ] && echo "STATIC CHECK: 全部通过" || echo "STATIC CHECK: 存在 FAIL（见上）"
exit "$fail"
