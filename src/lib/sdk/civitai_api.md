# Civitai 公开 API 参考（对齐官网全文整理 · 中文）

> **范围**  
> 摘录自 [Developer Portal](https://developer.civitai.com)（REST v1、`civitai-py`、AIR）与 [Education：API 下载](https://education.civitai.com/civitais-guide-to-downloading-via-api/)，作离线查阅；与 [本仓库实现](./)（`src/lib/sdk`，TypeScript）交叉引用。  
> **冲突时以官网当前版本为准**；3.1 节记录 Developer Portal 目录与真实 path 的差异。

| 官网主入口 | URL |
|------------|-----|
| Developer Portal | https://developer.civitai.com |
| 公开 REST API v1（完整端点与参数表） | https://developer.civitai.com/docs/api/public-rest |
| Generator Python SDK | https://developer.civitai.com/docs/api/python-sdk |
| AIR（资源 URN） | https://developer.civitai.com/docs/getting-started/ai-resource-identifier |
| 通过 API 下载资源（Education） | https://education.civitai.com/civitais-guide-to-downloading-via-api/ |
| 用户账户（API Key） | https://civitai.com/user/account |
| Streamlit SDK 演示（官网引用） | https://civitai.streamlit.app/ |

---

## 1. 接口分层与入口

| 面 | 数据/行为 | 入口 |
|---|-----------|------|
| REST API v1 | 创作者、图片、模型、版本、标签等只读查询 | `GET https://civitai.com/api/v1/...` |
| 下载 API | 按 `modelVersionId` 拉取文件；常返回 `3xx` 至预签名 URL；需 token | `GET https://civitai.com/api/download/models/{modelVersionId}`（第 4 节、Education） |
| `civitai-py` | 云端图像生成任务（SDK 方法调用，与 `/api/v1` 无路径级对应） | `civitai.image.create` / `civitai.jobs.*` |

REST v1：官网标注为持续演进，端点集合可能扩展。

---

## 2. 认证（与官网一致）

### 2.1 API Key

在 [用户账户设置](https://civitai.com/user/account) 创建 **API Key**。

### 2.2 调用公开 REST v1

[Public REST API](https://developer.civitai.com/docs/api/public-rest) 支持的两种等价方式：

- `Authorization: Bearer {api_key}`
- `?token={api_key}`

### 2.3 使用 `civitai-py`（[Python SDK](https://developer.civitai.com/docs/api/python-sdk)）

设置环境变量（官网示例为 Unix）：

```bash
export CIVITAI_API_TOKEN=<your token>
```

Windows PowerShell：`$env:CIVITAI_API_TOKEN="你的token"`  
Windows cmd：`set CIVITAI_API_TOKEN=你的token`

### 2.4 下载文件（[Education 指南](https://education.civitai.com/civitais-guide-to-downloading-via-api/)）

- Query 已存在时追加：`&token=...`；或 Header：`Authorization: Bearer ...`
- 响应：`3xx` → 存储端；客户端需 follow redirects；文件名：`Content-Disposition`
- 教育站示例：`curl -L` + `Authorization: Bearer ...`
- 下载策略由资源作者配置（例如要求登录）

### 2.5 本仓库

除环境变量外，可在项目根目录放置单行文件，文件名由 **`sdk.token_file.DEFAULT_TOKEN_FILENAME`** 定义（与 `sdk.client.ensure_api_token` 一致）。TypeScript：`token-file.ts`。

---

## 3. 公开 REST API v1（与 [官网](https://developer.civitai.com/docs/api/public-rest) 端点对齐）

- **基址**：`https://civitai.com/api/v1`
- 下列各节「查询参数 / 响应字段」为官网表格的中文归纳；完整字段说明与 JSON 样例见对应官网页。

### 3.1 Developer Portal 目录与 path

部分页面目录写作 **`/api/v1/models-versions/...`**（`models` 与 `versions` 之间多 `s`）。实际 HTTP path：

- `https://civitai.com/api/v1/model-versions/:modelVersionId`
- `https://civitai.com/api/v1/model-versions/by-hash/:hash`

---

### 3.2 `GET /api/v1/creators`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/creators` |
| **查询参数** | `limit`（可选，0–200；默认每页 20；**0 表示返回全部创作者**）、`page`、`query`（按用户名筛选） |
| **响应要点** | `items[]`：`username`、`modelCount`、`link`（指向该用户模型列表的 API URL）；`metadata`：`totalItems`、`currentPage`、`pageSize`、`totalPages`、`nextPage`、`prevPage` |

---

### 3.3 `GET /api/v1/images`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/images` |
| **查询参数** | `limit`（0–200，默认 100）、`postId`、`modelId`（模型画廊）、`modelVersionId`（按版本筛选画廊）、`username`、`nsfw`（`None` / `Soft` / `Mature` / `X`；未定义则返回全部）、`sort`（如 Most Reactions、Most Comments、Newest）、`period`（AllTime、Year、Month、Week、Day）、`page` |
| **响应要点** | 单条含：`id`、`url`、`hash`（blurhash）、`width`、`height`、`nsfw`、`nsfwLevel`、`createdAt`、`postId`、`stats`（cry、laugh、like、dislike、heart、comment 等）、`meta`（生成参数）、`username`；`metadata` 含 `nextCursor`、`currentPage`、`pageSize`、`nextPage` 等 |
| **官网 Note** | 2023-07-02 起增加 **cursor** 分页；`metadata.nextPage` 为下一页 URL（分页与 cursor 共用该字段） |

---

### 3.4 `GET /api/v1/models`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/models` |
| **查询参数** | `limit`（**1–100**，默认 100）、`page`、`query`（名称）、`tag`、`username`、`types[]`（枚举：`Checkpoint`、`TextualInversion`、`Hypernetwork`、`AestheticGradient`、`LORA`、`Controlnet`、`Poses`；不指定则返回全部类型）、`sort`（Highest Rated、Most Downloaded、Newest）、`period`、`rating`（**Deprecated**）、`favorites` / `hidden`（**需认证**）、`primaryFileOnly`、`allowNoCredit`、`allowDerivatives`、`allowDifferentLicenses`、`allowCommercialUse`（None / Image / Rent / Sell）、`nsfw`（false 时更安全并隐藏无安全图的模型）、`supportsGeneration`（true 时只返回**支持生成**的模型） |
| **响应要点** | 模型级：`id`、`name`、`description`（HTML）、`type`、`nsfw`、`tags`、`mode`（Archived / TakenDown）、`creator`、`stats`；`modelVersions[]` 含版本 `id`、`name`、`description`、`createdAt`、`downloadUrl`、`trainedWords`、`files`（含 `sizeKB`、`pickleScanResult`、`virusScanResult`、`hashes`、`downloadUrl`、`metadata.fp/size/format` 等）、`images[]`、`stats` 等；列表外有 `metadata` 分页字段 |
| **下载说明** | 官网：下载 URL 使用 **`content-disposition`** 指定文件名；抓取时需启用该头。示例：`wget https://civitai.com/api/download/models/{modelVersionId} --content-disposition`。若资源要求认证：`...?token={api_key}` |

---

### 3.5 `GET /api/v1/models/:modelId`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/models/:modelId` |
| **响应要点（官网字段表）** | `id`、`name`、`description`、`type`（同上枚举）、`nsfw`、`tags`、`mode`、`creator.username` / `creator.image`；`modelVersions[].id` / `name` / `description` / `createdAt` / `downloadUrl` / `trainedWords`；`modelVersions.files.*`（`sizeKB`、`pickleScanResult`、`virusScanResult`、`scannedAt`、`metadata.fp`/`size`/`format`）；`modelVersions.images.*`（`url`、`nsfw`、`width`、`height`、`hash`、`meta`）等 |

---

### 3.6 `GET /api/v1/model-versions/:modelVersionId`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/model-versions/:modelVersionId`（对照 3.1 节） |
| **响应要点（官网字段表摘录）** | `id`、`name`、`description`、`modelId`、`createdAt`、`downloadUrl`、`trainedWords`、`baseModel`、`earlyAccessTimeFrame`、`stats`；嵌套 `model.name` / `model.type`（Checkpoint 等）/ `model.nsfw` / `model.poi` / `model.mode`；`files[]`（含哈希、下载链接、扫描结果等）；`images[]`；官网对 **download** 与 **content-disposition** 的说明同 3.4 |

---

### 3.7 `GET /api/v1/model-versions/by-hash/:hash`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/model-versions/by-hash/:hash` |
| **响应** | 与标准 **model-versions** 单条接口相同 |
| **哈希算法（官网）** | AutoV1、AutoV2、SHA256、CRC32、Blake3 |
| **Note** | 官网：旧文件哈希仍在补全中，**结果可能不完整** |

---

### 3.8 `GET /api/v1/tags`

| 项目 | 内容 |
|------|------|
| **URL** | `https://civitai.com/api/v1/tags` |
| **查询参数** | `limit`（1–200，默认 20；**0 表示全部标签**）、`page`、`query` |
| **响应要点** | `items[]`：`name`、`modelCount`、`link`（指向带该 tag 的 models API）；`metadata` 分页字段同 creators |

---

## 4. 文件下载 URL（REST 文档 + Education 汇总）

| 场景 | URL 模式 |
|------|----------|
| 按 `modelVersionId` | `https://civitai.com/api/download/models/{modelVersionId}` |
| 带 `type` / `format` / `size` / `fp` 等（示例） | `https://civitai.com/api/download/models/{id}?type=Model&format=SafeTensor&size=pruned&fp=fp16&token={api_key}` |

行为：`3xx`、follow redirects、`Content-Disposition`；shell 中含 `&` 的 URL 需引号（Education）。

---

## 5. AIR（AI Resource，与 [官网](https://developer.civitai.com/docs/getting-started/ai-resource-identifier) 对齐）

**规范字符串：**

```text
urn:air:{ecosystem}:{type}:{source}:{id}@{version?}:{layer?}.?{format?}
```

| 段 | 含义（官网） |
|----|----------------|
| `urn` | Uniform Resource Name |
| `air` | Artificial Intelligence Resource |
| `ecosystem` | 生态类型；官网示例含 **`sd1`、`sd2`、`sdxl`** 等 |
| `type` | 资源类型；官网示例含 **`model`、`lora`、`embedding`、`hypernet`** 等 |
| `source` | 来源平台（如 civitai） |
| `id` | 来源侧资源 Id |
| `version` / `layer` / `format` | 可选；`format` 示例：`safetensor`、`ckpt`、`diffuser`、`tensor rt` |

示例（官网同页）：

- `urn:air:sd1:model:civitai:2421@43533`
- `urn:air:sdxl:lora:civitai:328553@368189`
- 其它生态：`urn:air:dalle:model:openai:dalle@2`、`urn:air:gpt:model:openai:gpt@4`、`urn:air:model:huggingface:stabilityai/sdxl-vae`

`civitai.image.create` 的 `model` 与 AIR 文档中的 `type` 片段命名可能不一致；以 [Python SDK](https://developer.civitai.com/docs/api/python-sdk) 与 `AssetType` 为准。

---

## 6. Generator Python SDK（`civitai-py`，与 [官网](https://developer.civitai.com/docs/api/python-sdk) 对齐）

### 6.1 安装与运行环境

```bash
pip install civitai-py
```

- **要求**：Python **3.7+**（官网）
- **认证**：`CIVITAI_API_TOKEN`（见第 2 节）
- **其它资源**：官网提到 **Google Colab Notebook**、**Streamlit Demo**（https://civitai.streamlit.app/）

### 6.2 调用序列（官网）

1. `import civitai`
2. 组装 `options`：`model`（AIR）、`params`（`prompt`、`width`、`height` 等）、可选 `additionalNetworks`、`controlNets`、`callbackUrl`
3. `civitai.image.create(options)`；`wait=False` 时用返回 `token` 轮询 `civitai.jobs.get(token=...)`

### 6.3 `civitai.image.create(options)` 参数表（官网）

| 字段 | 类型 | 说明 |
|------|------|------|
| `model` | string | **必填**。Civitai 模型（AIR） |
| `params.prompt` | string | **必填**。主提示词 |
| `params.negativePrompt` | string | 可选 |
| `params.scheduler` | 枚举 | 可选；取值见官网列表：`EulerA`、`Euler`、`LMS`、`Heun`、`DPM2`、`DPM2A`、`DPM2SA`、`DPM2M`、`DPMSDE`、`DPMFast`、`DPMAdaptive`、`LMSKarras`、`DPM2Karras`、`DPM2AKarras`、`DPM2SAKarras`、`DPM2MKarras`、`DPMSDEKarras`、`DDIM`、`PLMS`、`UniPC`、`Undefined`、`LCM`、`DDPM`、`DEIS` 等 |
| `params.steps` | number | 可选 |
| `params.cfgScale` | number | 可选 |
| `params.width` / `params.height` | number | **必填** |
| `params.seed` | number | 可选 |
| `params.clipSkip` | number | 可选 |
| `callbackUrl` | string | 可选；完成时回调 |
| `additionalNetworks` | Record | 可选；**键为网络 AIR**，值为网络参数 |
| `controlNets` | 数组 | 可选；ControlNet 配置 |

**additionalNetworks 子字段（官网）：**

| 字段 | 说明 |
|------|------|
| `type` | `Lora`、`Hypernetwork`、`TextualInversion`、`Lycoris`、`Checkpoint`、`Vae`、`LoCon` 等 |
| `strength` | LoRA / LoCon 等使用 |
| `triggerWord` | Textual Inversion 使用 |

**controlNets[]（官网）：**

| 字段 | 说明 |
|------|------|
| `preprocessor` | 如 `Canny`、`DepthZoe`、`SoftedgePidinet`、`Rembg` |
| `weight`、`startStep`、`endStep`、`imageUrl` | 可选 |

### 6.4 `civitai.jobs.get`

- `civitai.jobs.get(id=job_id)` / `civitai.jobs.get(token=token)`
- 二者同时给出时：`token` 优先（官网）

### 6.5 `civitai.jobs.query`

- 按属性查询任务集合（示例：`userId`）；可选 **`detailed`** 布尔值获取更详细定义（官网）

### 6.6 `civitai.jobs.cancel`

- 参数：**`jobId`**；取消已调度或运行中的任务（官网）

---

## 7. 行为边界与排障（Education 归纳）

| 现象 / 约束 | 参考 |
|-------------|------|
| REST v1 端点集 | 可能扩展（官网 Introduction） |
| 浏览器侧失败 | 网络面板：`429` 等 |
| 插件 / Notebook | `token` / `?token` 是否注入请求 |
| curl / wget | redirect follow、Authorization |
| 大文件 / 重复拉取 | 小权重本地缓存 + token（Education） |
| 平台反馈 | [Civitai Feedback](https://feedback.civitai.com/)（以官网最新为准） |

---

## 8. 本仓库 `sdk`（非官网）

| 文档 / 路径 | 内容 |
|-------------|------|
| [sdk_guide.md](sdk_guide.md) | `CivitaiClient`、`parse_meta`、`build_job_input`；历史 CLI `generate_from_meta.py` |
| [本目录](./) | `client.ts`、`meta-job.ts`、`from-meta.ts`、`token-file.ts` |

差异：`civitai-py` 客户端可能对 `width`/`height` 校验；本仓库对元数据做 clamp；`jobs` 的 `result` 形态为 `dict | list`，轮询兼容见 `sdk_guide.md`。

---

## 9. 版权声明

Civitai 名称、站点内容与 API 规范归 **Civitai** 所有。使用请遵守 [Civitai 服务条款](https://civitai.com/content/terms) 及官网要求。
