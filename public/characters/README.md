# 角色资源目录（`public/characters`）

每个可玩角色占用**一个子目录**，目录名统一为 **`char_<characterId>`**（与存档、阵容里的 `characterId` 对应；主角 id 仍为 `chen_yue`，目录为 `char_chen_yue`）。

| 目录名 | `characterId` | 内含文件 |
|--------|---------------|----------|
| `char_chen_yue` | `chen_yue`（陈悦） | 必填 `card.json`；可选 `cg_stand.png`、`profile.md` |
| `char_npc_<slug>` | `npc_<slug>` | 同上 |

**新建角色**：可复制 **`char_chen_yue/card.json`**（或任一已有 `char_*/card.json`）到新目录后改字段；子目录名以 **`_`** 开头会被注册表忽略，仅作本地草稿时用。

## 统一命名

| 文件 | 说明 |
|------|------|
| **`card.json`** | Civitai 固化出图卡：`固化`、负面词、配方等，供 `card-meta` 与 CG 管线读取。 |
| **`cg_stand.png`** | 可选。全身立绘 PNG，**建议 RGBA 透明底**；默认维护流程为「紧裁人物外接框」，各角色**像素宽高可不一致**（无左右大块透明边）。 |
| **`profile.md`** | 叙事设定（外貌印象、性格、关系等），**仅给人读**；不参与运行时逻辑。 |

### 立绘 `cg_stand.png` 维护脚本

仓库根目录执行（依赖 **`pip install pillow`**；若要从带背景原图抠图再加 **`pip install rembg`**）：

| 命令 | 作用 |
|------|------|
| `python scripts/strip_public_character_stand_bg.py` | 按 alpha 外接矩形裁掉多余透明边（默认忽略极淡边缘），输出**紧裁图**。 |
| `python scripts/strip_public_character_stand_bg.py --fit-canvas` | 紧裁后再等比装入 **1536×1024** 透明画布（水平居中、底对齐）；会重新出现左右透明，仅在你需要**统一分辨率**时使用。 |
| `python scripts/strip_public_character_stand_bg.py --rembg` | 先 **rembg** 去底，再走默认紧裁（适合替换为未抠图的 PNG）。 |
| `python scripts/strip_public_character_stand_bg.py --alpha-min 0` | 计算外接框时不忽略淡边（默认脚本内为 `12`，发丝被切时可调低）。 |

脚本会扫描全部 `public/characters/char_*/cg_stand.png` 并**原地覆盖**写入。

### 新建角色

1. 确定游戏内 **`characterId`**（主角固定 `chen_yue`；配角为 `npc_xxx`）。
2. 新建目录 **`char_<characterId>`**（例：`char_npc_li_mei`）。
3. 将 **`public/characters/char_chen_yue/card.json`**（或任一现有角色的 `card.json`）复制到该目录并命名为 **`card.json`**，再按需改写 `固化`、负面词等。
4. 可选：放入 **`cg_stand.png`**（全身立绘），并在仓库根运行 `python scripts/strip_public_character_stand_bg.py` 做裁边 / 去底（见上文「立绘维护脚本」）。
5. 可选：同目录添加 **`profile.md`**（结构见下文「档案模板」）。

目录名必须是 **`char_` + 与存档一致的 `characterId`**；`profile.md` 标题可用中文。

## 环境变量（可选）

- `GAME_CHARACTER_DIR`：角色卡根目录，默认 **`public/characters`**（见 `src/lib/game/config.ts` 中 `contentRoot()` + `characters`）。
- `GAME_CHARACTER_JSON`：仅主角默认出图卡，默认 **`public/characters/char_chen_yue/card.json`**。

---

## 档案模板（`profile.md` 可选）

首行标题用 **角色中文名**；元信息指向本目录的 `card.json`。

#### 元信息

> 对应出图卡：`public/characters/char_<characterId>/card.json`  
> 最后更新：YYYY-MM-DD

#### 概览

- **年龄**：
- **身份 / 职业**：
- **与主人公关系**（初识）：

#### 外貌（文字印象）

- 整体印象（身高感、体态、气质）：
- 发型与面部特征：
- 常穿 / 标志性着装（若与 JSON 服装固化一致，写「见 JSON·服装固化」）：
- 配饰或细节：

#### 性格

- 表层（对外、工作场合）：
- 里层（私下、压力下的真实反应）：
- 弱点或底线：
- 说话习惯（称呼、句式）：

#### 背景

- 成长或经历要点（只写叙事会用的）：
- 当前剧情阶段默认处境：

#### 人际关系

- 对主人公：
- 对其他 NPC（如有）：

#### 叙事注意

- 禁止或慎用的人设偏离（OOC）：
- 与数值/章节设计相关的提示（可选）：

#### 备注

（引用立绘参考、声优印象、外部文档链接等。）
