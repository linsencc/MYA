import fs from "fs";
import path from "path";
import { legacyLocationSeedTag } from "@/lib/game/scene/legacy-layout";
import type { SceneRecord, SceneRegistry } from "@/lib/game/scene/types";

const registryCache = new Map<string, SceneRegistry | null>();

/** 无 alias 命中且无 `id: default` 场景文件时的兜底场景（与 `content/scenes/home_living.json` 一致） */
export const SCENE_REGISTRY_FALLBACK_ID = "home_living";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSceneFile(filePath: string): SceneRecord | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const id = String(data.id ?? "").trim();
  if (!id) return null;
  const aliasesRaw = data.aliases;
  const aliases = Array.isArray(aliasesRaw)
    ? aliasesRaw.map((a) => String(a).trim()).filter(Boolean)
    : [];
  return {
    schema_version: Number(data.schema_version ?? 1) || 1,
    id,
    display_name: String(data.display_name ?? id).trim() || id,
    aliases,
    layout_pg_en: String(data.layout_pg_en ?? "").trim(),
    layout_nsfw_en: String(data.layout_nsfw_en ?? "").trim(),
    variants_by_time: isRecord(data.variants_by_time)
      ? Object.fromEntries(
          Object.entries(data.variants_by_time).map(([k, v]) => [k, String(v ?? "").trim()]),
        )
      : undefined,
    venue: isRecord(data.venue)
      ? {
          narrative_tone: String(data.venue.narrative_tone ?? "").trim(),
          allow_risk_choices:
            data.venue.allow_risk_choices === undefined
              ? undefined
              : Boolean(data.venue.allow_risk_choices),
          cg_policy: isRecord(data.venue.cg_policy)
            ? {
                explicit_hint: String(data.venue.cg_policy.explicit_hint ?? "").trim(),
              }
            : undefined,
        }
      : undefined,
    unlock: isRecord(data.unlock)
      ? {
          min_chapter:
            data.unlock.min_chapter === undefined ? undefined : Number(data.unlock.min_chapter),
          min_intimacy:
            data.unlock.min_intimacy === undefined ? undefined : Number(data.unlock.min_intimacy),
          min_desire:
            data.unlock.min_desire === undefined ? undefined : Number(data.unlock.min_desire),
          min_trust:
            data.unlock.min_trust === undefined ? undefined : Number(data.unlock.min_trust),
          required_flag_keys: Array.isArray(data.unlock.required_flag_keys)
            ? data.unlock.required_flag_keys.map((k) => String(k).trim()).filter(Boolean)
            : [],
          forbidden_flag_keys: Array.isArray(data.unlock.forbidden_flag_keys)
            ? data.unlock.forbidden_flag_keys.map((k) => String(k).trim()).filter(Boolean)
            : [],
        }
      : undefined,
    world_travel_id: String(data.world_travel_id ?? "").trim() || undefined,
    travel_label: String(data.travel_label ?? "").trim() || undefined,
    world_travel_order:
      data.world_travel_order === undefined ? undefined : Number(data.world_travel_order),
    world_cg_src: String(data.world_cg_src ?? "").trim() || undefined,
    world_cg_by_time_slot: isRecord(data.world_cg_by_time_slot)
      ? Object.fromEntries(
          Object.entries(data.world_cg_by_time_slot)
            .map(([k, v]) => [k, String(v ?? "").trim()])
            .filter(([, v]) => v),
        )
      : undefined,
    world_card_summary: String(data.world_card_summary ?? "").trim() || undefined,
  };
}

/** 收集场景 JSON：`scenes/<id>/<id>.json`（推荐）或根目录遗留的 `<id>.json`；跳过 `_template`。 */
function listSceneJsonFilePaths(sceneDir: string): string[] {
  const nested: string[] = [];
  const flat: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(sceneDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const ent of entries) {
    if (ent.name === "_template") continue;
    if (ent.isDirectory()) {
      const p = path.join(sceneDir, ent.name, `${ent.name}.json`);
      try {
        if (fs.statSync(p).isFile()) nested.push(p);
      } catch {
        /* no nested scene file */
      }
    } else if (ent.isFile() && ent.name.endsWith(".json") && ent.name !== "_template.json") {
      flat.push(path.join(sceneDir, ent.name));
    }
  }
  return [...nested, ...flat];
}

function buildRegistryFromDir(sceneDir: string): SceneRegistry | null {
  if (!fs.existsSync(sceneDir) || !fs.statSync(sceneDir).isDirectory()) {
    return null;
  }
  const paths = listSceneJsonFilePaths(sceneDir);
  const scenesById = new Map<string, SceneRecord>();
  for (const filePath of paths) {
    const rec = parseSceneFile(filePath);
    if (!rec) continue;
    // 嵌套布局下校验：父目录名应与 JSON 内 id 一致（flat 根目录文件无此约束）
    const parentDir = path.basename(path.dirname(filePath));
    const isNested = path.resolve(path.dirname(filePath)) !== path.resolve(sceneDir);
    if (isNested && rec.id !== parentDir) {
      console.warn(
        `[scene registry] id mismatch: file "${filePath}" declares id "${rec.id}" but parent dir is "${parentDir}". Expected them to match.`,
      );
    }
    if (!scenesById.has(rec.id)) scenesById.set(rec.id, rec);
  }
  if (scenesById.size === 0) return null;

  const aliasEntries: { alias: string; id: string }[] = [];
  for (const scene of scenesById.values()) {
    if (scene.id === "default") continue;
    if (scene.id === SCENE_REGISTRY_FALLBACK_ID && scene.aliases.length === 0) continue;
    for (const alias of scene.aliases) {
      if (alias) aliasEntries.push({ alias, id: scene.id });
    }
  }
  aliasEntries.sort((a, b) => b.alias.length - a.alias.length);

  return { scenesById, aliasEntries };
}

/** 清空缓存（测试或热重载用） */
export function clearSceneRegistryCache(): void {
  registryCache.clear();
}

export function getSceneRegistry(sceneDir: string): SceneRegistry | null {
  const abs = path.resolve(sceneDir);
  if (registryCache.has(abs)) return registryCache.get(abs)!;
  const reg = buildRegistryFromDir(abs);
  registryCache.set(abs, reg);
  return reg;
}

export type ResolvedScene = {
  id: string;
  scene: SceneRecord;
};

export function resolveScene(location: string, registry: SceneRegistry): ResolvedScene {
  const loc = location || "";
  for (const { alias, id } of registry.aliasEntries) {
    if (alias && loc.includes(alias)) {
      const scene = registry.scenesById.get(id);
      if (scene) return { id: scene.id, scene };
    }
  }
  const def =
    registry.scenesById.get("default") ?? registry.scenesById.get(SCENE_REGISTRY_FALLBACK_ID);
  if (def) return { id: def.id, scene: def };
  const first = registry.scenesById.values().next().value;
  if (first) return { id: first.id, scene: first };
  throw new Error("empty scene registry");
}

export function resolveSceneIdForSeed(location: string, sceneDir: string): string {
  const reg = getSceneRegistry(sceneDir);
  if (reg && reg.scenesById.size > 0) {
    return resolveScene(location, reg).id;
  }
  return legacyLocationSeedTag(location);
}
