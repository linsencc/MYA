---
name: mya-start-game
description: >-
  Starts the MyA Next.js game locally on GAME_PORT (default 7860): free the port if
  occupied, run npm run start (or npm run dev when debugging), tell the user the URL.
  Use when the user asks to 启动游戏, 打开游戏, run/start the game, local server,
  GAME_PORT, or 7860 without requesting code delivery or verify.
---

# MyA：启动游戏（本地）

用户只想**启动/访问**本地游戏服务、未要求改代码或交付验证时，按本节执行。**改代码后的重启 + `npm run verify`** 见 **`mya-game-service-delivery`** 与 Workspace 规则 **`mya-game-restart-service`**。

## 工作目录

MyA 仓库根目录（含 **`package.json`**、**`scripts/run-next-start.mjs`**）。

## 端口与绑定

- **`GAME_PORT`**：默认 **`7860`**（也可用 **`PORT`**）。
- **`GAME_BIND`**：默认 **`0.0.0.0`**。

启动脚本：`scripts/run-next-start.mjs`。

## 步骤（生产模式，默认）

1. **先停后启**：若 **`GAME_PORT`** 已被占用，先结束占用该端口的 Node 进程，再启动，避免连到旧进程。
   ```powershell
   Get-NetTCPConnection -LocalPort 7860 -ErrorAction SilentlyContinue |
     Select-Object -ExpandProperty OwningProcess -Unique |
     ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
   ```
2. **检查构建是否存在**：若 **`.next/BUILD_ID`** 文件不存在（首次克隆或 `.next` 已被删除），先执行 `npm run build`，**不要** 直接 `npm run start`——否则 `next start` 会因无构建产物 exit 1。
   ```powershell
   if (-not (Test-Path ".next/BUILD_ID")) { npm run build }
   ```
3. **启动**：执行 **`npm run start`**（等价于 **`node scripts/run-next-start.mjs`**，`next start`，生产模式）。
4. **后台**：长时间运行可后台执行。
5. **回复用户**：写明访问地址 **`http://127.0.0.1:<GAME_PORT>`**（默认 **`http://127.0.0.1:7860`**）以及实际端口；若监听 **`0.0.0.0`**，可补充局域网 **`http://<本机IP>:<端口>`**。

## ⚠ 常见陷阱

- **`npm run start` 报 "Could not find a production build in the '.next' directory"**：`.next` 缺失或不完整，先 `npm run build`（或 `npm run verify`）再 start，**不要**直接重试 start。
- **`npm run build` 报 ENOENT（*.nft.json / pages-manifest.json）**：Windows/OneDrive 同步盘竞态。先确认没有进程占用 `.next`（包括旧的 next start），用 `cmd /c "rd /s /q .next"` 强制删除后再 build。

## 开发调试（仅当用户明确要求）

执行 **`npm run dev`**（Next 开发服务器；端口与 **`next dev`** 默认一致，通常与生产的 **7860** 不同）。须在回复里写清实际 Local URL，避免用户误以为仍是 7860。

## 与验证的关系

- **仅启动游戏**：不要求执行 **`npm run verify`**。
- **修改了 `src/`、`package.json` 等并需交付**：必须按 **`mya-game-service-delivery`** 重启并 **`npm run verify`**（退出码 0）。verify 结束后 `.next` 已就绪，**直接** start，不要再删 `.next`。
