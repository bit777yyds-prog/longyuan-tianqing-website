# 验收测试报告 TEST_REPORT

- **被测**：龙渊天青 Agent 原生网站（`C:\longyuan-website`）· Schema v0.2
- **依据**：技术规格 v0.2 §26（验收测试，§26.4 完整闭环为唯一判据）；技术审查裁定 v0.1（P0/P1 红线）；验收测试指令 v0.1
- **执行方（审计者）**：Claude Code · 日期 2026-07-24
- **角色边界**：仅写测试 / 跑测试 / 出报告；未修改任何被测代码（`db/init/`、`src/`）与 `docs/` 规格治理文件。

---

## 0. 执行前提与两点更正

1. **编号更正**：验收指令把五组基础判据记为"技术规格 §20"、唯一判据记为"§22"。核对仓库内 `docs/architecture/龙渊天青_Agent原生网站技术规格_v0.2.md`：**§20=认证与授权、§22=可观测性**；验收测试实际在 **§26**，**完整闭环唯一判据在 §26.4**。本报告以仓库实际 §26 为准，指令原意不变。
2. **上位文件缺位**：指令与文档多处引用《治理体系总纲》/宪法（含第十二条、第五章 A 级定义现行版本），但该本体**不在仓库**（仅 GEO 分册四在 `docs/governance/`）。凡需与总纲**字面版本**核对处，本报告只能对照 `网站规划_v0.2.md`（A0–A3 表），并将"与总纲现行版本一致"标注为**待人工核对**。

### 0.1 运行环境限制（重要）

审计机**无 Docker、无 PostgreSQL、无 Node、无 WSL、无可用 Python**（已逐一探测确认）。因此：

- **可在本机执行**：`tests/static/check_schema.sh`（纯文本静态检查，**已实际运行**，输出见下，构成真实证据）。
- **不可在本机执行**：一切 DB 行为测试（触发器、约束、跨角色权限）。这些用例**已编写完毕**（`tests/acceptance/*.sql` + `tests/harness/`），须由实现方在具备 PostgreSQL 16 的 CI 中运行。
- 报告中此类项目标注 **未执行（结构已就位／未落地，待运行时复跑）**，并给出静态判定与证据来源。审计者**不会**把"结构存在"当作"行为通过"。

`docker compose up` 目前也无法起：`docker-compose.yml` 引用的 `deploy/web.Dockerfile`、`deploy/worker.Dockerfile`、`deploy/Caddyfile` 与 `.env` 均不存在（`deploy/` 为空），且 `src/` 为空——本项目处于**实施计划待批准、仅 Schema+文档**阶段（见 `IMPLEMENTATION_PLAN.md` §2.3 的 S1–S11 自述）。

### 0.2 已实际执行的静态检查输出（证据）

```
FAIL  26.1c event_ledger 无 BEFORE TRUNCATE 守卫；行级 UPDATE/DELETE 触发器不拦 TRUNCATE，总账可被清空
FAIL  四.4 db/init 无真实 CREATE ROLE/GRANT（仅注释建议）；worker/app 将以 owner 连库，权限防线不存在
FAIL  四.2 reviews 表仍存在（带独立 decision 列，构成第二条验收写入路径，交作者裁定）
PASS  四.8a candidate 外部内容禁自动批准 CHECK 在位
PASS  四.8b 触发规则外部内容禁自动批准 CHECK 在位
PASS  四.9a 影子候选拒绝触发器在位
PASS  P1-4 prompt_versions 不可热改触发器在位
PASS  P1-4 agent_versions 语义不可热改触发器在位
（命令：bash tests/static/check_schema.sh；退出码 1）
```

---

## 一、五组基础验收（§26 / 指令三）

