---
name: mya-solidified-character-image
description: >-
  Binds image prompts to repo 固化角色 JSON cards (固化/负面词/配方). Use when
  the user names 固化角色, 女老师 or another OC file, wants consistent face or
  outfit rules, or mixes scene tags with a known 角色卡 (see cardToCustomMeta).
---

# 固化角色（出图人设）

## 硬规则

若用户提到 **本仓库已有** 的角色（名称或 **`content/characters/char_<characterId>/card.json`** 能对应），**禁止**凭记忆编造五官、身材、发色、眼镜、气质。必须先读对应 JSON，再拼 prompt / 追加参数。

匹配方式：按 **`名称`** 字段读 **`content/characters/char_<characterId>/card.json`**（主角目录为 **`char_chen_yue`**，游戏内 id 仍为 **`chen_yue`**）。JSON 内仍用 **`固化`** 等字段名。

## 卡片从哪来

| 文件 | 用途 |
|------|------|
| **`content/characters/char_chen_yue/card.json`** | 已填主角示例；新建角色可复制该文件为骨架再改写 |

## 正向 prompt 拼接顺序

与 **`src/lib/game/character/card-meta.ts`** 中 **`cardToCustomMeta` / `buildPrompt`** 一致：

1. `固化.画风与质量`  
2. `固化.容貌与发型`  
3. `固化.身材与体态`  
4. `固化.气质与年龄感`  
5. **仅场景**：服装、姿势、环境、道具、光（不进 JSON 的「单次」内容）

若卡片有 **`固定配色`** / **`触发词与嵌入`**，按卡片启用。

## 负向 prompt

合并 **`负面提示词_通用`** + **`负面提示词_外貌纠错`**，再按需加场景负面。除非用户明确要求覆盖，否则保留外貌纠错段。

## 参数与尺寸

优先用卡片：**`出图配方_默认值`**、**`分辨率`**、**`clip_skip`**、**`技术辅助.常用_seed`**。scheduler 用 **`normalizeScheduler`**（**`src/lib/sdk/from-meta.ts`**）。

生成器单边上限 1024：**`clampDimensions`**（同上）；自写脚本时行为对齐，避免与文档/SDK 不一致。

## 代码入口

游戏 CG（PG 路径）通过 **`cardToCustomMeta`** 生成 custom meta，再 **`buildJobInput`** → Civitai npm SDK。见 **`src/lib/game/adapters/cg/`**（`index.ts`）。

## 与 meta / SDK 组合

用 **`buildJobInput`** 时：把「固化合并后的整段正向」写进 meta 的 **`prompt`**，负向合并进 **`negativePrompt`**。底模须与卡片 checkpoint（**`模型版本ID`** 等）一致。

通用 SDK 步骤与故障排查见 **`mya-civitai-sdk-image`**。

## 新角色

无现成 JSON 时：复制 **`content/characters/char_chen_yue/card.json`**（或任一 `char_*/card.json`）→ 改写 **`固化`** 与负面等 → 存为 **`content/characters/char_<characterId>/card.json`**（新目录），再用于出图。
