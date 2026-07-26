# 龙渊天青 Agent 原生网站实施计划
## v0.2 规划版 · 最终人工裁决后

> 状态：Phase 1B 已完成；等待 Phase 2 认证与项目骨架  
> 依据：《龙渊天青网站规划 v0.2》《龙渊天青网站UI与交互规范 v0.1》《Agent原生网站技术规格 v0.2》《review_precheck_output_schema_v0.2.json》《Agent原生架构技术审查裁定 v0.1》《GEO与品牌解释权 v0.2》《001_agent_native_schema.sql》《docker-compose.yml》《.env.example》

---

## 1. 已阅读文件清单

| 文件 | 版本 | 核心作用 |
|---|---|---|
| `docs/product/龙渊天青_网站规划_v0.2.md` | v0.2 | 产品定位、MVP、运行模型、建设顺序 |
| `docs/product/龙渊天青_网站UI与交互规范_v0.1.md` | v0.1 | 设计Token、页面线框、组件清单、禁止项、实施顺序 |
| `docs/architecture/龙渊天青_Agent原生网站技术规格_v0.2.md` | v0.2 | 服务边界、事件模型、Agent流程、安全防线 |
| `docs/architecture/review_precheck_output_schema_v0.2.json` | v0.2 | review.precheck 输出 JSON Schema 与语言策略 |
| `docs/governance/龙渊天青_Agent原生架构技术审查裁定_v0.1.md` | v0.1 | P0/P1 强制约束与开工前置清单 |
| `docs/governance/龙渊天青_GEO与品牌解释权_v0.2.md` | v0.2 | 实体登记、声明账本、对外口径、证据等级 |
| `db/init/001_agent_native_schema.sql` | v0.2 | PostgreSQL 表、约束、触发器 |
| `docker-compose.yml` | - | 本地容器编排（将按 Node 栈修正） |
| `.env.example` | - | 环境变量模板 |

---

## 2. 架构审查结论

### 2.1 已确认的一致点（无冲突）

- **事件总账只增不改**：`event_ledger` 有 `BEFORE UPDATE OR DELETE` 触发器。
- **Agent 只写候选**：`candidate_events` 表存在；Worker 账户理论上不授予 `event_ledger` INSERT。
- **外部内容永不自动批准**：`candidate_events` 与 `agent_trigger_rules` 均有 `CHECK (NOT contains_external_content OR auto_approve/allow_auto_approve = false)`。
- **正式事件只增不改**：同第一条。
- **Replay 不重新调用模型**：`agent_jobs.run_mode = 'replay'`、`agent_runs.replayed_from_stored_output` 字段已预留。
- **forbidden 数据不得发送第三方模型**：`egress_class_enum` 与 `egress_manifest` 字段已预留。
- **Prompt/Agent/模型配置不可热改**：`prompt_versions` 与 `agent_versions` 触发器已存在。
- **成本超限、模型失败、dead-letter 必须入账**：`operational_event_outbox` 表已存在。

### 2.2 已冻结的裁决

以下冲突已通过人工裁决关闭，详见第 3 节“人工裁决与架构冻结”：

- 技术栈统一为 TypeScript/Node（Next.js App Router + Node Worker/Scheduler）。
- 使用 Drizzle ORM + Drizzle Kit 自定义 SQL 迁移，但 SQL 文件仍是迁移权威来源。
- `reviews` 表保留为 `deliverable.reviewed` 正式事件的读模型，由 Domain Service 在事务中维护，不直接改变状态；`approvals` 负责 candidate_events 治理审批。
- 最小文件上传：本地文件系统 Storage Adapter，生产 S3 兼容；数据库只存引用、SHA-256、类型、大小、`egress_class`。
- 认证：邀请制 + 邮箱密码；管理员 MFA 列为上线前要求。
- 备份：生产采用数据库/云盘每日快照 + pg_dump 同步到启用版本控制的 S3 兼容对象存储；本地自动备份默认关闭，但必须提供脚本；测试/预发布/生产强制开启。
- 模型：第一阶段只使用 Mock 模型；完整闭环通过后第一家真实模型使用 Kimi；未配置成本阈值时禁止启用真实模型 Agent；每个模型 Endpoint 必须显式登记 `provider_region` 和 `data_processing_region`；首期默认中国大陆 Endpoint；禁止运行时自动切换区域；restricted 必须具名授权；forbidden 永久禁止出站。
- 事件类型：新增 `event_types` 注册表；`event_ledger.event_type` 建立外键；payload 通过应用层 JSON Schema 校验；模型不得自行创建事件类型。
- GEO：新增 `public_contents` 表；不把 GEO 字段分散写入 `works`/`tasks`；`public_contents` 关联内部 `entity_type`/`entity_id`；保存 `content_version`、`source_event_id`、`published_at`、`status`、`superseded_by`、`withdrawn_at`。
- 成本熔断：数据库保存可调整运营阈值；环境变量保存不可突破硬上限；有效阈值取两者较小值；未配置阈值时真实模型默认禁用。
- 阶段顺序：Phase 0A 只做 UI 规范/线框/Token/组件清单；Phase 1 初始化 Next.js/Docker/数据库/基础设施；Phase 1B 实现静态 UI Shell，不接数据库和模型；后续再进入认证和业务闭环。
- Worker/Scheduler 共用同一个 TypeScript 代码库和 Dockerfile，通过不同 command 启动。
- 不引入 Redis、RabbitMQ、Kafka 或其他消息中间件。
- Scheduler 使用独立的 `approval_event_writer` 数据库连接消费 `operational_event_outbox`。
- 正式事件写入、candidate 应用、`state_projection` 更新必须在同一数据库事务中完成。
- 核心业务写入使用 Next.js Route Handlers 调用统一 Domain Service；Server Actions 只能调用同一个 Domain Service，不得形成第二套业务写入逻辑。

