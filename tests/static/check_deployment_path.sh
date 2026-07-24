#!/usr/bin/env bash
# ============================================================
# Phase 1A 部署路径回归检查（实现方补充）
# 验证：迁移脚本 003_apply_migrations.sh 使用的固定容器路径
#       与 docker-compose.yml 中 postgres 服务的挂载目标一致，
#       防止 CI/测试通过临时路径绕开真实 Compose 部署路径。
# ============================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="$ROOT/docker-compose.yml"
MIGRATE="$ROOT/db/init/003_apply_migrations.sh"
fail=0
pass() { echo "PASS  $1"; }
bad()  { echo "FAIL  $1"; fail=1; }

[ -f "$COMPOSE" ] || { bad "找不到 $COMPOSE"; exit "$fail"; }
[ -f "$MIGRATE" ] || { bad "找不到 $MIGRATE"; exit "$fail"; }

SCRIPT_PATH=$(grep -E '^[[:space:]]*MIGRATIONS_DIR=' "$MIGRATE" | head -1 | sed -n 's/.*="\(.*\)".*/\1/p')
[ -z "$SCRIPT_PATH" ] && SCRIPT_PATH=$(grep -E 'MIGRATIONS_DIR' "$MIGRATE" | head -1)

# 003 必须固定使用 /db/migrations
if grep -qE '^[[:space:]]*MIGRATIONS_DIR="/db/migrations"' "$MIGRATE"; then
    pass "DEPLOY-1 003_apply_migrations.sh 固定使用 /db/migrations"
else
    bad "DEPLOY-1 003_apply_migrations.sh 未固定使用 /db/migrations"
fi

# 003 不得保留 MIGRATIONS_DIR 环境变量覆盖逻辑（防止测试绕开 Compose 挂载）
if grep -qE '\$\{MIGRATIONS_DIR' "$MIGRATE"; then
    bad "DEPLOY-2 003_apply_migrations.sh 仍允许 MIGRATIONS_DIR 环境变量覆盖"
else
    pass "DEPLOY-2 003_apply_migrations.sh 禁止 MIGRATIONS_DIR 环境变量覆盖"
fi

# docker-compose.yml 必须将宿主 ./db/migrations 挂载到容器 /db/migrations
if grep -qE './db/migrations:/db/migrations:ro' "$COMPOSE"; then
    pass "DEPLOY-3 docker-compose.yml 将 ./db/migrations 挂载为 /db/migrations（只读）"
else
    bad "DEPLOY-3 docker-compose.yml 未将 ./db/migrations 挂载为 /db/migrations"
fi

# 脚本路径与 Compose 挂载目标必须一致
if grep -qE './db/migrations:/db/migrations' "$COMPOSE" && grep -qE '^[[:space:]]*MIGRATIONS_DIR="/db/migrations"' "$MIGRATE"; then
    pass "DEPLOY-4 迁移脚本默认路径与 Compose 挂载目标一致（/db/migrations）"
else
    bad "DEPLOY-4 迁移脚本默认路径与 Compose 挂载目标不一致"
fi

# 003 不得使用 [ -e "$f" ] || continue 静默跳过空目录/错误路径
if grep -qE '\[ -e "\$f" \] \|\| continue' "$MIGRATE"; then
    bad "DEPLOY-5 003_apply_migrations.sh 仍使用静默跳过逻辑"
else
    pass "DEPLOY-5 003_apply_migrations.sh 无静默跳过逻辑"
fi

# 003 必须在目录不存在时非零退出
if grep -qE 'if \[ ! -d "\$MIGRATIONS_DIR" \]; then' "$MIGRATE" && grep -qE 'exit 1' "$MIGRATE"; then
    pass "DEPLOY-6 003_apply_migrations.sh 在迁移目录缺失时非零退出"
else
    bad "DEPLOY-6 003_apply_migrations.sh 未在迁移目录缺失时非零退出"
fi

# 003 必须在目录为空时非零退出
if grep -qE 'if \[ \$\{#sql_files\[@\]\} -eq 0 \]; then' "$MIGRATE" && grep -qE 'exit 1' "$MIGRATE"; then
    pass "DEPLOY-7 003_apply_migrations.sh 在迁移目录为空时非零退出"
else
    bad "DEPLOY-7 003_apply_migrations.sh 未在迁移目录为空时非零退出"
fi

echo "------------------------------------------------------------"
[ "$fail" -eq 0 ] && echo "DEPLOYMENT PATH CHECK: 全部通过" || echo "DEPLOYMENT PATH CHECK: 存在 FAIL（见上）"
exit "$fail"