| 编号 | 判据来源 | 测试文件 · 用例 | 结果 | 证据 | 建议动作 | 归属 |
|---|---|---|---|---|---|---|
| 三.1-a | §26.1 | `10_event_immutability.sql` · 26.1a | 未执行（结构在位·预期通过） | Schema L145 `event_ledger_no_update` `BEFORE UPDATE OR DELETE` 触发器抛 `append-only` | 在 CI 复跑确认 | — |
| 三.1-b | §26.1 | 同上 · 26.1b | 未执行（结构在位·预期通过） | 同上触发器覆盖 DELETE | 在 CI 复跑确认 | — |
| **三.1-c** | 指令三.1（加严；§26.1 未列 TRUNCATE） | 同上 · 26.1c | **失败** | 静态检查已确认：无 `BEFORE TRUNCATE ... FOR EACH STATEMENT`；行级触发器不拦 TRUNCATE，`TRUNCATE event_ledger CASCADE` 可清空总账 | 新增 `CREATE TRIGGER ... BEFORE TRUNCATE ON event_ledger FOR EACH STATEMENT EXECUTE FUNCTION prevent_event_mutation()`（并对 `prompt_versions` 同处理） | 交实现方 |
| 三.1-d | §26.1 | 同上 · 26.1d | 未执行（结构在位·预期通过） | 触发器不拦 INSERT，更正事件可追加 | 在 CI 复跑确认 | — |
| 三.2-a | §26.2 | `70_permissions.sql` · 四.4a | **失败**（前置未落地） | `db/init` 无 CREATE ROLE/GRANT，`.env.example` 引用的 `worker_candidate_rw` 等角色不存在：当前 worker 要么**无法连库**（IMPL S1），要么被迫用超级用户连库——两种情况下"worker 不能写 event_ledger"都**无从强制**。测试依赖 `tests/fixtures/000_test_roles.sql` 才能验证"角色到位后隔离是否真生效" | 补 `db/init/002_roles_and_grants.sql`（见四.4） | 交实现方 |
| 三.2-b | §26.2 | `20_candidate_isolation.sql` · 26.2b | 未执行（结构在位·预期通过） | `candidate_events` 表存在且可 INSERT | 在 CI 复跑确认 | — |
| 三.2-c | §26.2 | 同上 · 26.2c/26.2d | 未执行（结构在位·预期通过） | `state_projections.last_event_id` **强制外键**引用 `event_ledger`（L154），投影无法脱离正式事件落地；pending 候选不改投影 | 在 CI 复跑确认 | — |
| 三.3-a | §26.3 | `30_idempotency.sql` · 26.3a/b | 未执行（结构在位·预期通过） | `event_ledger.idempotency_key … UNIQUE`（L124）；重复键第二次插入 `unique_violation` | 在 CI 复跑确认 | — |
| 三.3-b | §26.3 | 同上 · 26.3c/d | **部分／未实现** | `agent_jobs.idempotency_key` 有 UNIQUE（Job 层防重 OK）；但 `candidate_events` **无**去重唯一键，"worker 重试不重复产生候选"依赖尚未实现的应用层去重 | Worker 落地按 `source_run_id`/`correlation_id` 去重并加约束或幂等写入 | 交实现方 |
| **三.4** | **§26.4（唯一判据）** | `40_full_loop.sql` · 26.4-behavior | **未实现（唯一判据未达成）** | `src/` 为空：无 Domain Service / Worker / 审批服务 / Outbox Consumer / 投影更新（IMPL S4/S5/S7/S9，Phase 6 才实现）。无 `deliverable.reviewed` 审批事件、无 `approvals`、无 `state_projections` 记录可回放 | 实现 Phase 4–6 后端到端跑通并回放 | 交实现方 |
| 三.5 | §26.5 | `50_recovery.sql` · 26.5a–d | **未实现／部分** | 版本链可追溯（`agent_versions→model/prompt` 外键完好，26.5c 结构预期通过）；但无备份/恢复工具（`deploy/` 空、`docker-compose` scheduler `BACKUP_ENABLED=false`），"恢复后数量与哈希一致"无从演练 | 落地 `pg_dump`/恢复脚本与演练（Phase 7/10），跑 `--recovery` 比对指纹 | 交实现方 |

---

## 二、治理红线专项（指令四，逐项独立结论）

| 编号 | 判据来源 | 测试文件 · 用例 | 结果 | 证据 | 建议动作 | 归属 |
|---|---|---|---|---|---|---|
| 四.1 | 裁定第五章/网站规划 A 表 | `60_governance_redlines.sql` · 四.1a–d | **通过（静态确认）·一处待核** | Schema L195–199：`autonomy_level DEFAULT 'A1' CHECK (A0..A3)`、`auto_approve_event_types DEFAULT '[]'`、`requires_human_review DEFAULT true`；A0–A3 与 `网站规划_v0.2` §自治级别表一致 | 取值与《治理总纲》第五章**现行版本**字面一致性待人工核对（总纲不在仓库） | 交作者核对 |
| **四.2** | 裁定一/六（唯一事实源） | `60_…` · 四.2；`static/check_schema.sh` | **失败** | `reviews` 表仍在（Schema L104–114），含独立 `decision CHECK(pass/rework/reject/manual_review)`，**无** `last_event_id` 外键把它绑为 `event_ledger` 投影；业务状态列（`tasks.status`、`work_objects.current_state`）无触发器约束"仅投影路径可写"。计划 §3.2 声明其为"读模型"，但 Schema 未强制、且无应用代码 ⇒ 结构上仍是**第二条可独立写入的验收决策路径** | ①作者裁定"读模型"设计是否满足"纯投影/无第二写入路径"；②若保留，改造为绑定正式事件的投影并加约束，或删表 | 交作者裁定＋交实现方 |
| 四.3 | 裁定 P1（规则不硬编码） | `60_…` · 四.3 | **通过（部分）** | `agent_trigger_rules` 表存在（L381）、种子实际使用、含 `policy_version`（可版本化）。但**无**该表的不可变触发器/生命周期记录，"变更留痕"仍依赖尚未实现的应用层 | 为触发规则变更增加留痕（复用 `configuration_lifecycle_events` 或审计） | 交实现方 |
| **四.4** | 裁定 P0-1／§20 | `70_permissions.sql`；`static/check_schema.sh` | **失败** | 静态检查确认 `db/init` **无** `CREATE ROLE`/`GRANT`，仅 L317–319 注释建议；`.env.example` 却已用 `app_rw`/`worker_candidate_rw`/`scheduler_jobs_rw`。角色不存在 ⇒ 或连库失败（IMPL S1），或退化为超级用户连库、越权动作**无从**失败——最小权限防线不存在 | 新增 `db/init/002_roles_and_grants.sql`（`app_rw`、`worker_candidate_rw`、`scheduler_jobs_rw`、`approval_event_writer`、`readonly_analytics` + 最小 GRANT）；随后 `70_permissions.sql` 逐账户复跑 | 交实现方 |
| 四.5 | 裁定 P0-3／§26.7 | （应用层，无 SQL 可覆盖） | **未实现** | `egress_class` 枚举与 `egress_access_logs` 表在位，但**无出站检查点**：`forbidden` 对象进入上下文时不阻止调用、不生成 `agent.egress_blocked` 正式事件（IMPL S6） | 实现 `EgressGuard`：拒绝 forbidden 出站 + 写正式异常事件 + `egress_manifest` 可回查 | 交实现方 |
| 四.6 | 裁定 P0-6／§26.11 | （应用层） | **未实现** | `max_cost_per_run`/`max_daily_cost` 列与 `operational_event_outbox` 的 `agent.cost_limit_exceeded` 类型在位，但**无熔断执行逻辑**，超限不会停止、不会生成正式事件（IMPL S6） | 实现单次/单 Agent 日/全站日三级 `CostCircuitBreaker` + 正式异常事件 | 交实现方 |
| 四.7 | 裁定 P0-6 | （应用层） | **未实现** | `operational_event_outbox` 有 `agent.run.failed`/`agent.job.dead_lettered` 等类型，但**无 Outbox Consumer** 将其转为 `event_ledger` 正式事件（IMPL S4）；失败可能永久 pending，违反"失败必须入账" | 实现 Outbox Consumer（`approval_event_writer` 账户，事务内写正式事件+更新 outbox） | 交实现方 |
| 四.8 | 裁定 P0-5／§26.6 | `60_…` · 四.8a/b | **通过（DB 防线）·应用层未实现** | DB 双 CHECK 生效：`candidate_external_never_auto_approve`（L378）、`external_trigger_never_auto_approve`（L392）——外部内容候选/触发规则**无法**配置自动批准。但"输入以数据块包裹为待检材料"仅存在于 Prompt 文本，"输出过 JSON Schema 强校验、枚举越界转人工"**无校验器**（`review_precheck_output_schema_v0.2.json` 已定义但未接入） | 实现输出 Schema+语言校验器（越界→manual_review），落实不可信数据块包裹 | 交实现方 |
| 四.9 | 裁定 P0-4/P1-2／§26.8/26.10 | `60_…` · 四.9a/b | **通过（DB 防线）·行为未实现** | 影子防线生效：`reject_shadow_candidate` 触发器（L489）阻止 shadow run 产生候选；`run_mode` 含 `replay/rerun`、`replay_source_run_id`、`replayed_from_stored_output` 字段在位。但"Replay 用存档输出、不重调模型、输出哈希一致；Rerun 记为新运行"需 Replay 服务，**无代码** | 实现 Replay/Rerun 服务并按 §26.8 复跑 | 交实现方 |
| 四.10 | 裁定（审批事务完整性） | （应用层） | **未实现** | `candidate_events`/`approvals`/`event_ledger`/`state_projections` 表齐备，但**无审批服务**执行"锁定候选→验未处理→插正式事件→更新投影→改候选状态→写审计"六步同事务与中途回滚（IMPL 计划 §Phase 6 L606 有设计，未落地） | 实现审批服务：六步单事务 + 失败全回滚 + 集成测试 | 交实现方 |

