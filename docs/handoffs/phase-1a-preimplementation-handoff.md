# Phase 1A 预实施交接文件

> 本文件是下一次 Kimi Code 会话的唯一阶段交接入口。
> 创建时间：2026-07-24
> 当前会话：Kimi Code 第二轮架构复核与实施计划审计
> 状态：只读审计与交接完成，未进入 Phase 1A 实现

---

# 一、项目当前状态

- 项目路径：`C:\longyuan-website`
- 当前项目仍处于规格、Schema、测试和实施计划阶段；
- 尚未初始化 Next.js；
- 尚未安装 Node 依赖；
- 尚未实现 Domain Service；
- 尚未实现 Worker；
- 尚未实现 Scheduler；
- 尚未实现审批服务；
- 尚未实现 Outbox Consumer；
- 尚未实现 Projection Applier；
- 尚未实现完整业务闭环；
- 尚未调用任何真实模型 API。

**明确声明**：

> “完整闭环未达成”是当前尚未进入实现阶段的事实，不是架构失败。

当前所有工作都停留在文档、Schema、测试用例和实施计划层面，没有任何业务代码落地。

---

# 二、当前仓库的权威文件

| 文件路径 | 作用 |
| --- | --- |
| `CLAUDE.md` | 审计者角色边界与宪法红线：只写测试、跑测试、出报告，不得修改被测代码和规格文件 |
| `TEST_REPORT.md` | Claude Code 的验收测试报告，披露审计环境无 Docker/PostgreSQL/Node/WSL，仅 `tests/static/check_schema.sh` 实际运行，DB 行为测试未运行 |
| `IMPLEMENTATION_PLAN.md` | 当前人工裁决下的实施计划，含阶段划分、技术栈、迁移清单、测试与验收标准 |
| `README.md` | 项目总览与快速入口 |
| `.gitignore` | 排除 `.env`、密钥、`node_modules`、数据库运行数据、上传文件、备份、日志、构建产物等 |
| `docs/product/龙渊天青_网站规划_v0.2.md` | 产品规划：愿景、Actor、核心流程、P0 功能 |
| `docs/product/龙渊天青_网站UI与交互规范_v0.1.md` | UI 规范：设计 Token、线框、组件清单、禁止项 |
| `docs/architecture/龙渊天青_Agent原生网站技术规格_v0.2.md` | 技术规格：事件驱动、Agent 治理、数据出站、Projection 机制 |
| `docs/architecture/review_precheck_output_schema_v0.2.json` | review.precheck Agent 输出 JSON Schema |
| `docs/governance/龙渊天青_Agent原生架构技术审查裁定_v0.1.md` | 治理裁定：Agent 不能直接写正式事件、正式事件只增不改等红线 |
| `docs/governance/龙渊天青_GEO与品牌解释权_v0.2.md` | GEO 与品牌解释权治理 |
| `db/init/001_agent_native_schema.sql` | 首期数据库 Schema |
| `docker-compose.yml` | 本地 Docker Compose 配置 |
| `.env.example` | 环境变量示例 |
| `tests/` | 测试套件，含静态检查、fixtures、acceptance SQL 测试 |

**权威优先级**（从高到低）：

1. 人工最新裁决；
2. 治理与架构冻结文件（`docs/governance/`、`docs/architecture/`）；
3. 产品和 UI 规范（`docs/product/`）；
4. `IMPLEMENTATION_PLAN.md`；
5. 测试与审计报告（`TEST_REPORT.md`、`CLAUDE.md`、`tests/`）；
6. 当前实现代码（目前为空）。

如实现计划与最新人工裁决冲突，以最新人工裁决为准。

---

# 三、Claude Code 审计已确认的事实

## 1. `event_ledger` 存在 TRUNCATE 缺口

现有 `BEFORE UPDATE/DELETE` 行级触发器不能阻止：

```sql
TRUNCATE event_ledger;
```

下一阶段必须同时实现：

