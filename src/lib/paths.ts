import fs from "fs";
import path from "path";

let cachedRepoRoot: string | null = null;

/**
 * Repo root (directory containing this app's `package.json`).
 * Walks up from `process.cwd()` so repo-root `.keys` resolves correctly when
 * the Node cwd is a subfolder or differs from the project root.
 */
export function repoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;
  const override = process.env.MYA_REPO_ROOT?.trim();
  if (override) {
    cachedRepoRoot = path.resolve(override);
    return cachedRepoRoot;
  }
  let dir = path.resolve(process.cwd());
  for (;;) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const j = JSON.parse(fs.readFileSync(pkg, "utf-8")) as { name?: string };
        if (j.name === "mya") {
          cachedRepoRoot = dir;
          return cachedRepoRoot;
        }
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cachedRepoRoot = path.resolve(process.cwd());
  return cachedRepoRoot;
}

/** 旧版单根目录（迁移后可能为空或仅剩杂项） */
export function legacyConfigRoot(): string {
  return path.join(repoRoot(), "config");
}

let legacyLayoutMigrated = false;

/**
 * 将历史 `config/{characters,scene,saves,...}` 迁入 `public/` 与 `data/`（幂等）。
 */
function ensureLegacyLayoutMigration(): void {
  if (legacyLayoutMigrated) return;
  legacyLayoutMigrated = true;

  const repo = repoRoot();
  const legacy = legacyConfigRoot();
  const content = path.join(repo, "public");
  const data = path.join(repo, "data");

  const moveDir = (from: string, to: string) => {
    if (fs.existsSync(to) || !fs.existsSync(from)) return;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    try {
      fs.renameSync(from, to);
    } catch {
      /* ignore cross-device etc. */
    }
  };

  // saves: config/saves 或 config/game/saves → data/saves
  const targetSaves = path.join(data, "saves");
  if (!fs.existsSync(targetSaves)) {
    const flat = path.join(legacy, "saves");
    const nested = path.join(legacy, "game", "saves");
    if (fs.existsSync(flat)) {
      fs.mkdirSync(data, { recursive: true });
      try {
        fs.renameSync(flat, targetSaves);
      } catch {
        /* ignore */
      }
    } else if (fs.existsSync(nested)) {
      fs.mkdirSync(data, { recursive: true });
      try {
        fs.renameSync(nested, targetSaves);
      } catch {
        /* ignore */
      }
    }
  }

  moveDir(path.join(legacy, "characters"), path.join(content, "characters"));
  moveDir(path.join(legacy, "scene"), path.join(content, "scenes"));
  moveDir(path.join(legacy, "model_version_cache"), path.join(data, "cache"));
  moveDir(path.join(legacy, "output"), path.join(data, "output"));

  const oldApp = path.join(legacy, "game", "app-config.json");
  const newApp = path.join(data, "game", "app-config.json");
  if (!fs.existsSync(newApp) && fs.existsSync(oldApp)) {
    try {
      fs.mkdirSync(path.dirname(newApp), { recursive: true });
      fs.renameSync(oldApp, newApp);
    } catch {
      /* ignore */
    }
  }

  // 清空遗留的 config/game（若仅剩空目录）
  try {
    const gameDir = path.join(legacy, "game");
    if (fs.existsSync(gameDir) && fs.readdirSync(gameDir).length === 0) {
      fs.rmdirSync(gameDir);
    }
  } catch {
    /* ignore */
  }
}

/** 人编内容根：`public/`（角色卡、场景 JSON 等，与静态资源同目录） */
export function contentRoot(): string {
  ensureLegacyLayoutMigration();
  return path.join(repoRoot(), "public");
}

/** 运行时数据根：`data/`（存档、缓存、生成 CG 等） */
export function dataRoot(): string {
  ensureLegacyLayoutMigration();
  return path.join(repoRoot(), "data");
}

/**
 * @deprecated 历史路径 `config/`；新代码请用 {@link contentRoot} / {@link dataRoot}。
 * 仍返回仓库下 `config` 目录，供检测遗留文件或外部脚本。
 */
export function configRoot(): string {
  ensureLegacyLayoutMigration();
  return legacyConfigRoot();
}