---

## 三、结论

**技术规格 §26.4 完整闭环（唯一判据）：未达成（未实现）。**

理由：被测仓库当前只有数据库 Schema 与文档，`src/` 无任何应用代码。完整闭环所需的
Domain Service、Worker 模型适配、审批服务、Outbox Consumer 与状态投影更新组件均不存在
（实施方在 `IMPLEMENTATION_PLAN.md` §2.3 S4/S5/S7/S9 亦已自述），因此
"用户提交 → 事件入账 → Job → Worker → 候选 → 人工审批 → 正式事件 → 投影更新"
的自动闭环无法跑通、无法回放。唯一判据不成立时，其余单项即便结构就位也不构成整体验收通过。

**分层小结：**

- **数据库结构护栏**做得较扎实且方向正确：事件不可变（UPDATE/DELETE）、幂等唯一键、投影强制外键于正式事件、A 级安全默认、外部内容永不自动批准（双 CHECK）、影子不产生候选、Prompt/Agent 版本不可热改——这些在**静态层面确认到位**，待 CI 运行时复跑转绿。
- **三条结构性缺陷**（静态已确认，非行为推测）：
  1. **四.1-c TRUNCATE 缺守卫** → `event_ledger` 可被整表清空（行级触发器不拦 TRUNCATE）。
  2. **四.4 权限防线缺失** → `db/init` 无 CREATE ROLE/GRANT，worker/app 以 owner 连库，越权不失败。
  3. **四.2 `reviews` 第二写入路径** → 表仍在且未绑定为正式事件投影（交作者裁定）。
- **应用层判据（四.5 出站、四.6 成本、四.7 失败入账、四.10 审批事务、三.4 闭环、三.5 恢复、四.8/四.9 行为部分）**：一律**未实现**，因无后端代码。

**移交与复验：** 上述 FAIL/未实现项交实现方（KimiCode）修复；四.1（与总纲字面一致）与四.2（读模型设计是否达标）交作者裁定。修复后由审计者在具备 PostgreSQL 16 的 CI 中运行 `tests/harness/run_all.sh` 复跑，逐项确认转绿——**本会话不进行任何修复**（遵守角色分离，宪法第十二条）。

---

# 第二轮 · Phase 1A 复验（2026-07-24）

**触发**：实现方（KimiCode）提交 Phase 1A 施工（新增 `db/init/002_init_roles.sh`、`db/init/003_apply_migrations.sh`、`db/migrations/001_phase1a_governance_hardening.sql`、CI、及其自撰测试 `80_phase1a_governance.sql`）。审计者独立复核如下。**本轮仍未修改任何被测代码**；`run_all.sh` 由用户/实现方改以加载新脚本，审计者予以保留。

**执行限制不变**：审计机仍无 Docker/PostgreSQL，DB 行为测试**未在本机执行**；复核以「更新后的静态检查（已实跑）+ 逐文件源码审读」为据。实现方新增 `.github/workflows/phase1a-ci.yml` 会在 PG16 上真实运行 acceptance 测试——**该 CI 尚未由审计者观察到运行结果**。

## A. 三项原始 FAIL 的复验

