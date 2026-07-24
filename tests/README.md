# 验收测试套件（审计者维护）

> 依据：技术规格 §26（验收测试）、技术审查裁定 v0.1（P0/P1 红线）、验收测试指令 v0.1。
> 本目录由**审计者**维护，可自由增删改；不属于被测代码。

## 这些测试测什么

按验收指令的两层结构组织：

| 文件 | 覆盖判据 |
|---|---|
| `acceptance/10_event_immutability.sql` | §26.1 + 指令三.1　事件不可变（UPDATE/DELETE/**TRUNCATE** 均须失败；更正事件可插入） |
| `acceptance/20_candidate_isolation.sql` | §26.2 + 指令三.2　候选隔离（未批准候选不改投影；同连接部分） |
| `acceptance/30_idempotency.sql` | §26.3 + 指令三.3　幂等（同一 `idempotency_key` 唯一） |
| `acceptance/40_full_loop.sql` | §26.4 + 指令三.4　完整闭环（**唯一判据**，回放可重建） |
| `acceptance/50_recovery.sql` | §26.5 + 指令三.5　恢复（事件数量与哈希一致、版本可追溯） |
| `acceptance/60_governance_redlines.sql` | 指令四.1/2/3/8/9（DB 可强制部分）：A 级默认、唯一事实源、触发规则、注入防线、影子/重放 |
| `acceptance/70_permissions.sql` | §26.2 + 指令四.4　权限真防线（跨角色，按角色分别连接执行） |
| `static/check_schema.sh` | 无需数据库的静态检查：TRUNCATE 触发器、CREATE ROLE/GRANT、reviews 表是否仍在 |

app 层判据（指令四.5 出站闸门 / 四.6 成本熔断 / 四.7 失败入账 / 四.10 审批事务）当前**无应用代码**，
无法以 SQL 覆盖行为，见 `TEST_REPORT.md`；相应断言在此仅留占位与预期。

## 隔离与安全（遵守指令六）

- 全部针对**一次性容器数据库**运行，绝不连接生产库。
- 同连接测试用 `psql --single-transaction` 包裹，跑完 **ROLLBACK**，不落任何数据、不删任何数据。
- 不写入真实密钥；测试角色口令为一次性占位值。

## 如何运行

需要 Docker（或任一可用的 PostgreSQL 16）。审计机当前无 Docker/Postgres，
故本套件为**已备好、待实现方在 CI 执行**。

```bash
# Linux/macOS/Git-Bash
bash tests/harness/run_all.sh
```

```powershell
# Windows PowerShell
pwsh tests/harness/run_all.ps1   # 或 powershell -File tests\harness\run_all.ps1
```

脚本会：
1. 起一个一次性 `postgres:16-alpine` 容器（独立卷，退出即删）；
2. 加载 `db/init/001_agent_native_schema.sql`（被测 Schema，只读挂载，不修改）；
3. 加载 `tests/fixtures/000_test_roles.sql`（测试角色，替代尚缺的 `db/init/002`）；
4. 加载 `tests/fixtures/010_seed.sql`（最小种子数据）；
5. 逐个执行 `acceptance/*.sql`，任一 `RAISE EXCEPTION` 即判该组 FAIL；
6. 打印 PASS/FAIL 汇总并以非零码退出（便于 CI 红灯）。

## 判据读法

每个断言块成功打印 `PASS <编号>`；失败 `RAISE EXCEPTION 'FAIL <编号>: ...'`。
`static/check_schema.sh` 对被测 `db/init` 做只读文本检查，可在无数据库时运行。