### 2.3 仍存在的冲突 / 遗漏 / 不可执行设计

按严重度从高到低排列：

#### S1. 运行时直接失败：数据库角色未创建

- **问题**：`.env.example` 使用 `app_rw`、`worker_candidate_rw`、`scheduler_jobs_rw` 等账户；`docker-compose.yml` 直接使用这些 URL；但 `001_agent_native_schema.sql` 只有注释推荐，没有 `CREATE ROLE ... LOGIN PASSWORD ...` 与 `GRANT` 语句。
- **后果**：容器启动后立即无法连接 PostgreSQL。
- **修复方向**：Phase 1 补充 `db/init/002_roles_and_grants.sql`，创建 `app_rw`、`worker_candidate_rw`、`scheduler_jobs_rw`、`approval_event_writer`、`readonly_analytics` 并授权。

#### S2. 缺失文件：Docker Compose 引用不存在的 Dockerfile 与配置

- **问题**：`docker-compose.yml` 引用：
  - `./deploy/Caddyfile`
  - `./deploy/web.Dockerfile`
  - `./deploy/worker.Dockerfile`
- **后果**：`docker compose up` 在构建阶段失败。
- **修复方向**：Phase 1 补充这些文件。Worker 与 Scheduler 共用 `deploy/worker.Dockerfile`，通过 `command` 区分。

#### S3. docker-compose.yml 仍含 Python 命令暗示

- **问题**：worker healthcheck 使用 `python -m app.healthcheck`，scheduler command 使用 `python -m app.scheduler`。
- **后果**：与技术栈统一为 Node 的裁决冲突。
- **修复方向**：本计划执行时同步修正 `docker-compose.yml` 为 Node 命令。

#### S4. 运营事件出账处理器缺失

- **问题**：`operational_event_outbox` 存在，但无服务将其转为 `event_ledger` 正式事件。
- **后果**：Worker 写入 outbox 后，异常事件可能永远 pending，违反“失败必须入账”原则。
- **修复方向**：Scheduler 容器使用 `approval_event_writer` 连接运行 Outbox Consumer；同一事务中写入正式事件、更新 projection、标记 outbox 为 applied。

#### S5. 状态投影更新机制缺失

- **问题**：`state_projections` 表存在，但无触发器或函数自动更新。
- **后果**：“状态投影更新”步骤无法自动执行。
- **修复方向**：Approval Service 在同一事务中显式更新 `state_projections`；Projection Applier 提供幂等重建能力。

#### S6. 出站闸门、语言校验、成本熔断无执行逻辑

- **问题**：Schema 已预留字段，但无应用逻辑执行：
  - 枚举输入对象并计算最高 `egress_class`；
  - CJK 比例校验；
  - 成本上限检查。
- **后果**：这些防线停留在“字段存在”，实际调用时可能被绕过。
- **修复方向**：Node Worker 中实现 `EgressGuard`、`LanguageValidator`、`CostCircuitBreaker`，并配套单元测试强制拦截。

#### S7. Agent 触发规则与种子数据缺失

- **问题**：`agent_trigger_rules` 表为空；没有默认规则把 `deliverable.submitted` 映射到 `review.precheck`；也没有种子 Agent、模型配置、Prompt 版本。
- **后果**：第一条闭环无法跑通。
- **修复方向**：Phase 4 提供种子 SQL/脚本，含 Mock 模型配置、Prompt 版本、Agent 版本、触发规则。

#### S8. Storage Adapter 未定义

- **问题**：文件上传需要本地 dev 文件系统和生产 S3 兼容的抽象，但当前无接口定义。
- **后果**：交付物文件持久化逻辑与具体存储耦合。
- **修复方向**：Phase 1 定义 `StorageAdapter` 接口；Phase 3 实现本地文件系统适配器与 S3 适配器。

#### S9. Domain Service / Outbox Consumer / Projection Applier 未定义

- **问题**：这些是核心基础设施组件，但当前只有表结构，无服务边界定义。
- **后果**：业务代码容易出现多写入路径，违反“Server Actions 只能调用同一 Domain Service”的裁决。
- **修复方向**：Phase 1 定义接口与目录结构；Phase 2–7 逐步实现。

#### S10. `event_types` 注册表与 `event_ledger` 外键缺失

- **问题**：当前 Schema 中 `event_ledger.event_type` 为自由文本，无注册表和外键约束。
- **后果**：可能写入无效/拼写错误的事件类型；模型或开发者可能自行创建未注册类型。
- **修复方向**：Phase 1 新增 `event_types` 注册表，修改 `event_ledger` 增加外键；Domain Service 校验 payload 对应 JSON Schema。

#### S11. `public_contents` 表缺失

- **问题**：GEO 字段尚未落地为独立表。
- **后果**：公开内容无法按裁决要求集中管理。
- **修复方向**：Phase 1 新增 `public_contents` 表及索引。

### 2.4 原则遵循检查

