#!/usr/bin/env bash
# ============================================================
# 龙渊天青 Phase 1A — 迁移应用入口
# 由 PostgreSQL 官方镜像在首次启动时于 /docker-entrypoint-initdb.d 执行。
# 作用：按顺序执行 /db/migrations/ 下的手写 SQL 迁移。
# 说明：db/init/001_agent_native_schema.sql 由官方 entrypoint 先执行；
#       002_init_roles.sh 随后创建角色；本脚本最后应用治理硬化迁移。
#
# 路径约定：Compose 将宿主 ./db/migrations 挂载为容器 /db/migrations。
# 本脚本只从该固定容器路径读取，禁止通过 MIGRATIONS_DIR 等环境变量绕开真实挂载。
# ============================================================
set -euo pipefail

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-${PGUSER}}"
MIGRATIONS_DIR="/db/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "ERROR: 迁移目录不存在: $MIGRATIONS_DIR（请检查 docker-compose.yml 是否挂载 ./db/migrations:/db/migrations）"
    exit 1
fi

shopt -s nullglob
sql_files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [ ${#sql_files[@]} -eq 0 ]; then
    echo "ERROR: 迁移目录为空: $MIGRATIONS_DIR"
    exit 1
fi

# 创建迁移追踪表（幂等），用于新旧数据库场景去重
psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$PGDB" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

for f in "${sql_files[@]}"; do
    fname=$(basename "$f")
    # 对文件名中的单引号做 SQL 转义
    sql_fname=${fname//\'/''}

    already_applied=$(psql -tA -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$PGDB" \
        -c "SELECT 1 FROM schema_migrations WHERE filename = '${sql_fname}';")

    if [ "$already_applied" = "1" ]; then
        echo "INFO: 跳过已应用迁移 ${fname}"
        continue
    fi

    echo "INFO: 应用迁移 ${fname}"
    psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$PGDB" < "$f"

    psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$PGDB" \
        -c "INSERT INTO schema_migrations (filename) VALUES ('${sql_fname}');"
    echo "INFO: 迁移 ${fname} 应用完成并已记录"
done

echo "INFO: 数据库迁移应用完成"