- `BEFORE TRUNCATE ON event_ledger FOR EACH STATEMENT` 触发器；
- 对所有应用角色 `REVOKE TRUNCATE`；
- 应用角色不得拥有 `event_ledger`；
- 应用角色不得拥有 `public` Schema；
- 应用角色不得拥有 `SUPERUSER`；
- 应用角色不得拥有 `BYPASSRLS`；
- 应用角色不得拥有 `CREATEDB`；
- 应用角色不得拥有 `CREATEROLE`。

**明确写明**：

> 触发器用于防误操作，数据库权限才是第一道安全边界。

## 2. 数据库角色和 GRANT 缺失

当前 `.env.example` 和 `docker-compose.yml` 引用数据库角色，但 `db/init/` 中没有实际 `CREATE ROLE` 和 `GRANT`。

必须补充最小权限角色：

- `app_rw`
- `worker_candidate_rw`
- `scheduler_jobs_rw`
- `approval_event_writer`
- `app_readonly`

## 3. `reviews` 可能形成第二条写入路径

`reviews` 当前仍是独立表，并包含 `decision` 字段。如果普通应用可以直接写 `reviews`，就可能绕过：

```
candidate_event
→ approval
→ event_ledger
→ projection
```

该问题必须在 Phase 1A 解决。

---

# 四、Kimi Code 第二轮复核中的有效发现

1. Docker 角色密码不能依靠普通 `.sql` 脚本直接读取 Compose 环境变量；
2. 数据库角色初始化应使用安全的 `.sh` 入口或等效 `psql` 变量注入；
3. `deploy/Caddyfile` 缺失；
4. `deploy/web.Dockerfile` 缺失；
5. `deploy/worker.Dockerfile` 缺失；
6. Web 健康检查依赖 `wget` 存在风险，应改为 Node 原生 HTTP 检查；
7. 本地文件上传需要持久化 `uploads` 卷；
8. `model_configs` 缺少语义版本保护；
9. 文件上传还缺少 MIME 校验、大小限制、文件名安全、恶意文件检测和重复文件策略；
10. 模型调用还缺少超时、重试、限流、幂等、熔断恢复和账单对账策略；
11. `egress_class` 与模型处理区域之间的政策映射尚未定义；
12. Phase 1 应拆为 Phase 1A、Phase 1B、Phase 1C。

---

# 五、Kimi Code 第二轮复核的遗漏与纠正

## 1. 漏掉 TRUNCATE 缺陷

Kimi 第二轮复核没有把 `event_ledger` TRUNCATE 缺口列为 P0。

**这是漏审。**

下一会话不得遗漏。

## 2. P0 不能全部混为一类

按阶段重新分类：

### Phase 1A P0

- `event_ledger` TRUNCATE 防护；
- 数据库角色创建；
- 最小权限 GRANT；
- `reviews` 读模型防绕过；
- 数据库治理测试转绿。

### Phase 1B P0

- `deploy/Caddyfile`；
- `deploy/web.Dockerfile`；
- `deploy/worker.Dockerfile`；
- Node 健康检查；
- `docker compose up` 可运行。

### 文件上传上线前 P0

- `uploads` 持久化卷；
- MIME 校验；
- 大小限制；
- 文件名安全；
- 哈希；
- 恶意文件检查。

### 完整 Agent 闭环前 P0

- OutboxConsumer；
- ProjectionApplier；
- EgressGuard；
- LanguageValidator；
- CostCircuitBreaker；
- replay/shadow 约束；
- 成本失败和 dead-letter 正式入账。

---

# 六、已经冻结、不再重复讨论的人工裁决

## 1. 技术栈

统一使用：

- TypeScript
- Node.js
- Next.js App Router
- PostgreSQL
- Drizzle ORM
- 手写 SQL 作为迁移权威来源
- Node Worker
- Node Scheduler

首期不引入 Python 服务。

## 2. 消息队列

不引入：