| 编号 | 原结论 | 本轮结论 | 证据（静态） | 归属 |
|---|---|---|---|---|
| 三.1-c TRUNCATE | 失败 | **已修复（静态确认）·待 CI 行为复跑** | `db/migrations/001…:19` `CREATE TRIGGER event_ledger_no_truncate BEFORE TRUNCATE … FOR EACH STATEMENT`；`:24` 对五角色 `REVOKE TRUNCATE`（纵深）。审计者独立用例 `10_event_immutability.sql·26.1c` 覆盖 | — |
| 四.4 权限防线 | 失败 | **已修复（静态确认）·待 CI 行为复跑** | `db/init/002_init_roles.sh` 创建 5 个冻结角色，全部 `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`；`REVOKE ALL` 后按矩阵最小授权；`event_ledger` 仅 `approval_event_writer` 可 INSERT。审计者独立用例 `70_permissions.sql` 覆盖 | — |
| 四.2 reviews | 失败（交作者裁定） | **符合冻结裁决（静态确认）** | 计划 §2.2 冻结「reviews 保留为读模型」；`db/migrations/001…:30-63` 加 `source_event_id`（NOT NULL + UNIQUE + FK→event_ledger）+ `reviews_readonly_guard`（仅 `approval_event_writer` 可写）。已从「独立决策路径」改造为「绑定正式事件、单写入者的投影」 | 作者已裁决保留读模型；实现符合 |

静态检查实跑输出（`bash tests/static/check_schema.sh`，本机已运行）：13 项 PASS（TRUNCATE 守卫 / 5 角色 + 无高权限 / reviews 绑定 + 只读守卫 / 外部内容双 CHECK / 影子+重放守卫 / prompt+agent+model 不可热改 / event_types 注册表+外键），**1 项 FAIL（见 B）**。

## B. 审计新增缺陷（本轮发现）

| 编号 | 判据来源 | 结果 | 证据 | 建议动作 | 归属 |
|---|---|---|---|---|---|
| **P1A-DEPLOY-1** | 部署一致性 / green-CI-broken-deploy | **失败（高·部署路径）** | `docker-compose.yml:58` 仅挂载 `./db/init:/docker-entrypoint-initdb.d`，**未挂载 `./db/migrations`**。`003_apply_migrations.sh` 在 entrypoint 下 `dirname=$/docker-entrypoint-initdb.d`→`../..`=`/`→`MIGRATIONS_DIR=/db/migrations`（容器内不存在）→ `for f in …/*.sql; [ -e "$f" ]||continue` 静默跳过，仍打印「迁移应用完成」。**结果：`docker compose up` 只建角色，但 TRUNCATE 守卫 / event_types 外键 / reviews 改造 / model_configs 保护 / replay 守卫 / public_contents 全部不落地。** CI 与 `run_all.sh` 因分别在 repo 根运行 003 或 `docker cp + MIGRATIONS_DIR` 改写路径而掩盖此问题 | 任选其一：①docker-compose 增挂 `./db/migrations`；②将迁移改名为 `db/init/004_phase1a_governance_hardening.sql` 交由 entrypoint 直接执行（并删 003 包装）；③令 003 在迁移目录缺失/为空时 **报错退出**而非静默成功 | 交实现方 |
| P1A-LEASTPRIV-1 | 最小权限 | **注意（低）** | `002_init_roles.sh:154` `ALTER DEFAULT PRIVILEGES … GRANT INSERT ON TABLES TO worker_candidate_rw` 使 worker 对**迁移后创建**的 `event_types`、`public_contents` 亦获 INSERT。worker 本不应能写事件类型注册表或公开内容投影（与「模型不得自造事件类型」精神相悖） | 迁移后对 `event_types`、`public_contents` 显式 `REVOKE INSERT FROM worker_candidate_rw`（及按需 app_rw/scheduler） | 交实现方 |
| P1A-NOTE-1 | 设计提示 | **注意（低）** | `reviews_readonly_guard` 以 `current_user='approval_event_writer'` 判定；未来审批服务若以其他角色或经 `SET ROLE` 连库，将被拒；超级用户/迁移亦无法写 reviews | Phase 6 审批服务须严格以 `approval_event_writer` 身份维护 reviews；如需迁移期回填另设豁免 | 备忘 |

## C. 分工与独立性（宪法第十二条）

实现方自撰的 `tests/acceptance/80_phase1a_governance.sql` **不作为独立验收证据**（被验收方不得自证）。审计者以自撰用例独立复核，结论一致：

- 既有 `10_event_immutability.sql`（TRUNCATE）、`60_governance_redlines.sql`（影子）、`70_permissions.sql`（跨角色权限）已独立覆盖回归项；
- 新增 `tests/acceptance/81_phase1a_audit.sql`（审计者编写）独立覆盖 80 中而 10/60/70 未含的四项：reviews 只读绑定、model_configs 语义不可热改、replay 守卫、event_types 外键。

## D. 复验结论

- **三项原始结构缺陷（TRUNCATE / 权限 / reviews）在 SQL 层面均已修复**，静态确认到位；行为层待 CI（PG16）复跑转绿，审计者尚未观测到该 CI 运行结果。
- **新增一项高severity部署缺陷 P1A-DEPLOY-1**：迁移未接入 compose 部署路径，`docker compose up` 将静默跳过全部 Phase 1A 硬化。此项使「绿色 CI」与「真实部署」不一致，须在宣告 Phase 1A 完成前修复。
- **§26.4 完整闭环唯一判据：仍未达成（未实现）**——Phase 1A 仅硬化数据库治理，未涉及 Domain Service / Worker / 审批服务 / 投影更新（属 Phase 4–6）。这符合 Phase 1A 边界，非退步；唯一判据的达成仍在后续阶段。
- 应用层判据（四.5 出站 / 四.6 成本 / 四.7 失败入账 / 四.10 审批事务 / 三.4 闭环 / 三.5 恢复）维持**未实现**，与 Phase 1A 范围一致。