| 原则 | 现状评估 | 风险 |
|---|---|---|
| Agent 不能直接写正式事件 | ✓ Schema + 权限设计支持 | 依赖角色权限正确授予；Outbox Consumer 使用独立账户 |
| Agent 只能写候选事件 | ✓ candidate_events 表 | 同上 |
| 外部可控内容永久禁止自动批准 | ✓ DB CHECK 约束 | 需在应用层测试覆盖 |
| 正式事件只增不改 | ✓ 触发器 | 无 |
| Replay 不得重新调用模型 | ✓ 字段预留 | 需 Replay 服务实现 |
| forbidden 数据不得发送第三方模型 | ✓ egress_class 字段 | 需 EgressGuard 实现 |
| Prompt/Agent/模型配置不得原地热改 | ✓ 触发器 | 无 |
| 成本超限/模型失败/dead-letter 必须入账 | ✓ operational_event_outbox | 需 Outbox Consumer 实现 |

---

## 3. 人工裁决与架构冻结

本节记录最终人工裁决，作为后续开发的不可变约束。

### 3.1 技术栈

- **Web**：Next.js App Router + TypeScript
- **数据库**：PostgreSQL 16
- **ORM**：Drizzle ORM
- **迁移**：Drizzle Kit 组织，但**权威来源仍是手写 SQL 文件**；禁止 `drizzle-kit push` 直接覆盖生产数据库
- **Worker / Scheduler**：Node.js + TypeScript（与 Web 同一运行时生态）
- **任务队列**：PostgreSQL `FOR UPDATE SKIP LOCKED`
- **网关**：Caddy 2.8
- **对象存储**：本地文件系统 Storage Adapter（dev）；S3 兼容对象存储（prod）
- **UI**：Tailwind CSS；严格遵循 UI 规范中的色彩、字体、间距、禁止项

### 3.2 数据与写入纪律

- SQL Schema 是迁移权威来源；Drizzle 仅用于类型安全查询和迁移组织。
- 正式事件写入、candidate 应用、`state_projection` 更新必须在**同一数据库事务**中完成。
- `reviews` 表保留为 `deliverable.reviewed` 正式事件的读模型，由 **Domain Service 在正式事件写入事务中维护**，不使用数据库触发器实现业务投影。
- `approvals` 负责 `candidate_events` 的治理审批。
- 核心业务写入统一通过 Next.js Route Handlers 调用 Domain Service；Server Actions 只能调用同一个 Domain Service，不得形成第二套业务写入逻辑。
- 模型不得自行创建事件类型；所有事件类型必须在 `event_types` 注册表中预先登记。

### 3.3 Agent 与模型策略

- 第一阶段只使用 **Mock 模型**跑通完整闭环。
- 完整闭环通过后，第一家真实模型使用 **Kimi**。
- 每个模型 Endpoint 必须显式登记 `provider_region` 和 `data_processing_region`。
- 首期默认使用明确配置的**中国大陆 Endpoint**。
- **禁止运行时自动切换到未知区域**。
- `restricted` 级别内容必须具名授权后才可出站。
- `forbidden` 级别内容**永久禁止**出站。
- 未配置成本阈值（`max_cost_per_run`、`max_daily_cost`、全局熔断阈值）时，**真实模型默认禁用**。
- Worker/Scheduler 共用同一个 TypeScript 代码库和 Dockerfile，通过不同 `command` 启动。
- 不引入 Redis、RabbitMQ、Kafka 或其他消息中间件。

### 3.4 文件上传与存储

- 首期实现最小文件上传。
- 本地开发使用**文件系统 Storage Adapter**。
- 生产使用 **S3 兼容对象存储**。
- 数据库只保存文件引用、SHA-256、类型、大小和 `egress_class`。

### 3.5 认证与安全

- 认证采用**邀请制 + 邮箱密码**。
- 不开放公众自由注册。
- 管理员生成**一次性邀请链接**，可限定邮箱、角色和有效期，**默认七天失效**。
- 不提供公众邀请码入口。
- 管理员可直接创建内部账号。
- 管理员 MFA 列为**上线前要求**。

### 3.6 备份策略

- 生产采用**数据库/云盘每日快照**。
- `pg_dump` 同步到**启用版本控制的 S3 兼容对象存储**。
- 本地开发自动备份**默认关闭**。
- 必须实现**备份和恢复脚本**。
- 测试、预发布和生产环境**强制开启备份**。

### 3.7 事件类型治理

- 新增 `event_types` 注册表。
- `event_ledger.event_type` 建立外键约束。
- payload 同时通过应用层 JSON Schema 校验。
- 模型不得自行创建事件类型。

### 3.8 GEO 与公开内容

- GEO 完整声明账本**不进入首期**。
- 新增 `public_contents` 表集中承载公开内容元数据。
- 不把 GEO 字段分散写入 `works`/`tasks`。
- `public_contents` 通过 `entity_type`/`entity_id` 关联内部对象。
- 必须保存：`content_version`、`source_event_id`、`published_at`、`status`、`superseded_by`、`withdrawn_at`。

### 3.9 成本熔断

- 数据库保存**可调整的运营阈值**。
- 环境变量保存**不可突破的硬上限**。
- 有效阈值 = min(数据库运营阈值, 环境变量硬上限)。
- 未配置阈值时，真实模型默认禁用。

### 3.10 UI 开发纪律

- Phase 0A 只做 UI 规范、线框、设计 Token 和组件清单。
- Phase 1B 实现静态 UI Shell，不接数据库、不调用模型。
- 禁止 AI 科技风设计（蓝紫渐变、粒子、发光、黑底荧光绿、3D 青瓷旋转等）。
- 遵循 UI 规范中的色彩、字体、间距、圆角、阴影、响应式、无障碍规则。
- 所有状态色和文案必须全站统一。