- Redis
- RabbitMQ
- Kafka

使用 PostgreSQL Job Queue。

## 3. Worker 与 Scheduler

- Worker 与 Scheduler 共用同一个 TypeScript 代码库；
- 共用同一个 Docker 镜像；
- 使用不同 `command` 启动；
- Scheduler 保留为独立容器。

不得重新建议让 Worker 同时兼任 Scheduler。

## 4. `reviews`

`reviews` 保留为表，但只能作为正式事件的读模型。

必须增加：

- `source_event_id NOT NULL`
- `source_event_id UNIQUE`
- `source_event_id` 外键指向 `event_ledger.id`
- `projection_version`
- `projected_at`

写入规则：

- `app_rw` 无写权限；
- `worker_candidate_rw` 无写权限；
- `scheduler_jobs_rw` 无写权限；
- 只有 `approval_event_writer` 可以在正式事件事务中维护；
- `reviews` 可以从 `event_ledger` 重建；
- `reviews` 不得成为独立权威写入路径。

不再讨论“改成视图还是保留为表”。

裁决已经是：

> 保留为表 + 最小权限 + `source_event_id` 约束 + Domain Service 同事务维护。

## 5. Replay、Rerun 和 Shadow

**Replay**：

- 读取已有 `agent_run` 输出；
- 不重新调用模型；
- 不创建新的 `candidate_event`；
- 不改变任何正式状态；
- 只用于重现和核验历史运行结果。

**Rerun**：

- 新建 `agent_run`；
- 重新调用模型；
- 产生新的输出；
- 可以产生新的 `candidate_event`。

**Shadow**：

- 可以调用影子模型；
- 只写 `agent_runs`；
- 不产生 `candidate_event`；
- 不改变正式状态。

数据库约束必须保证：

- replay run 不能被 `candidate_events` 引用；
- shadow run 不能被 `candidate_events` 引用。

## 6. 认证

Phase 2 采用 Better Auth。

排除 Lucia。

原因：

- Lucia 不作为新项目认证依赖；
- 不自行实现完整密码、会话和 MFA 体系。

认证必须支持：

- 管理员生成一次性邀请链接；
- 邀请限定邮箱；
- 邀请限定角色；
- 默认七天有效；
- 单次使用；
- 可撤销；
- 邮箱密码；
- 密码重置；
- 会话撤销；
- 管理员 MFA 上线前完成。

## 7. `model_configs` 版本纪律

不能简单禁止所有 UPDATE。

以下语义字段修改时必须创建新配置版本：

- `provider`
- `model_name`
- `endpoint`
- `provider_region`
- `data_processing_region`
- `retention_policy`
- `capability`
- `pricing_policy`
- `output_contract`

以下运营字段可以由受信角色受控更新：

- `verification_status`
- `verified_at`
- `disabled_at`
- `last_healthcheck_at`
- `last_error_at`

不得原地改变模型语义配置。

## 8. `approval_event_writer` 权限

`approval_event_writer` 不得拥有“全库读”。

它只允许读取完成受信审批事务所必需的表，例如：

- `candidate_events`
- `agent_runs`
- `event_types`
- `tasks`
- `deliverables`
- `operational_event_outbox`
- `state_projections`
- `reviews`
- `approvals`

它不得读取：

- 密码哈希；
- 邀请令牌原文；
- 无关用户隐私；
- 无关文件内容；
- 无关系统密钥。

它是唯一可以 `INSERT event_ledger` 的应用角色，但仍然：

- 不得 `UPDATE event_ledger`；
- 不得 `DELETE event_ledger`；
- 不得 `TRUNCATE event_ledger`；
- 不得成为 `event_ledger` 所有者。

## 9. UI

Phase 0A 已经由 `docs/product/龙渊天青_网站UI与交互规范_v0.1.md` 完成。

不得在 Next.js 初始化前创建悬空的：

- `src/web/design-system/tokens.ts`
- `src/web/app/_design/wireframes/`

