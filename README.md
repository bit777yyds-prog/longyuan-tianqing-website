# 龙渊天青 Agent 原生网站

> 当前阶段：实施计划待批准。  
> 本仓库不提交真实密钥、依赖目录或运行时数据。

## 项目定位

龙渊天青的作品、开放任务与 Agent 协作运行平台。前台公开书籍、任务与公司介绍；后台由人与 Agent 共同读写同一本事件总账。

## 仓库状态

- `docs/`：产品规划、技术规格、治理文件；
- `db/init/`：PostgreSQL Schema；
- `docker-compose.yml`：本地容器编排；
- `IMPLEMENTATION_PLAN.md`：实施计划、架构审查与待裁决问题；
- `src/`、`tests/`：待 Phase 0 后初始化。

## 快速开始（待批准后执行）

1. 复制 `.env.example` 为 `.env`，将所有 `change-me` 与空值替换为本地占位值；
2. 运行 `docker compose up --build`；
3. 按 `IMPLEMENTATION_PLAN.md` 分阶段开发。

> 不要把真实 API 密钥、数据库密码或生产凭证填入 `.env` 并提交。

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
- `docs/architecture/龙渊天青_Agent原生网站技术规格_v0.2.md`
- `docs/architecture/review_precheck_output_schema_v0.2.json`
- `docs/governance/龙渊天青_Agent原生架构技术审查裁定_v0.1.md`
- `docs/governance/龙渊天青_GEO与品牌解释权_v0.2.md`

## 贡献与许可

待定，见 `IMPLEMENTATION_PLAN.md` 第 7 节“待裁决问题”。