### 3.11 基础设施补齐清单

Phase 1 必须完成以下基础设施：

- 数据库角色创建与 GRANT 脚本
- `deploy/Caddyfile`
- `deploy/web.Dockerfile`
- `deploy/worker.Dockerfile`
- `StorageAdapter` 接口
- `OutboxConsumer`
- `ProjectionApplier`
- `EgressGuard`
- `LanguageValidator`
- `CostCircuitBreaker`
- `event_types` 注册表
- `public_contents` 表

---

## 4. 建议技术栈

| 层 | 技术 | 理由 |
|---|---|---|
| 网关 | Caddy 2.8 | 已在 Compose 中指定；自动 HTTPS、反向代理、限流 |
| Web / API | Next.js 14+ (App Router) + TypeScript | 已冻结；Route Handlers 调用 Domain Service |
| UI | Tailwind CSS + Radix / 自定义组件 | 严格遵循 UI 规范；禁止 AI 科技风 |
| ORM | Drizzle ORM | 类型安全、贴近 SQL |
| 迁移 | Drizzle Kit + 手写 SQL | SQL 文件为权威来源；禁止生产环境 `push` |
| Worker / Scheduler | Node.js + TypeScript | 与 Web 统一运行时、共享类型和 Schema |
| 数据库 | PostgreSQL 16 | Compose 已指定 |
| 任务队列 | PostgreSQL `FOR UPDATE SKIP LOCKED` | 技术规格明确要求；不引入消息中间件 |
| 对象存储（dev） | 文件系统 Storage Adapter | 最小本地依赖 |
| 对象存储（prod） | S3 兼容存储 | 由 .env 配置；启用版本控制 |
| 模型适配 | Node 侧统一封装 `ModelAdapter` | Mock 首期；Kimi 为第一家真实模型 |
| 测试 | Vitest + Playwright | 分层覆盖 |

---

## 5. 最终目录结构（建议）

```
longyuan-website/
├── .env.example
├── .env                    # gitignored
├── .gitignore
├── README.md
├── IMPLEMENTATION_PLAN.md
├── docker-compose.yml      # 已按 Node 栈修正
├── docker-compose.override.yml   # 本地 dev 覆盖
├── Makefile
├── db/
│   ├── init/
│   │   ├── 001_agent_native_schema.sql
│   │   ├── 002_roles_and_grants.sql
│   │   ├── 003_event_types_registry.sql
│   │   └── 004_public_contents.sql
│   ├── migrations/               # 手写 SQL 迁移（Drizzle Kit 引用）
│   └── seeds/                    # 种子数据（Agent/模型/Prompt/规则）
├── deploy/
│   ├── Caddyfile
│   ├── web.Dockerfile
│   └── worker.Dockerfile         # Worker 与 Scheduler 共用
├── docs/
│   ├── architecture/
│   ├── governance/
│   └── product/
├── scripts/
│   ├── seed.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── test-e2e.sh
├── src/
│   ├── web/                      # Next.js App Router
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── server/
│   │   │   ├── domain/           # Domain Service（唯一业务写入入口）
│   │   │   ├── db/
│   │   │   └── agents/
│   │   └── design-system/        # 设计 Token
│   ├── worker/                   # Node Worker & Scheduler
│   │   ├── app/
│   │   ├── adapters/             # ModelAdapter（Mock + Kimi + 预留）
│   │   ├── prompts/
│   │   ├── validators/
│   │   ├── egress/
│   │   ├── storage/
│   │   ├── cost/
│   │   ├── scheduler/
│   │   └── index.ts              # 根据 APP_ROLE 启动 Worker 或 Scheduler
│   └── shared/                   # 事件类型、Schema、类型定义
│       ├── schemas/
│       ├── events/
│       └── types/
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── unit/
└── uploads/                      # 本地 dev 上传目录（gitignored）
```

> 注意：当前规划阶段**不**创建 `src/web`、`src/worker` 等框架代码，也不安装依赖。

---

## 6. 开发阶段

### Phase 0A：UI 规范、线框、设计 Token 和组件清单

- **实现内容**
  - 梳理 UI 规范为可执行的设计 Token（色彩、字体、间距、圆角、阴影、断点）；
  - 建立禁止项清单；
  - 产出 P0 页面低保真线框（首页、书籍列表/详情、任务列表/详情、我的任务、提交交付物、人工验收、候选审批、Agent 运行详情）；
  - 列出基础组件与业务组件清单；
  - 不接数据库、不调用模型、不做复杂视觉。
- **涉及文件**
  - `src/web/design-system/tokens.ts`
  - `src/web/app/_design/wireframes/`（占位页）
  - `docs/product/ui-component-inventory.md`（组件清单）
- **数据库迁移**
  - 无。
- **自动测试**
  - 设计 Token 可访问性测试（对比度）；
  - 线框页面 Playwright 截图回归；
  - 禁止项扫描（如蓝紫色值、粒子类名）。
- **验收标准**
  - 设计 Token 文档化；
  - P0 页面均有低保真线框；
  - 组件清单覆盖 Button、StatusBadge、BookCard、TaskCard、CandidatePanel、AgentRunSummary 等；
  - 无 AI 科技风元素；
  - 移动端不横向溢出。
- **失败回滚方式**
  - 删除 `src/web/design-system` 与 `src/web/app/_design`；不影响后续阶段。

### Phase 1：初始化 Next.js、Docker、数据库和基础设施

