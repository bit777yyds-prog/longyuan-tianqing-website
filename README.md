# 龙渊天青 Agent 原生网站

> 当前阶段：Phase 1B — 应用骨架与静态 UI Shell 已完成；业务数据与模型调用尚未接入。
> 本仓库不提交真实密钥、依赖目录或运行时数据。

## 项目定位

龙渊天青的作品、开放任务与 Agent 协作运行平台。前台公开书籍、任务与公司介绍；后台由人与 Agent 共同读写同一本事件总账。

## 仓库状态

- `docs/`：产品规划、UI 规范、技术规格、治理文件；
- `db/init/`、 `db/migrations/`：PostgreSQL Schema、角色与迁移（Phase 1A 已冻结）；
- `src/web/`：Next.js App Router 静态 UI Shell；
- `src/worker/`：Node Worker / Scheduler 骨架；
- `src/shared/`：Web / Worker 共享类型；
- `deploy/`：Caddyfile、Dockerfile；
- `docker-compose.yml`：本地容器编排；
- `IMPLEMENTATION_PLAN.md`：实施计划与架构审查；
- `TEST_REPORT.md`：Phase 1A 审计报告。

## 技术栈

- **Web**：Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Worker / Scheduler**：Node.js + TypeScript（同一镜像，不同 `APP_ROLE`）
- **数据库**：PostgreSQL 16（Phase 1A 已落地）
- **网关**：Caddy 2.8
- **包管理器**：pnpm workspace（`src/web`、`src/worker`、`src/shared`）

## 快速开始

1. 复制 `.env.example` 为 `.env`，将 `change-me` 替换为本地占位值；
2. 安装依赖：
   ```bash
   pnpm install
   ```
3. 构建全部包：
   ```bash
   pnpm build
   ```
4. 本地开发：
   ```bash
   pnpm dev:web      # http://localhost:3000
   pnpm dev:worker   # worker stub
   ```
5. 完整容器启动：
   ```bash
   docker compose up --build
   ```
6. 访问 `http://localhost/api/health`。

### 创建首个管理员

全新数据库默认没有管理员，公开注册也保持关闭。容器健康后，仅执行一次：

```bash
docker compose exec \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
  -e BOOTSTRAP_ADMIN_NAME=系统管理员 \
  -e BOOTSTRAP_ADMIN_PASSWORD='ReplaceMe2026Strong' \
  web pnpm bootstrap:admin
```

请先替换示例密码。密码至少 12 位并包含大小写字母和数字。脚本使用数据库事务和 advisory lock；一旦存在有效管理员就会拒绝再次引导，并写入审计日志。

> 不要把真实 API 密钥、数据库密码或生产凭证填入 `.env` 并提交。

## 常用命令

```bash
pnpm typecheck          # 全仓 TypeScript 检查
pnpm test               # Vitest 组件/单元测试
pnpm -F @longyuan/web test:e2e   # Playwright E2E（需先启动 web）
bash scripts/lint-ui-forbidden.sh # UI 禁止项扫描
```

## Phase 1B 完成内容

- Next.js App Router 工程骨架；
- pnpm monorepo（`src/shared`、`src/web`、`src/worker`）；
- Tailwind CSS 设计 Token 与全局样式；
- 10 个 P0 静态页面（首页、书籍列表/详情、任务列表/详情、我的任务、提交交付物、候选审批、Agent 运行详情）；
- 基础 UI 组件与业务组件；
- Worker / Scheduler stub 与健康检查；
- `deploy/Caddyfile`、`deploy/web.Dockerfile`、`deploy/worker.Dockerfile`；
- `docker-compose.yml` 使用 Node 原生健康检查并挂载 `uploads` 卷；
- UI 禁止项扫描、Vitest 组件测试、Playwright E2E 骨架。

## 核心约束

- Agent 不能直接写正式事件；
- Agent 只能写候选事件；
- 外部可控内容永久禁止自动批准；
- 正式事件只增不改；
- Replay 不得重新调用模型；
- forbidden 数据不得发送第三方模型；
- Prompt、Agent 和模型配置不得原地热改；
- 成本超限、模型失败和 dead-letter 必须入账。

## 文档索引

- `docs/product/龙渊天青_网站规划_v0.2.md`
- `docs/product/龙渊天青_网站UI与交互规范_v0.1.md`
- `docs/architecture/龙渊天青_Agent原生网站技术规格_v0.2.md`
- `docs/architecture/review_precheck_output_schema_v0.2.json`
- `docs/governance/龙渊天青_Agent原生架构技术审查裁定_v0.1.md`
- `docs/governance/龙渊天青_GEO与品牌解释权_v0.2.md`

## 贡献与许可

待定，见 `IMPLEMENTATION_PLAN.md` 第 8 节“待裁决问题”。
