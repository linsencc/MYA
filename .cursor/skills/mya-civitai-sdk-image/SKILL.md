---
name: mya-civitai-sdk-image
description: >-
  MyA Civitai image pipeline: npm civitai SDK, REST v1, meta JSON → job_input →
  fromText/poll/download per src/lib/sdk/sdk_guide.md (legacy Python paths in doc).
  Use for CivitaiClient, parse_meta, build_job_input, dry-run, repo-root `.keys` token,
  model-version cache, troubleshooting 403 or missing checkpoint/blobUrl, or
  any code touching src/lib/sdk/.
---

# MyA Civitai SDK（出图）

## 先读文档

1. **`src/lib/sdk/sdk_guide.md`** — 数据流、API 面、约束（仍以 Python 叙述为主，实现已迁 **TypeScript**）  
2. **`src/lib/sdk/civitai_api.md`** — REST 字段与端点（需查表时）

## 环境与 Token

| 项 | 做法 |
|----|------|
| 依赖 | Node 18+，`npm install`（含 **`civitai`** npm 包） |
| Token | `CIVITAI_API_TOKEN` 或仓库根 **`.keys`**；`ensureApiToken()`（**`src/lib/sdk/token-file.ts`**） |

## 选路径

| 场景 | 做法 |
|------|------|
| 库内调用 | **`CivitaiClient`**（**`src/lib/sdk/client.ts`**）+ **`await buildJobInput(raw, client, …)`**（**`src/lib/sdk/from-meta.ts`**）+ **`generateImageAndWait`** + **`downloadUrl`** |
| 只探结构 | **`parseMeta(raw, fmt)`**（**`src/lib/sdk/meta-job.ts`**） |

最小用法（TypeScript；`buildJobInput` 为 **async**）：

```typescript
import { CivitaiClient } from "@/lib/sdk/client";
import { buildJobInput } from "@/lib/sdk/from-meta";
import { ensureApiToken } from "@/lib/sdk/token-file";

ensureApiToken();
const client = new CivitaiClient({ modelVersionCacheDir: "data/cache" });
const job = await buildJobInput(rawDict, client, { metaFormat: "auto" });
const [, blobUrl] = await client.generateImageAndWait(job);
await CivitaiClient.downloadUrl(blobUrl, "data/output/result.png");
```

模块速查：**`client.ts`**（REST、npm `civitai`、`jobInputForJsSdk` 剥离 zod 不接受的字段）、**`from-meta.ts`**、**`meta-job.ts`**。

## 易错点（必查）

- **`buildJobInput` 的 `maxSide`**：默认 1024；`0` 表示不缩放。  
- **非 direct**：`civitaiResources` 里至少一项 **`type: checkpoint`**。  
- **403 / 无网络**：核对 Token；可用 **`data/cache`** 下 `<id>.json`。  
- **角色 / OC 一致性**：见 **`mya-solidified-character-image`**（**`content/characters/`**、**`src/lib/game/character/card-meta.ts`**）。
