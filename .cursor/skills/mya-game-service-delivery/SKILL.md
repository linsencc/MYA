---
name: mya-game-service-delivery
description: >-
  After editing src/ (game, sdk), package.json, or Next deps: stop port, restart
  Next.js locally, run npm run verify (exit 0). Use when touching game UI, API,
  engine, state, or npm deps. Triggers: GAME_PORT, 7860, 重启游戏, verify, Gradio
  (legacy), Next.
---

# MyA：游戏服务交付（重启 + 冒烟）

与 Workspace 规则 **「改代码后重启游戏服务」** 对齐；本 Skill 供 Agent 检索操作细节。

## 何时必须做

当次任务修改了任意一项时：

- **`src/`** 下游戏相关源码（`src/lib/game`、`src/app`、API 路由等）
- **`package.json`** / **`package-lock.json`** 或其它影响 **`npm run start`** 的依赖

## 必须步骤

1. **工作目录**：MyA 仓库根目录。
2. **先停后启**：若 **`GAME_PORT`**（默认 **7860**）已被本机 Node 占用，先结束对应进程再启动，避免浏览器仍连旧进程。
3. **启动**：`npm run start`（生产）。开发调试可用 `npm run dev`。长时间运行可后台执行。
4. **闭环验证**（不可省略）：在仓库根执行：

```bash
npm run verify
```

须以**退出码 0** 结束（脚本会 `npm run build` + 临时端口 HTTP 冒烟）。失败则先修再交付，**不要**让用户代为确认「网页能否打开」。

5. **回复用户**：说明访问地址（例如 **`http://127.0.0.1:7860`**）与端口（与 **`GAME_PORT`** 一致）。

## 可跳过重启的情况

仅改文档、`.gitignore`、与运行时无关说明，且**不改变** Next 应用行为。若改动了 **`scripts/verify-game-app.ts`**，仍应运行 **`npm run verify`**。

## 与通用 Skill 的关系

通用约束见 **`mya-agent-execute-verify`**；本 Skill 专指 **Next.js 游戏服务** 这一条交付链。

用户**仅要求启动本地游戏**（未涉及改代码交付）时，操作步骤见 **`mya-start-game`**（端口占用处理、`npm run start`、默认 **`http://127.0.0.1:7860`**）。