**移交**：P1A-DEPLOY-1 交实现方修复后，审计者复跑 `check_schema.sh`（应转全绿）并在 PG16 CI 运行全部 `acceptance/*.sql` 复核。

---

# 第三轮 · Phase 1A 整改复验（2026-07-24）

**触发**：实现方提交针对 P1A-DEPLOY-1、最小权限泄漏、public_contents 越界的整改。审计者独立复核；**仍未修改被测代码**。本轮亦修正了两处**审计者自有资产**的缺陷（见 C）。执行限制不变：DB 行为测试未在本机运行；据「两个静态检查器实跑 + 逐文件源码审读」判定。

## A. 上轮 FAIL/注意项的复验

| 编号 | 上轮 | 本轮结论 | 证据（审计者独立确认） |
|---|---|---|---|
| **P1A-DEPLOY-1** | 失败（高） | **已修复（静态确认）** | `003_apply_migrations.sh:16` 固定 `MIGRATIONS_DIR="/db/migrations"`；`:18-21` 目录缺失 `exit 1`；`:27-30` 目录为空 `exit 1`；删除了 `[ -e ]||continue` 静默跳过；新增 `schema_migrations` 幂等追踪。`docker-compose.yml:59` 挂载 `./db/migrations:/db/migrations:ro`。审计者 `check_deployment_path.sh` 实跑 **7/7 PASS**；`check_schema.sh` 部署接线项转 PASS |
| P1A-LEASTPRIV-1 | 注意（低） | **已修复（静态确认）** | `002_init_roles.sh:218-223` 仅保留 `ALTER DEFAULT PRIVILEGES … REVOKE ALL`（无 GRANT）；改为逐表 + 列级授权（如 `agent_jobs`、`state_projections`、`candidate_events` 均列级 UPDATE）。`check_schema.sh` 新增 LEASTPRIV-2..10 实跑全 PASS：无全库 SELECT、无默认权限继承、`event_ledger` INSERT 仅 `approval_event_writer` |
| P1A-NOTE-1（reviews 守卫耦合 current_user） | 备忘 | **仍为备忘** | 未变；Phase 6 审批服务须以 `approval_event_writer` 身份维护 reviews。无需本轮处理 |

## B. 范围决定（需知会作者）

- **public_contents 已从 Phase 1A 迁移移除**（迁移文件注释 `:14`；`content.published` 事件类型一并移除）。审计者判断：这是**合理的范围收敛**（public_contents 属 IMPL S11，非 Phase 1A P0 治理红线）。`check_schema.sh` 新增 `P1A-SCOPE-1` 确认迁移未再新增该表。**备忘**：S11 `public_contents` 现**顺延至后续阶段**，勿在 GEO 上线前遗漏。
- **event_types 保留**：属治理红线（S10「模型不得自造事件类型」），审计者 `81-D` 与 `check_schema.sh S10` 均要求其存在，保留正确；迁移 `:196` 对其仅授 `SELECT`，符合最小权限。

## C. 审计者自有资产的缺陷与自修（本轮发现）

整改暴露出**审计者测试资产**两处会削弱验收有效性的问题，已由审计者自行修正（属测试代码维护范围，非被测代码）：

| 编号 | 问题 | 修正 |
|---|---|---|
| AUDIT-FIX-1（掩盖风险·中） | `tests/fixtures/000_test_roles.sql` 早期版本 `GRANT SELECT ON ALL TABLES`、`GRANT UPDATE ON agent_jobs`（全列）等，会**叠加**在真实 `002` 授权之上（harness/CI 均在 002 后加载它），使最小权限用例因「并集越权」而假通过 | 移除**全部 GRANT**，改为仅「五个冻结角色存在性」安全网；权限行为完全依赖 `002` 真实授权 |
| AUDIT-FIX-2（接线一致·中） | `run_all.sh` 旧逻辑把迁移 `docker cp` 到 `/tmp/migrations` 并 `export MIGRATIONS_DIR` 覆盖——新版 003 已固定 `/db/migrations` 且不认该变量，harness 会因此**跑不到迁移**（且掩盖真实部署路径） | 改为 `docker cp` 到 `/db/migrations`、直接运行 003，使 harness **镜像 compose 真实路径** |

> 说明：这两处是审计者上一轮为「让测试在缺角色/缺挂载环境下也能跑」而设的权宜，整改后成为掩盖源，故收紧。收紧后 harness 与 CI 走的是与生产一致的路径。

## D. 分工独立性（宪法第十二条）

- 实现方本轮**修改了审计者的 `tests/static/check_schema.sh`**（新增 LEASTPRIV-2..10、MODELCONFIG-1、SCOPE-1）并新增 `check_deployment_path.sh`、扩充自撰的 `80_*.sql`。审计者已**逐条复核**新增检查：均为**更严的对抗性**检查（检测过度授权/越界），**未削弱或删除**任何既有检查（26.1c、四.2、四.4、四.8/9、S10、部署接线均保留）。予以接受。
- 重申：实现方自撰的检查/测试**不作为独立验收依据**。本审计的独立依据是审计者自有的 `10/60/70/81_*.sql` + `check_schema.sh`（原有项）+ `check_deployment_path.sh` 的静态事实。

## E. 复验结论