- **实现内容**
  - 初始化 Next.js 项目（App Router，不安装过多依赖）；
  - 补齐 `deploy/Caddyfile`、`deploy/web.Dockerfile`、`deploy/worker.Dockerfile`；
  - 修正 `docker-compose.yml` 中 worker/scheduler 为 Node 命令；
  - 创建 `db/init/002_roles_and_grants.sql`；
  - 新增 `db/init/003_event_types_registry.sql`；
  - 新增 `db/init/004_public_contents.sql`；
  - 定义 `StorageAdapter`、`OutboxConsumer`、`ProjectionApplier`、`EgressGuard`、`LanguageValidator`、`CostCircuitBreaker` 接口；
  - 建立 `.env` 生成脚本；
  - 制定迁移与种子文件命名规范。
- **涉及文件**
  - `package.json`、`tsconfig.json`、`next.config.js` 等 Next.js 初始化文件
  - `deploy/Caddyfile`
  - `deploy/web.Dockerfile`
  - `deploy/worker.Dockerfile`
  - `docker-compose.yml`
  - `docker-compose.override.yml`
  - `db/init/002_roles_and_grants.sql`
  - `db/init/003_event_types_registry.sql`
  - `db/init/004_public_contents.sql`
  - `src/shared/types/`
  - `src/worker/storage/storage-adapter.ts`
  - `src/worker/egress/egress-guard.ts`
  - `src/worker/validators/language-validator.ts`
  - `src/worker/cost/cost-circuit-breaker.ts`
  - `src/server/domain/`
  - `src/server/db/`
  - `scripts/bootstrap.sh`
  - `.env.example`（追加 Storage、备份、成本阈值变量）
- **数据库迁移**
  - `002_roles_and_grants.sql`：创建 `app_rw`、`worker_candidate_rw`、`scheduler_jobs_rw`、`approval_event_writer`、`readonly_analytics` 并授权；
  - `003_event_types_registry.sql`：创建 `event_types` 表，修改 `event_ledger` 增加外键；
  - `004_public_contents.sql`：创建 `public_contents` 表及索引。
- **自动测试**
  - 集成测试：运行 `docker compose up --build` 能成功启动所有服务；
  - 角色权限测试：Worker 账户不能 INSERT `event_ledger`，能 INSERT `candidate_events`；
  - 单元测试：各基础设施接口可被 mock 实现；
  - Schema 测试：`event_ledger.event_type` 外键阻止未注册类型；
  - 测试：`public_contents` 可插入并关联内部实体。
- **验收标准**
  - `docker compose up` 不报错；
  - `web` 响应 `/api/health`；
  - `worker` 响应 healthcheck；
  - `scheduler` 使用 `approval_event_writer` 连接；
  - PostgreSQL 角色按最小权限生效；
  - `event_types` 与 `public_contents` 表可用。
- **失败回滚方式**
  - 删除新建文件，回滚到 `001_agent_native_schema.sql`；
  - `docker compose down -v` 清除数据卷。

### Phase 1B：静态 UI Shell

- **实现内容**
  - 基于 Phase 0A 设计 Token 实现高保真静态页面；
  - 前台 Header/Footer、首页、书籍列表/详情、任务列表/详情；
  - 参与者中心：我的任务、提交交付物；
  - 管理后台 Shell、候选审批页、Agent 运行详情页；
  - 提取并冻结基础组件（Button、StatusBadge、BookCard、TaskCard 等）；
  - 使用假数据，不接数据库，不调用模型。
- **涉及文件**
  - `src/web/app/(public)/...`
  - `src/web/app/(participant)/...`
  - `src/web/app/(admin)/...`
  - `src/web/components/ui/...`
  - `src/web/components/business/...`
- **数据库迁移**
  - 无。
- **自动测试**
  - Playwright 截图回归：P0 页面在桌面和移动端一致；
  - 组件测试：Button、Badge、Card、Table、Dialog；
  - 禁止项扫描：无蓝紫渐变、无粒子背景、无机器人头像等。
- **验收标准**
  - 所有 P0 页面可静态访问；
  - UI 符合设计 Token；
  - 候选审批页三栏信息完整；
  - 移动端不横向溢出；
  - 无禁止项。
- **失败回滚方式**
  - 删除 `src/web/app/(public)`、`src/web/app/(participant)`、`src/web/app/(admin)` 与组件目录；保留设计 Token。

### Phase 2：Actor / 认证 / 项目骨架

- **实现内容**
  - Actor 注册（人、Agent、System、Scheduler）；
  - 邀请制 + 邮箱密码认证；
  - 管理员生成一次性邀请链接（可限定邮箱、角色、有效期，默认 7 天）；
  - 管理员可直接创建内部账号；
  - 项目、作品、工作对象 CRUD；
  - 基础审计日志写入；
  - Domain Service 第一个版本。
- **涉及文件**
  - `src/web/app/api/auth/...`
  - `src/web/app/api/invitations/...`
  - `src/web/app/api/projects/...`
  - `src/web/app/api/works/...`
  - `src/web/server/domain/actor-service.ts`
  - `src/web/server/domain/project-service.ts`
  - `src/web/server/domain/invitation-service.ts`
  - `src/web/server/lib/auth.ts`
  - `src/web/server/lib/db.ts`
- **数据库迁移**
  - 新增 `invitations` 表；
  - 补充种子数据（System Actor、初始管理员）。
- **自动测试**
  - 单元测试：密码哈希、Session/JWT 签发、邀请链接生成与过期；
  - 集成测试：Actor 创建、项目创建、审计日志记录；
  - 权限测试：未持有有效邀请链接无法注册；
  - 权限测试：非管理员无法生成邀请链接。
