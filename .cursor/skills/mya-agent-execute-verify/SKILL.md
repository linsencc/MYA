---
name: mya-agent-execute-verify
description: >-
  Constrains the agent to run verification locally instead of asking the user
  to confirm. Use when changing code, finishing a task, CI, smoke tests, or
  when the user wants delivery closed-loop. Triggers: verify, test, 验证,
  跑一下, 确认能跑, PR, 交付.
---

# MyA：Agent 自行执行与验证（通用）

## 原则

1. **能自己做就不转嫁**：本机可执行终端命令、项目自带脚本、HTTP 冒烟时，**必须由 Agent 执行并看结果**，不要默认让用户「自己打开浏览器 / 自己跑命令」来完成验证。
2. **完成标准要明确**：以**退出码 0**、或脚本明确打印的成功结论为准；失败则先修再交付。
3. **说明不等于做过**：在回复里写「应该没问题」不能替代实际执行。

## 任务结束前

在仓库根目录 `MyA` 下，按改动类型选择验证手段（由近到远）：

| 优先级 | 做法 |
|--------|------|
| 1 | 若存在 **`npm run verify`**（或 **`scripts/verify-game-app.ts`**）：运行后**退出码须为 0**（改 `src/`、Next 游戏或 API 时常用）。 |
| 2 | 若项目有 **`pytest`** / **`python -m pytest`** 约定：对本次改动相关用例执行并全部通过。 |
| 3 | 若无现成脚本：用**最小可重复**方式自证（例如本机 `fetch` 一次、最小 import），并简述命令与结果。 |

## 可跳过自动化验证的情况

仅当同时满足：改动**不可能**影响解释执行路径（例如纯文档、纯注释、与运行无关的静态资源说明），且用户未要求运行时验证。即便如此，若改动了 **verify 脚本自身**，仍应运行该脚本。

## 失败时

- 根据**标准输出 / 标准错误**定位问题，修正后再跑一遍验证。
- 不要将「请你本地跑一下」作为交付步骤，除非环境缺失且 Agent 无法安装（此时说明缺什么、用户需补什么）。

## 与其它 Skill 的关系

- 改 **`src/lib/game`**、**`src/lib/sdk`**、**`src/app`** 或影响 **`npm run start`** 的依赖时，另见 **`mya-game-service-delivery`**（重启服务 + **`npm run verify`**）。
- Workspace 规则 **「改代码后重启游戏服务」** 与上述 game Skill 一致；以规则为强制、本 Skill 为通用习惯。