- **静态层面：全绿。** `check_schema.sh`（26 项 PASS，0 FAIL）与 `check_deployment_path.sh`（7 项 PASS）均实跑通过；`bash -n` 五个脚本全过。三项原始结构缺陷 + 部署接线 + 最小权限泄漏均已在 SQL/脚本层修复并确认。
- **行为层面：仍未复跑。** 审计机无 Docker/PG，`acceptance/*.sql`（含 `80/81`）**NOT RUN**；实现方 `phase1a-ci.yml` 会在 PG16 真实运行，但**审计者尚未观测到该 CI 的运行结果**——在观测到 CI 全绿前，不签发「Phase 1A 行为验收通过」。
- **§26.4 完整闭环唯一判据：仍未达成**（Domain Service/Worker/审批服务属 Phase 4–6，本阶段不涉及）。
- **待办**：①在 PG16 上运行全部 acceptance 并回传结果；②作者知会 public_contents 顺延；③Phase 1B 起补 `deploy/*` 与应用代码。

---

# 第四轮 · CI 行为验收阻断诊断（2026-07-24）

**背景**：实现方推送后，`phase1a-ci.yml` 的 `static-check` job ✅ 通过；`postgres-acceptance` job 在 **Init roles 步骤失败（psql 退出码 2）**，其后 Apply migrations / Load fixtures / Run acceptance **全部 skipped**。实现方已加 `POSTGRES_USER/POSTGRES_DB` 但仍失败，且无权限读取 CI 原始日志。

**审计者静态诊断（无需日志，已定位根因）**：

| 事实 | 证据 |
|---|---|
| 失败步骤内部脚本调用 psql **不带 `-h` / 无 `PGHOST`** | `db/init/002_init_roles.sh:62`、`003_apply_migrations.sh:33/45/54/56` 均为 `psql … --username --dbname`，无主机参数 |
| CI 中**通过**的步骤都显式 `-h localhost` | `phase1a-ci.yml:51`(Load schema)、`:77/79`(fixtures)、`:90/93`(acceptance) |
| CI **未**在任何 env 设 `PGHOST/PGPORT` | 仅步骤内联 `-h localhost`，脚本内部 psql 无法继承 |

**根因**：GitHub Actions 的 postgres 是**仅 TCP 的 service 容器**（`localhost:5432`），runner 主机上**没有 Unix socket**。libpq 无 `-h`/`PGHOST` 时默认走本地 socket → 连接失败 → **psql 退出码 2**（正是观测值）。`002/003` 脚本本身对其**真实运行时**（compose 下由 entrypoint 在 postgres 容器内执行，socket 存在）是**正确的**；只有在「从 runner 主机连 TCP service 容器」这一 CI 场景下才暴露。

**结论：这是 CI 接线缺陷，非 Schema/角色治理缺陷。** 不改动被测脚本。

**修复（仅 CI，交实现方应用）**：在 `postgres-acceptance` job 级 env 增加两行——

```yaml
    env:
      POSTGRES_USER: postgres
      POSTGRES_DB: longyuan_ci
      PGHOST: localhost      # ← 新增：令 002/003 内部 psql 走 TCP service，而非缺失的本地 socket
      PGPORT: "5432"         # ← 新增
```

（`PGPASSWORD: ci-test` 已在各步骤存在，TCP md5 认证所需，无需再动。）此改动应使 Init roles 与 Apply migrations 连上 service，后续 acceptance 步骤方能真正执行。

**行为验收状态：仍未达成。** `acceptance/*.sql`（含审计者 `10/60/70/81`）本轮在 CI 中 **SKIPPED**，未产生任何行为证据。审计者**不签发** Phase 1A 行为验收，直至在修复后的 CI（或等价 PG16 环境）观测到全部 acceptance 真实 PASS。静态验收维持全绿不变。

---

# 第五轮 · acceptance 步骤失败静态定位（2026-07-24）

**背景**：连接问题修复后，`002/003`/fixtures 均成功，失败转移到 **Run acceptance tests 步骤（退出码 1）**；实现方仍无法读取 CI 日志、看不到具体哪个用例失败。审计者静态逐文件比对「当前硬化后 Schema + 002 真实角色 + 010 种子 + CI 循环」，无需日志即定位到全部原因。

## 失败根因（三项，均已定位）

| # | 原因 | 证据 | 处置 |
|---|---|---|---|
| 1 | **审计者用例 `70_permissions.sql:97` 引用了不存在的角色 `readonly_analytics`** | 第三轮我把 fixture `000` 收紧后只保留五个冻结角色（`app_readonly` 等），`readonly_analytics` 不再创建；`SET LOCAL ROLE readonly_analytics` 直接报「role does not exist」→ 文件 70 失败 | **已修**：`70e` 改用 `app_readonly`（回归自 AUDIT-FIX-1 的连带遗漏，我自己的疏漏） |
| 2 | **`40_full_loop.sql` 行为块按设计 `RAISE EXCEPTION`**（§26.4 唯一判据未达成） | §26.4 完整闭环属 Phase 4–6，本不应作为 Phase 1A 门禁的硬失败，却使 acceptance 步骤必然红 | **已修**：行为块改为 **PENDING·跳过**（无证据→NOTICE 不失败；证据齐全→PASS；证据不一致→硬 FAIL）。§26.4 在报告仍记「未达成」直至该块 PASS |
| 3 | **CI acceptance 循环不逐文件重灌种子** | `phase1a-ci.yml:79-82` 仅一次性加载 `010_seed.sql`，循环 `:95-98` 每个文件后 `TRUNCATE … CASCADE`。审计者 harness `run_all.sh` 逐文件重灌种子，CI 未照做 → 非确定性（依赖 event_ledger 的 TRUNCATE 守卫恰好使级联 TRUNCATE 整体中止、种子侥幸存活；不可依赖） | **交实现方**：见下方 CI 补丁 |