UI 代码在 Phase 1C 进入真实工程目录。

## 10. Mock 模型

第一条闭环全部跑通前：

- 只使用 Mock 模型；
- 不接 Kimi 真实 API；
- 不接任何真实模型；
- 不填写真实密钥。

---

# 七、最终阶段划分

## Phase 0A：设计冻结

已完成。

产物：

- 网站 UI 与交互规范；
- 设计 Token；
- P0 页面线框；
- 组件清单；
- 禁止项。

不创建工程代码。

## Phase 1A：数据库治理硬化

只实现：

- `event_ledger` TRUNCATE 防护；
- 数据库角色创建；
- 最小权限 GRANT；
- `reviews` 读模型约束；
- `model_configs` 语义版本保护；
- replay/shadow 禁止生成 candidate 约束；
- PostgreSQL 16 测试环境；
- 数据库角色权限测试；
- Claude 已有测试套件转绿。

不得初始化完整 Next.js 页面。

## Phase 1B：应用骨架与 Docker

实现：

- Next.js App Router；
- TypeScript；
- Node Worker 入口；
- Node Scheduler 入口；
- `deploy/Caddyfile`；
- `deploy/web.Dockerfile`；
- `deploy/worker.Dockerfile`；
- Node 健康检查；
- Docker Compose；
- `uploads` 卷；
- `docker compose up` 可运行。

不实现业务闭环。

## Phase 1C：基础设施接口与静态 UI Shell

定义：

- StorageAdapter
- OutboxConsumer
- ProjectionApplier
- EgressGuard
- LanguageValidator
- CostCircuitBreaker
- Domain Service 边界

只允许接口和 stub。

同时实现静态 P0 UI Shell。

不接数据库业务，不接模型。

## Phase 2

认证、Actor 和邀请制。

## Phase 3

任务、交付物和正式事件入口。

## Phase 4

Agent 登记、Job 队列和触发规则。

## Phase 5

Worker、Mock 模型、`candidate_event` 和安全防线。

## Phase 6

Approval Service、`reviews` 读模型、`state_projection` 和第一条完整闭环。

## Phase 7

Scheduler、Outbox Consumer、备份与恢复脚本。

## Phase 8 以后

前后台数据化、审计扩展、真实模型接入、恢复演练、MFA 和部署。

---

# 八、下一会话唯一允许执行的阶段

下一次 Kimi Code 会话只能执行：

**Phase 1A：数据库治理硬化与审计测试转绿。**

## Phase 1A 允许

- 创建数据库迁移；
- 创建角色初始化脚本；
- 创建权限测试；
- 修复测试入口；
- 提供 PostgreSQL 16 测试容器；
- 运行静态检查；
- 运行数据库行为测试；
- 输出真实测试结果。

## Phase 1A 禁止

- 初始化完整 Next.js；
- 编写前端页面；
- 用户认证；
- 任务业务；
- 交付物业务；
- Agent Worker 业务；
- Scheduler 业务；
- 真实模型调用；
- Kimi API；
- 文件上传业务；
- Approval Domain Service 完整实现；
- UI 精装修；
- 修改产品和治理原则；
- 删除或弱化 Claude 测试以获得绿色结果。

---

# 九、Phase 1A 必须实现的数据库约束

## 1. `event_ledger`

- `UPDATE` 禁止；
- `DELETE` 禁止；
- `TRUNCATE` 禁止；
- 只有 `approval_event_writer` 可 `INSERT`；
- 所有应用角色都不是 Owner。

## 2. `candidate_events`

- shadow run 不得产生 candidate；
- replay run 不得产生 candidate；
- worker 只能写 pending candidate；
- worker 不能将 candidate 改为 approved/applied。

## 3. `reviews`

- `source_event_id NOT NULL UNIQUE`；
- 仅 `approval_event_writer` 写；
- 可从 `event_ledger` 重建。

## 4. `prompt_versions`

- 语义字段不可原地修改。

