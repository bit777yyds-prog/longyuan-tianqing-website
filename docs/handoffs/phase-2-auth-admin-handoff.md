# Phase 2 Auth 与管理后台交接

更新时间：2026-07-26

## 1. 新对话先做什么

工作目录：

```text
/Users/chuya/Documents/Codex/2026-07-26/k/repo
```

新 Codex 对话应选择允许本地网络访问的权限配置（Full Access / Allow network access）。本轮任务的终端与浏览器均被策略禁止访问 localhost，不能据此判断容器健康。

进入仓库后先执行：

```bash
git status --short
curl -i http://127.0.0.1:3000/api/health
nc -zv 127.0.0.1 5432
```

预期：health 返回 200，Web 与 PostgreSQL 分别监听 `127.0.0.1:3000`、`127.0.0.1:5432`。

不要在交接文件、提交信息或聊天中记录 `.env` 内的真实密码。此前本地 `app_rw` 密码曾出现在聊天中，后续重建开发环境时应轮换。

## 2. Docker 与协作边界

Docker 使用用户级 Colima：

```text
~/.local/bin/docker
~/.local/bin/colima
~/.local/bin/limactl
```

`docker-compose.yml` 已增加仅绑定回环地址的端口：

```text
127.0.0.1:3000 -> web:3000
127.0.0.1:5432 -> postgres:5432
```

不共享 Docker socket，不开放无 TLS 的 Docker TCP API。Colima 通过 Lima SSH 隧道发布端口，`docker compose up -d --build` 后可能需要数秒到一分钟才开始监听。

Claude 已报告并实测：五个容器运行，Web/PostgreSQL healthy，health 200，PostgreSQL 可用 `app_rw` 从宿主端口连接。当前受限 Codex 沙箱无法独立复核这组运行时结果。

## 3. 当前代码状态

分支为 `main`，基线提交：

```text
c619615 ci(docker): wait for worker and scheduler healthchecks
```

Phase 2 的全部改动仍在未提交工作区。不要 reset、checkout 或覆盖现有修改；先读 `git status`，基于当前工作区继续。

主要实现：

- Better Auth 邮箱密码登录与退出。
- 邀请限定邮箱/角色注册，注册与邀请消费同一事务。
- `/admin/*` 管理后台服务端鉴权。
- 遗留 `(admin)` 路由组统一管理员鉴权，未登录重定向 `/login`。
- 邀请列表、创建、一次性注册链接和撤销 API。
- 用户列表、启用/停用 API。
- 停用用户时撤销全部 session 并写审计日志。
- 禁止管理员停用自己。
- 更新用户状态前按 UUID 固定顺序锁定全部有效管理员，防止并发互停导致零管理员。
- 首管理员一次性 bootstrap CLI。

关键文件：

```text
db/migrations/003_phase2_auth_foundation.sql
src/web/server/auth/auth.ts
src/web/server/auth/authorization.ts
src/web/server/auth/encrypted-secondary-storage.ts
src/web/app/api/auth/[...all]/route.ts
src/web/app/api/auth/register/route.ts
src/web/app/api/invitations/route.ts
src/web/app/api/invitations/[id]/route.ts
src/web/app/api/users/route.ts
src/web/app/api/users/[id]/route.ts
src/web/scripts/bootstrap-admin.mjs
src/web/app/admin/layout.tsx
src/web/app/(admin)/layout.tsx
```

## 4. 安全设计

- 邀请和 session 原始 token 不落库。
- Session secondary-storage key 只保存 SHA-256。
- Session JSON 使用 AES-256-GCM 加密后保存。
- `auth_sessions` 保留可审计的 token hash、过期与撤销状态。
- 密码使用 scrypt，参数写入哈希字符串：`N=131072, r=8, p=1`。
- 密码哈希位于 Better Auth `auth_accounts`，不在 `app_users` 双写。
- 认证相关五张表仅 `app_rw` 可读写；worker、scheduler、approval writer、readonly 均被拒绝。
- 管理后台每次请求重新查询用户当前角色与状态，避免 session 中旧角色继续授权。