> 注 #1 是我第三轮收紧 fixture 时的连带疏漏——去掉 `readonly_analytics` 却漏改引用它的 `70e`。已修正并自查全部 `SET ROLE` 仅用五个冻结角色。

## 交实现方的 CI 补丁（robustness，一处）

`Run acceptance tests` 循环内、执行每个文件**之前**重灌种子，与 `run_all.sh` 对齐，使结果确定：

```yaml
          for f in tests/acceptance/*.sql; do
            echo ">> RUN $(basename "$f")"
            # ↓ 新增：每个文件前重灌种子（--single-transaction 会回滚各文件写入，故需重灌）
            psql -h localhost -U postgres -d longyuan_ci -q < tests/fixtures/010_seed.sql || true
            psql -h localhost -U postgres -d longyuan_ci -v ON_ERROR_STOP=1 --single-transaction < "$f" \
              && echo "   => PASS" || { echo "   => FAIL"; fails=$((fails+1)); }
            psql ... TRUNCATE ... CASCADE ... || true    # 保留；与重灌配对
          done
```

（`010_seed.sql` 全部 `ON CONFLICT DO NOTHING`，重复加载幂等、安全。）

## 复验结论（本轮）

- **两处审计资产缺陷已修**（`70e` 角色名、`40` PENDING 化）；`bash -n`、两个静态检查器均仍全绿。
- **CI 需应用 #3 的重灌种子补丁**后，acceptance 才能确定性执行。
- 预期修复后行为结果：`10/20/30/50/60/70/80/81` 应全 PASS；`40` 输出 **PENDING 26.4**（不失败）；即 `postgres-acceptance` 转绿。
- **仍不签发 Phase 1A 行为验收**：以上为静态推断，**审计者尚未观测到 CI 真实全绿**。请实现方应用 #3 补丁并回传 `Run acceptance tests` 步骤日志（或其转绿结果）。
- **§26.4 唯一判据维持「未达成」**：`40` 现为 PENDING，非 PASS。

---

# 第六轮 · 真实 CI 证据、污染纠正与隔离重设计（2026-07-24）

**背景**：`74ec3e3`（含 PGHOST 修复）后，`Init roles`→`Apply migrations`→`Load fixtures` 全部成功，`Run acceptance tests` 失败（exit 1，3 个文件 FAIL）。本轮取得**真实 CI 日志片段**，据此纠正两处审计者此前的错误判断。

## A. 三个 FAIL 的最终分类

| # | 文件·用例 | 真实原因 | 定性 | 归属 |
|---|---|---|---|---|
| 1 | `40_full_loop.sql` · 26.4-behavior | §26.4 唯一判据硬断言（闭环属 Phase 4–6，证据=0）| **按设计的硬红灯**（非缺陷）| 审计者（阶段隔离）|
| 2 | `70_permissions.sql:97` | `SET ROLE readonly_analytics`——第三轮收紧 fixture 后该角色已不存在 | **审计者测试 bug** | 审计者（改 `app_readonly`）|
| 3 | `80_phase1a_governance.sql` · P1A-15 | 断言 `SQLERRM LIKE '%immutable%'`，但 `prompt_versions_no_mutation` 复用 `prevent_event_mutation()`，抛的是 **`event_ledger is append-only`**（无 `immutable`）| **实现方测试的脆弱字符串断言 + 误导性实现消息**（治理行为本身有效）| 实现方（Kimi）|

**关键澄清（#3）**：日志 `NOTICE PASS P1A-13/14` + `ERROR FAIL P1A-15`。prompt_versions 的 `UPDATE` **确实被触发器拒绝**（治理有效）；P1A-13/16 通过是因为它们匹配 `%semantic%`（model/agent 的消息含 `semantic`+`immutable`），唯独 P1A-15 匹配 `%immutable%` 而 prompt 复用了 event_ledger 的 `append-only` 消息 → 不匹配 → 测试自身 RAISE。**不是实现缺陷，是测试断言 + 误导消息问题。**

## B. 污染风险判断——纠正（我此前结论错误）

**更正**：`psql --single-transaction` 在脚本**成功时 COMMIT**，仅在命令失败且 `ON_ERROR_STOP` 生效时才 ROLLBACK。因此我第四/五轮"没有真实污染"的结论**错误**。真实情况：

- 通过的用例会**提交**其写入（7 个 acceptance 文件含 `INSERT`，如 `10d` 提交更正事件、`70d` 以 `approval_event_writer` 提交 `deliverable.reviewed` 事件、`30b` 提交 `idem-dup-test-1`）；
- 后置 `TRUNCATE … CASCADE` 因级联触及 `event_ledger` 被 append-only 触发器整体中止（日志 line 256/281 `event_ledger is append-only`），`|| true` **吞掉**该失败；
- 已提交的 `event_ledger` 行**永不可清除**（append-only），跨文件累积；
- `ON CONFLICT DO NOTHING` **无法恢复被修改/新增的已提交数据**；
- 结论：**存在真实的跨用例状态污染，测试结果具顺序依赖性。** 现有清理机制不可接受。

## C. Phase 1A 显式测试清单（门禁执行集）

按此顺序执行；**明确排除 `40_full_loop.sql`**（Phase 4–6）：
```
10_event_immutability.sql
20_candidate_isolation.sql
30_idempotency.sql
50_recovery.sql
60_governance_redlines.sql
70_permissions.sql
80_phase1a_governance.sql
81_phase1a_audit.sql
```
CI 摘要须单列一行：`40_full_loop.sql — PENDING（Phase 4–6）`（不计入 PASS，也不计入 FAIL）。

## D. 选定的唯一隔离方案（不保留并列方案）

