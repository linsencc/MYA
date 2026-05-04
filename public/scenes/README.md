# 场景资源（`public/scenes`）

本目录为游戏地点场景的配置与静态背景图，与 `src/lib/game/scene` 中的注册表逻辑对应：每个子目录代表一个场景 id，内含 `<id>.json` 与若干 PNG。

## 核心约定：`id` = 目录名 = 图片前缀

三者必须完全一致，框架以此自动推导路径：

| 层级 | 形式 | 示例 |
|---|---|---|
| 目录名 | `public/scenes/<id>/` | `public/scenes/office/` |
| JSON 主配置 | `<id>/<id>.json`，且内部 `"id"` 字段 = 目录名 | `office/office.json`，`"id": "office"` |
| 默认底图 | `bg_<id>.png` | `bg_office.png` |
| 时段变体 | `bg_<id>_time_<token>.png` | `bg_office_time_morning.png` |
| 天气变体 | `bg_<id>_weather_<token>.png` | `bg_office_weather_rainy.png` |

注册表（`src/lib/game/scene/registry.ts`）仅读取 `<dir>/<dir>.json`；若目录名与 JSON 内 `id` 不一致，启动时会在服务端日志打印 warning。

## 图片文件命名（全 ASCII）

- 默认底图：`bg_<场景id>.png`
- 时段变体：`bg_<场景id>_time_<token>.png`  
  可用 token：`dawn`、`morning`、`noon`、`afternoon`、`golden_hour`、`late_afternoon`、`twilight`、`night`
- 天气变体：`bg_<场景id>_weather_<token>.png`（如 `weather_rainy`）

## 框架侧路径构造（TS）

不要在代码中手写 `/scenes/...`，统一使用 `src/lib/game/cg/public-asset-paths.ts` 导出的辅助函数：

```ts
import { sceneCgDefaultUrl, sceneCgTimeVariantUrl, sceneCgWeatherUrl } from "@/lib/game/cg/public-asset-paths";

sceneCgDefaultUrl("office")                    // "/scenes/office/bg_office.png"
sceneCgTimeVariantUrl("office", "morning")     // "/scenes/office/bg_office_time_morning.png"
sceneCgWeatherUrl("teacher_home", "rainy")     // "/scenes/teacher_home/bg_teacher_home_weather_rainy.png"
```

场景 JSON 内的 `world_cg_src` 与 `world_cg_by_time_slot` 仍可写完整 URL（以 `/` 开头），函数仅用于 TS 代码中；两者约定一致。

## 时段索引对照

`world_cg_by_time_slot` 的键为字符串化的 `time_slot` 数字（`"0"`～`"5"`），与游戏内时段对应：

| 键 | 时段 | 常用图片 token |
|---|---|---|
| `"0"` | 清晨 | `dawn` |
| `"1"` | 上午 | `morning` |
| `"2"` | 中午 | `noon` |
| `"3"` | 下午 | `afternoon` |
| `"4"` | 傍晚 | `golden_hour` |
| `"5"` | 晚上 | `night` |

## 新建场景：JSON 模板

新建 `public/scenes/<场景id>/` 目录，在其中创建 `<场景id>.json`，内容参考下方模板。将 `your_scene_id` 统一替换为实际 id，并与目录名保持一致。

```json
{
  "schema_version": 1,
  "id": "your_scene_id",
  "display_name": "中文展示名40字内",
  "aliases": ["模型可能写的地点子串1", "子串2"],
  "layout_pg_en": "fixed ... english backdrop tags for safe CG",
  "layout_nsfw_en": "",
  "variants_by_time": {
    "傍晚": "optional english fragment appended for this time_of_day"
  },
  "venue": {
    "narrative_tone": "给系统提示用：此处通常发生什么、暧昧与风险边界（短段）",
    "allow_risk_choices": true,
    "cg_policy": {
      "explicit_hint": "可选：提醒模型何时才可 cg_explicit=true"
    }
  },
  "unlock": {
    "min_chapter": 1,
    "min_intimacy": 0,
    "min_desire": 0,
    "min_trust": 0,
    "required_flag_keys": [],
    "forbidden_flag_keys": []
  },
  "world_travel_id": "optional_sidebar_id",
  "travel_label": "侧栏展示名（可选）",
  "world_travel_order": 10,
  "world_cg_src": "/scenes/your_scene_id/bg_your_scene_id.png",
  "world_card_summary": "地点一句氛围说明（侧栏 / 文档用）"
}
```