## 5. `agent_versions`

- 语义字段不可原地修改。

## 6. `model_configs`

- 语义字段不可原地修改；
- 运营状态字段允许受控更新。

## 7. `public` Schema

- `REVOKE CREATE ON SCHEMA public FROM PUBLIC`；
- 默认 `PUBLIC` 权限最小化。

## 8. 数据库角色

- `app_rw`
- `worker_candidate_rw`
- `scheduler_jobs_rw`
- `approval_event_writer`
- `app_readonly`

---

# 十、测试状态必须诚实记录

明确区分：

- 静态测试已实际运行；
- 数据库测试已编写但未运行；
- 数据库测试已实际运行；
- 测试通过；
- 测试失败；
- 因环境缺失未执行。

Claude Code 已经披露：

> 其环境没有 Docker、PostgreSQL、Node 和 WSL。

因此：

- Claude 生成的数据库行为测试不能写成已经通过；
- 下一会话必须在具备 PostgreSQL 16 的环境中真正执行；
- 如本机无法执行，必须创建 CI；
- 未运行的测试必须标为 `NOT RUN`；
- **不得伪造 PASS**。

---

# 十一、Git 和工作区状态

当前分支：`master`

最新提交：无（仓库尚未有任何提交）

未跟踪文件：

- `.env.example`
- `.gitignore`
- `CLAUDE.md`
- `IMPLEMENTATION_PLAN.md`
- `README.md`
- `TEST_REPORT.md`
- `db/`
- `docker-compose.yml`
- `docs/`
- `tests/`

已修改文件：无

未提交 diff：无（因为没有提交）

敏感文件检查：

- `.env` 未被跟踪；
- 未发现真实 API 密钥；
- `CLAUDE.md`、`TEST_REPORT.md` 和 `tests/` 已存在，但尚未纳入任何提交。

**当前会话只创建了 `docs/handoffs/phase-1a-preimplementation-handoff.md`，未执行 `git add`、`git commit` 或 `git push`。**

---

# 十二、下一会话启动指令

下一会话首先只读恢复状态：

1. 阅读 `CLAUDE.md`；
2. 阅读 `IMPLEMENTATION_PLAN.md`；
3. 阅读 `TEST_REPORT.md`；
4. 阅读 `docs/handoffs/phase-1a-preimplementation-handoff.md`；
5. 阅读 `db/init/` 下全部 SQL；
6. 阅读 `tests/` 下全部测试入口；
7. 执行 `git status`；
8. 执行 `git log -5 --oneline`；
9. 输出当前阶段、未完成事项和 Phase 1A 实施计划；
10. 等待人工批准后再修改文件。

---

# 十三、当前会话完成动作

本次会话已完成：

1. 创建目录 `docs/handoffs/`；
2. 创建文件 `docs/handoffs/phase-1a-preimplementation-handoff.md`；
3. 写入上述全部 13 节内容；
4. 执行并记录：
   - `git status --short`
   - `git branch --show-current`
   - `git log -5 --oneline`
   - `git diff --stat`
   - `git diff --name-only`
5. 未执行任何代码修改、框架初始化、依赖安装、数据库迁移、模型调用或 Git 写操作。

**当前会话没有未完成写操作。**

---

# 交接摘要

- **下一会话唯一允许阶段**：Phase 1A — 数据库治理硬化与审计测试转绿。
- **核心目标**：补全 `event_ledger` TRUNCATE 防护、数据库角色与最小权限 GRANT、`reviews` 读模型约束、以及 `model_configs` / replay / shadow 版本与来源约束。
- **未解决但不在 Phase 1A 的问题**：Dockerfile 缺失、Caddyfile、上传安全、模型韧性、egress 区域映射、业务闭环等，按最终阶段划分后续处理。
- **最大风险**：伪造测试通过或弱化 Claude 测试以求绿色。必须诚实记录 `NOT RUN` 与真实 `PASS/FAIL`。