- **验收标准**
  - 管理员可生成邀请链接；
  - 受邀用户在有效期内可用链接注册；
  - 管理员可直接创建内部账号；
  - 可创建项目；
  - 每条写操作产生 audit_log。
- **失败回滚方式**
  - 回滚相关提交；数据库数据可清空后重跑种子。

### Phase 3：任务 / 交付物 / 事件总账

- **实现内容**
  - 任务 CRUD、申请、分配；
  - 交付物提交（支持文本 + 最小文件上传，本地文件系统 Storage Adapter）；
  - Domain Service：统一生成 `deliverable.submitted` 等正式事件；
  - idempotency key 生成与校验；
  - 事件不可变测试；
  - `event_types` 注册表种子。
- **涉及文件**
  - `src/web/app/api/tasks/...`
  - `src/web/app/api/deliverables/...`
  - `src/web/server/domain/task-service.ts`
  - `src/web/server/domain/deliverable-service.ts`
  - `src/web/server/domain/event-service.ts`
  - `src/worker/storage/fs-storage-adapter.ts`
- **数据库迁移**
  - 无表结构变更（已在 Phase 1 完成）；
  - 增加 `deliverables` 相关索引；
  - 种子 `event_types` 已知事件类型。
- **自动测试**
  - 集成测试：同一 idempotency_key 重复提交只产生一条 event；
  - 数据库测试：UPDATE/DELETE `event_ledger` 触发器必须抛异常；
  - 投影测试：提交交付物后对应任务状态投影更新；
  - 外键测试：未注册 `event_type` 无法写入 `event_ledger`。
- **验收标准**
  - 能完整创建任务并提交交付物；
  - `event_ledger` 正确记录 `deliverable.submitted`；
  - 重复请求被拦截；
  - 事件不可更新/删除；
  - 文件上传生成 SHA-256 并只存引用。
- **失败回滚方式**
  - 回滚服务代码；保留 Schema；清空事件数据后重跑测试。

### Phase 4：Agent 登记 / Job 队列 / 触发规则

- **实现内容**
  - Agent Definition / Agent Version / Prompt Version / Model Config 管理；
  - 种子：Mock 模型配置 + Prompt 版本 + Agent 版本；
  - `agent_trigger_rules` 种子：把 `deliverable.submitted` 映射到 `review.precheck`；
  - 事件触发器：正式事件入账后根据规则生成 `agent_jobs`；
  - Job 领取逻辑：`FOR UPDATE SKIP LOCKED`。
- **涉及文件**
  - `src/web/app/api/agents/...`
  - `src/web/server/domain/agent-service.ts`
  - `src/web/server/domain/agent-trigger-service.ts`
  - `db/seeds/001_seed_agent_rules.sql`
- **数据库迁移**
  - 无表结构变更；补充种子数据。
- **自动测试**
  - 集成测试：提交交付物后自动生成 `review.precheck` job；
  - 并发测试：多个 Worker 同时领取 Job 不重复；
  - 权限测试：Worker 账户只能读业务表，不能写 event_ledger。
- **验收标准**
  - `deliverable.submitted` 自动产生 `agent_jobs`（status=queued）；
  - Worker 能安全领取并标记 running；
  - Job 不重复执行。
- **失败回滚方式**
  - 删除触发规则种子；清空 `agent_jobs`。

### Phase 5：Worker 模型适配 / 候选事件 / 安全防线

- **实现内容**
  - Node Worker 主循环；
  - `ModelAdapter` 接口与 **Mock 适配器**（首期）；Kimi 适配器预留；
  - Prompt 组装（系统指令 + 不可信数据块隔离）；
  - 输出 JSON Schema 校验；
  - 中文 CJK 比例校验（`LanguageValidator`）；
  - Egress 分级检查与 `egress_manifest`（`EgressGuard`）：
    - 每个模型 Endpoint 必须显式登记 `provider_region`/`data_processing_region`；
    - 首期默认中国大陆 Endpoint；
    - 禁止运行时自动切换区域；
    - restricted 必须具名授权；
    - forbidden 永久禁止出站；
  - 成本熔断（`CostCircuitBreaker`）；
  - 写入 `agent_runs`、`candidate_events`、`egress_access_logs`；
  - 失败时写入 `operational_event_outbox`。
- **涉及文件**
  - `src/worker/app/worker.ts`
  - `src/worker/adapters/model-adapter.ts`
  - `src/worker/adapters/mock-adapter.ts`
  - `src/worker/adapters/kimi-adapter.ts`（预留）
  - `src/worker/prompts/review-precheck-v1.ts`
  - `src/worker/validators/schema-validator.ts`
  - `src/worker/validators/language-validator.ts`
  - `src/worker/egress/egress-guard.ts`
  - `src/worker/cost/cost-circuit-breaker.ts`
- **数据库迁移**
  - 可选：增加 `candidate_events` 的 `idempotency_key` 唯一索引（若 Worker 重试需要）。
- **自动测试**
  - 单元测试：Prompt 注入样本不执行；
  - 单元测试：`forbidden` egress_class 阻止调用；
  - 单元测试：英文 `feedback_draft` 校验失败；
  - 单元测试：未配置成本阈值时真实模型 Adapter 拒绝初始化；
  - 单元测试：模型 Endpoint 区域未登记时拒绝调用；
  - 集成测试：Worker 跑通 review.precheck 并写入 candidate_events；
  - 失败测试：模型失败写入 operational_event_outbox。