## 5. 首管理员引导

全新数据库默认没有管理员，Better Auth 公开注册保持关闭。容器健康后仅执行一次：

```bash
docker compose exec \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
  -e BOOTSTRAP_ADMIN_NAME=系统管理员 \
  -e BOOTSTRAP_ADMIN_PASSWORD='ReplaceMe2026Strong' \
  web pnpm bootstrap:admin
```

执行前替换示例密码。脚本要求至少 12 位并包含大小写字母和数字，使用事务与 advisory lock；只要已有有效管理员就拒绝再次运行，并写入 `user.bootstrap_admin` 审计日志。

Claude 的审计测试用户已清理，报告称数据库当前有效管理员数为 0。新对话应先查询确认，再决定创建正式开发管理员或仅创建临时测试管理员。

## 6. 已完成验证

最近一次本地代码验证：

- Web Vitest：12 个文件、37 个测试通过。
- 全仓预期总数：41 个测试（shared 3 + web 37 + worker 1）。
- Web TypeScript typecheck 通过。
- Next.js 生产构建通过。
- Schema 静态门禁通过。
- Deployment path 静态门禁通过。
- UI forbidden scan 通过。
- `bootstrap-admin.mjs` 通过 `node --check`。
- `git diff --check` 通过。

Claude 已完成的真实运行时验证：

- Better Auth 登录返回 200，并设置 HttpOnly/SameSite=Lax cookie。
- `/api/users` 在管理员 session 下返回数据。
- 管理员不能停用自己（409）。
- 停用其他管理员后，目标 session 立即失效并返回 401。
- 已停用用户不能重新登录。
- 邀请权限和五张认证表的最小权限边界通过。
- `/agent-runs/run-001` 未登录由原先 200 修复为 307 跳转 `/login`。

## 7. 新对话建议的运行时验收

在允许 localhost 网络的新 Codex 对话中，依次完成：

1. 验证 health、PostgreSQL 连接和迁移记录。
2. 查询当前有效管理员数量，不假设 Claude 的临时数据状态。
3. 验证 bootstrap 首次成功、第二次被拒绝。
4. 使用临时管理员登录并保存 cookie。
5. 验证 `/admin`、`/admin/invitations`、`/admin/users`。
6. 验证未登录访问 `/agent-runs/run-001` 与 `/candidates/cand-001` 均跳转 `/login`。
7. 验证创建/撤销邀请、邀请注册、重复消费拒绝。
8. 验证用户自停用 409、停用他人后目标 cookie 401。
9. 清理所有临时测试数据，不删除真实用户。
10. 用浏览器检查桌面与移动端布局、控制台错误和横向溢出。

涉及密码或 cookie 的临时文件只能放 `/tmp`，结束时删除；输出中不要回显秘密。

## 8. 已知未完成项

- 管理工作台指标、待处理队列和最近活动仍主要使用 fixture。
- `/admin/users` 暂不支持修改角色，仅支持启用/停用。
- 忘记密码页为 UI，尚未配置邮件发送与真实重置流程。
- 旧 `/agent-runs/[id]`、`/candidates/[id]` 仍是 fixture 详情页，但已经受管理员鉴权保护。
- `POST /api/auth/register` 的 body 大小主要依赖 `content-length` 软限制，可进一步改为流式硬上限。
- Phase 2 工作区尚未整理为提交；不要在未核对范围前直接提交全部文件。

## 9. 给新 Codex 的开场指令

可直接发送：

```text
继续龙渊天青 Phase 2。先阅读 docs/handoffs/phase-2-auth-admin-handoff.md，检查当前未提交工作区，不要覆盖已有改动。当前任务已允许 localhost 网络访问，请先完成第 7 节运行时验收并清理临时数据；发现问题直接修复，最后重跑全仓测试、静态门禁和生产构建。
```