**采用「每文件显式事务 + 始终 ROLLBACK」包装。**

依据：静态检查确认全部 acceptance 文件**不含**任何 SQL 级 `BEGIN;`/`COMMIT;`/`ROLLBACK;`、`\connect`、`CREATE/DROP DATABASE`、`VACUUM`、`CREATE INDEX CONCURRENTLY` 等（所有 `BEGIN` 均为 PL/pgSQL `DO $$` 块关键字）。因此可安全外包在一个事务里并**无条件回滚**，无需更重的"每文件独立临时库"方案（后者仅在存在不可回滚命令时才需要）。

机制（每个文件）：
1. **先加载 seed**：`psql -v ON_ERROR_STOP=1 -f tests/fixtures/010_seed.sql`（**失败即 FAIL，无 `|| true`**）；
2. **包裹执行**：把 `BEGIN;` + 文件内容 + `ROLLBACK;` 交给 `psql -v ON_ERROR_STOP=1`；
3. **成功也 ROLLBACK**：丢弃该文件的一切写入，seed 与库回到干净态；
4. **失败即回滚退出**：`ON_ERROR_STOP` 使 psql 出错即停、非零退出，未提交事务在断开时回滚；CI 据非零码记该文件 FAIL；
5. **删除**后置 `TRUNCATE … CASCADE` 与一切 `|| true`。

这样：无任何用例提交数据 → 无 append-only 累积 → 无跨用例污染 → 结果与执行顺序无关。

## E. 给 Kimi 的最小 CI 变更规范（`.github/workflows/phase1a-ci.yml`，审计者不改此文件）

替换 `Run acceptance tests` 步骤循环为：
```bash
set -euo pipefail
PHASE1A="10_event_immutability 20_candidate_isolation 30_idempotency \
         50_recovery 60_governance_redlines 70_permissions \
         80_phase1a_governance 81_phase1a_audit"
echo "40_full_loop.sql — PENDING（Phase 4–6）"
fails=0
for name in $PHASE1A; do
  f="tests/acceptance/${name}.sql"
  echo ">> RUN ${name}"
  # 1) seed（失败即整步失败，绝不吞错）
  psql -h localhost -U postgres -d longyuan_ci -v ON_ERROR_STOP=1 -f tests/fixtures/010_seed.sql
  # 2) 始终回滚地执行测试文件
  if { echo "BEGIN;"; cat "$f"; echo "ROLLBACK;"; } \
       | psql -h localhost -U postgres -d longyuan_ci -v ON_ERROR_STOP=1; then
    echo "   PASS ${name}"
  else
    echo "   FAIL ${name}"; fails=$((fails+1))
  fi
done
[ "$fails" -eq 0 ] || { echo "Phase 1A: ${fails} file(s) FAIL"; exit 1; }
echo "Phase 1A acceptance: PASS（40_full_loop PENDING）"
```
硬性约束：**不得**再出现 `--single-transaction` 充当清理、`TRUNCATE … CASCADE`、任何 `|| true`；seed 失败必须使整步失败。

## F. 给 Kimi 的 P1A-15 实现与测试变更规范

不要把测试改成匹配 `%append-only%`（那会固化错误设计）。两件事一起做：
1. **实现**：为 `prompt_versions` 提供**专属**不可变提示，替换对 `prevent_event_mutation()` 的复用，例如新函数抛
   `prompt_versions are immutable; create a new version`（`event_ledger is append-only` 对 prompt_versions 是误导性消息）。
2. **测试**（`80` P1A-15）：改为**不依赖完整错误文案**——验证 ①`UPDATE` 确被拒绝（捕获到异常即可，不比对整串），且 ②原记录内容保持不变（更新前后 `SELECT template` 相等）。建议对 P1A-13/16 一并采用"行内容不变"式断言，去除脆弱字符串匹配。

## G. 本轮处置

- 审计者本轮**仅改自有资产**：`40_full_loop.sql`（还原硬断言）、`70_permissions.sql`（保留 `app_readonly`）、`TEST_REPORT.md`（本节）。**未改** `.github/workflows/phase1a-ci.yml`（属实现方，规范见 E）。
- **未执行任何 git 写操作**（无 add/commit/push）。
- **§26.4 唯一判据维持「未达成」**：`40` 现为原始硬断言，仅在 Phase 1A 门禁中被显式排除（不运行），闭环真正验收时按硬断言执行。
- **实现本身本轮未发现新缺陷**：P1A-15 属测试脆弱 + 消息误导；prompt 不可变治理有效。

---

## 附：测试资产清单（审计者维护，可自由增改）

- `tests/README.md` — 运行说明与隔离约束
- `tests/harness/run_all.sh` · `run_all.ps1` — 一次性容器运行器（需 Docker/PG16）
- `tests/fixtures/000_test_roles.sql` — 角色存在性安全网（**已去除全部 GRANT**；真实授权由 `db/init/002_init_roles.sh` 提供）
- `tests/fixtures/010_seed.sql` — 最小种子数据
- `tests/acceptance/10..70_*.sql` — 五组基础 + 治理红线 DB 用例
- `tests/acceptance/81_phase1a_audit.sql` — 审计者独立的 Phase 1A 复核（区别于实现方 `80_*.sql`）
- `tests/harness/run_all.sh` — 现镜像 compose 真实路径（迁移置于容器 `/db/migrations`，不再用 `/tmp` 覆盖）
- `tests/static/check_schema.sh` — 无需数据库的静态检查（扫描整个 `db/` 树；本机已运行，全绿）
- `tests/static/check_deployment_path.sh` — 部署路径回归检查（实现方新增；审计者已复核，本机实跑 7/7 PASS）