- **验收标准**
  - Worker 领取 job 后调用 Mock 模型；
  - 输出符合 `review_precheck_output_schema_v0.2.json`；
  - `contains_external_content=true` 的 candidate 无法被自动批准（DB 约束 + 服务校验）；
  - forbidden 内容阻止出站并生成 `agent.egress_blocked` 事件；
  - 失败不直接写 event_ledger，而是写 outbox。
- **失败回滚方式**
  - 回滚 Worker 代码；清空 `agent_runs`/`candidate_events`/`egress_access_logs`/`operational_event_outbox`。

### Phase 6：审批服务 / 状态投影 / 第一条闭环

- **实现内容**
  - 人工审批 API：`POST /api/candidates/{id}/approve|reject|modify`；
  - 审批事务：锁定 candidate → 验证 → 插入正式 event → 更新 projection → 更新 candidate → 更新 `reviews` 读模型 → 写 audit_log；
  - `reviews` 读模型由 Domain Service 在正式事件写入事务中维护；
  - Projection Applier 提供幂等重建。
- **涉及文件**
  - `src/web/app/api/candidates/...`
  - `src/web/server/domain/approval-service.ts`
  - `src/web/server/domain/projection-applier.ts`
  - `src/web/server/domain/review-projection-service.ts`
- **数据库迁移**
  - 无表结构变更。
- **自动测试**
  - E2E：完整跑通第一条闭环；
  - 单元测试：审批事务原子性；
  - 集成测试：外部内容 candidate 自动批准请求被拒绝；
  - 集成测试：`reviews` 读模型与正式事件、projection、candidate、approval 在同一事务更新；
  - 集成测试：operational_event_outbox 被 Scheduler/Outbox Consumer 转为正式事件。
- **验收标准**
  - 第一条闭环完全跑通：

    ```
    创建任务
    → 用户提交交付物
    → deliverable.submitted 正式事件
    → review.precheck Agent Job
    → Worker 调用模型
    → candidate_event
    → 人工审批
    → 正式验收事件
    → 状态投影更新
    → reviews 读模型同步更新
    ```

  - 审批后 `state_projections` 反映最新任务状态；
  - 失败入账事件可见。
- **失败回滚方式**
  - 回滚审批服务代码；保留事件总账；通过重放/更正事件修复投影。

### Phase 7：Scheduler / Outbox 消费 / 备份

- **实现内容**
  - Scheduler 主循环读取 `schedules` 表；
  - 生成日报/周报/GEO 测试/备份 Job；
  - Outbox Consumer：使用 `approval_event_writer` 连接将 `operational_event_outbox` 转为正式事件；
  - 备份脚本：pg_dump + 上传版本化 S3；恢复脚本；
  - 本地默认关闭自动备份，但脚本必须可用；
  - 备份结果写入事件总账。
- **涉及文件**
  - `src/worker/app/scheduler.ts`
  - `src/worker/app/outbox-consumer.ts`
  - `scripts/backup.sh`
  - `scripts/restore.sh`
- **数据库迁移**
  - 无。
- **自动测试**
  - 集成测试：Scheduler 按计划创建 Job；
  - 集成测试：Outbox Consumer 将 pending 记录转为正式事件；
  - 集成测试：备份失败产生正式异常事件；
  - 集成测试：备份成功产生事件；
  - 恢复测试：从备份恢复后事件数量一致。
- **验收标准**
  - Scheduler 启动并产生第一个周期 Job；
  - Outbox Consumer 不遗漏 pending 记录；
  - 备份脚本可运行；
  - 恢复脚本可运行；
  - 备份失败入账。
- **失败回滚方式**
  - 禁用 Scheduler 容器；清空 `schedules` 测试数据。

### Phase 8：前台与后台数据化

- **实现内容**
  - 将 Phase 1B 静态 UI Shell 接入 Domain Service；
  - 前台：首页、书籍、任务、我的任务、提交交付物；
  - 后台：候选审批、Agent 运行详情、事件总账查询；
  - 状态摘要、错误分类、二次确认等交互细节。
- **涉及文件**
  - `src/web/app/(public)/...`
  - `src/web/app/(participant)/...`
  - `src/web/app/(admin)/...`
- **数据库迁移**
  - 无。
- **自动测试**
  - Playwright E2E：访客浏览书籍、任务；
  - Playwright E2E：登录后提交交付物；
  - Playwright E2E：管理员审批 candidate；
  - 权限测试：非管理员无法访问后台。
- **验收标准**
  - 前台三区可访问且数据真实；
  - 参与者能完成“查看任务 → 提交交付物”；
  - 管理者能在同一页面看见原始要求、交付物、Agent 候选与证据并作出裁决；
  - UI 符合设计 Token，无 AI 科技风。
- **失败回滚方式**
  - 回滚数据获取层代码；保留静态 UI 组件。

### Phase 9：管理后台扩展 / 审计 / Agent 管理

- **实现内容**
  - 项目/任务/交付物管理后台；
  - Agent / Prompt / Model Config 版本管理；
  - 邀请链接管理；
  - 审计日志；
  - 基础统计。
- **涉及文件**
  - `src/web/app/(admin)/...`
- **数据库迁移**
  - 无。
- **自动测试**
  - E2E：Agent 版本不可热改；
  - E2E：查看审计日志；
  - 权限测试：非管理员无法访问后台。
- **验收标准**
  - 负责人无需微信即可闭环验收；
  - 历史版本可查；
  - Agent 运行记录可追溯；
  - 邀请链接可管理。
