import type { GameState } from "@/lib/game/domain/state";
import type { SceneRecord } from "@/lib/game/scene/types";

export type UnlockResult = { ok: true } | { ok: false; reason: string };

function flagTruthy(flags: Record<string, unknown>, key: string): boolean {
  const v = flags[key];
  if (v === true) return true;
  if (typeof v === "number" && v !== 0) return true;
  if (typeof v === "string" && v.trim() !== "" && v !== "0" && v !== "false") return true;
  return false;
}

export function evaluateSceneUnlock(scene: SceneRecord, state: GameState): UnlockResult {
  const u = scene.unlock;
  if (!u) return { ok: true };

  const minChapter = u.min_chapter ?? 1;
  if (state.chapter < minChapter) {
    return { ok: false, reason: `需要至少第 ${minChapter} 章（当前 ${state.chapter}）` };
  }
  const minInt = u.min_intimacy ?? 0;
  if (state.intimacy < minInt) {
    return { ok: false, reason: `亲密度不足（需 ≥${minInt}）` };
  }
  const minDes = u.min_desire ?? 0;
  if (state.desire < minDes) {
    return { ok: false, reason: `欲望值不足（需 ≥${minDes}）` };
  }
  const minTrust = u.min_trust ?? 0;
  if (state.trust < minTrust) {
    return { ok: false, reason: `信任度不足（需 ≥${minTrust}）` };
  }

  for (const key of u.required_flag_keys ?? []) {
    if (!key) continue;
    if (!flagTruthy(state.flags, key)) {
      return { ok: false, reason: `缺少或未满足 flag：${key}` };
    }
  }
  for (const key of u.forbidden_flag_keys ?? []) {
    if (!key) continue;
    if (flagTruthy(state.flags, key)) {
      return { ok: false, reason: `禁止 flag 已开启：${key}` };
    }
  }

  return { ok: true };
}