- **失败回滚方式**
  - 回滚前端代码；保留数据。

### Phase 10：备份恢复演练 / 监控 / MFA / 云部署准备

- **实现内容**
  - 恢复演练脚本执行；
  - Worker 心跳、Job 积压、备份失败告警；
  - 模型费用统计；
  - 管理员 MFA 方案选型与接入计划；
  - 云部署清单（域名、ICP、对象存储、HTTPS）。
- **涉及文件**
  - `scripts/restore-test.sh`
  - `deploy/prod.Caddyfile`
  - `docs/architecture/deployment_checklist.md`
- **数据库迁移**
  - 无。
- **自动测试**
  - 恢复测试：从 pg_dump 恢复后事件数量一致；
  - 投影重建测试：使用 Replay 重建状态。
- **验收标准**
  - 可执行一次恢复演练；
  - 事件总账数量与哈希一致；
  - Replay 不产生模型调用；
  - 管理员 MFA 方案明确。
- **失败回滚方式**
  - 保留本地开发环境；云部署失败不影响已有数据。

---

## 7. 第一条闭环详细流程

第一条必须跑通的闭环固定如下：

```
创建任务
  └─ 调用 POST /api/tasks
     Domain Service 生成 task.created 正式事件
        ↓
用户提交交付物
  └─ 调用 POST /api/tasks/{id}/deliverables
     Domain Service 生成 deliverable.submitted 正式事件
        ↓
触发 agent_trigger_rules
  └─ 规则：event_type = 'deliverable.submitted'
     job_type = 'review.precheck'
     agent_version_id = <delivery-reviewer-mock@v1>
        ↓
生成 agent_jobs 记录（status = 'queued'）
        ↓
Worker 通过 FOR UPDATE SKIP LOCKED 领取 Job
        ↓
Worker 执行：
  - 加载 Agent 版本、Prompt 版本、Model Config（Mock 模型）
  - EgressGuard 计算 egress_manifest
    - 检查每个模型 Endpoint 的 provider_region / data_processing_region
    - 首期默认中国大陆 Endpoint
    - 禁止运行时自动切换区域
    - 若最高等级 = forbidden → 写入 agent.egress_blocked 到 operational_event_outbox
  - 调用 ModelAdapter（Mock）
  - 解析输出并通过 JSON Schema 校验
  - LanguageValidator 执行中文校验
  - CostCircuitBreaker 检查成本阈值
  - 写入 agent_runs
        ↓
写入 candidate_events
  - proposed_event_type = 'review.recommended'
  - contains_external_content = true（因来自交付物）
  - auto_approval_eligible = false（由 DB 约束强制）
        ↓
人工在管理后台审批 candidate
  - 选择 approve / reject / modify
  - 同一数据库事务内：
    1. 锁定 candidate
    2. 验证未处理
    3. 插入正式事件（如 review.passed / review.rework）
    4. 更新 state_projections
    5. 将 candidate 标记为 applied
    6. 更新 reviews 读模型
    7. 写 audit_log
        ↓
状态投影更新
  - task 状态变为 accepted / rework 等
        ↓
前台“我的任务”展示最新状态
```

---

## 8. 待裁决问题（剩余）

以下问题仍未冻结，需你进一步裁决：

1. **Kimi 真实模型启用后的具体 Endpoint 与 region？**
   - A. 由你在 Phase 5 前提供具体 URL、provider_region、data_processing_region；
   - B. 使用 Moonshot AI 官方默认 Endpoint（中国大陆）。

2. **生产备份的 S3 兼容对象存储厂商？**
   - A. 阿里云 OSS；
   - B. 腾讯云 COS；
   - C. AWS S3；
   - D. 其他（请指定）。

3. **管理员 MFA 方案？**
   - A. TOTP（Google Authenticator / Authy）；
   - B. WebAuthn / Passkey；
   - C. 短信验证码；
   - D. 上线前再定，先预留接口。

---

## 9. 结论

当前项目已有完整的产品愿景、UI 规范、技术规格和数据库骨架。经最终人工裁决后，技术栈已冻结为 **TypeScript/Node 全栈（Next.js App Router + Node Worker/Scheduler）**，使用 **Drizzle ORM** 但保留 **SQL 文件作为迁移权威来源**。

关键基础设施缺口（数据库角色、Dockerfile、`event_types`、`public_contents`、Domain Service、Outbox Consumer、Projection Applier、EgressGuard、LanguageValidator、CostCircuitBreaker、StorageAdapter）已纳入 **Phase 1** 补齐清单。第一条闭环将使用 **Mock 模型**在 **Phase 6** 跑通，真实模型 **Kimi** 在闭环验证后启用。

开发顺序已最终调整为：

```
Phase 0A：UI 规范/线框/Token/组件清单
→ Phase 1：Next.js/Docker/数据库/基础设施
→ Phase 1B：静态 UI Shell
→ Phase 2：认证与项目骨架
→ Phase 3：任务/交付物/事件总账
→ Phase 4：Agent/Job/触发规则
→ Phase 5：Worker/候选事件/安全防线
→ Phase 6：审批/投影/第一条闭环
→ Phase 7：Scheduler/Outbox/备份
→ Phase 8：前后台数据化
→ Phase 9：后台扩展/审计/Agent管理
→ Phase 10：恢复演练/监控/MFA/云部署
```

**请你审阅修订后的计划及第 8 节剩余问题，确认后即可进入 Phase 0A。**
