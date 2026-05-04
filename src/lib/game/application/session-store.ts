import fs from "fs";
import path from "path";
import { pipelineWarn } from "@/lib/game/adapters/llm-pipeline-log";
import { makeLlm } from "@/lib/game/adapters/llm";
import { loadAppLlmConfig, resolvedPrimaryTemperature, resolvedRepairTemperature } from "@/lib/game/application/app-config";
import { sessionDir } from "@/lib/game/config";
import { defaultConfig } from "@/lib/game/config";
import type { EngineSnapshot } from "@/lib/game/narrative/engine";
import { NarrativeEngine } from "@/lib/game/narrative/engine";

export const SESSION_COOKIE = "mya_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function sessionPath(sid: string): string {
  return path.join(sessionDir(), `${sid}.json`);
}

export function ensureSessionDir(): void {
  fs.mkdirSync(sessionDir(), { recursive: true });
}

export function attachDefaultLlmTemperatureSource(eng: NarrativeEngine): void {
  eng.setLlmTemperatureSource(() => ({
    primary: resolvedPrimaryTemperature(),
    repair: resolvedRepairTemperature(),
  }));
}

export function loadEngine(sid: string): NarrativeEngine {
  ensureSessionDir();
  const p = sessionPath(sid);
  if (!fs.existsSync(p)) {
    const eng = new NarrativeEngine({ config: defaultConfig(), llm: makeLlm(loadAppLlmConfig()) });
    attachDefaultLlmTemperatureSource(eng);
    saveEngine(sid, eng);
    return eng;
  }
  try {
    const snap = JSON.parse(fs.readFileSync(p, "utf-8")) as EngineSnapshot;
    const eng = NarrativeEngine.fromSnapshot(snap, defaultConfig());
    attachDefaultLlmTemperatureSource(eng);
    return eng;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const bak = path.join(sessionDir(), `${sid}.corrupt-${Date.now()}.json.bak`);
    try {
      if (fs.existsSync(p)) fs.renameSync(p, bak);
    } catch (re) {
      console.error(`[session] backup corrupt file failed sid=${sid.slice(0, 8)}`, re);
    }
    pipelineWarn("session_snapshot_json_invalid", {
      sid_prefix: sid.slice(0, 8),
      backup_path: path.basename(bak),
      error: err.slice(0, 200),
    });
    const eng = new NarrativeEngine({ config: defaultConfig(), llm: makeLlm(loadAppLlmConfig()) });
    attachDefaultLlmTemperatureSource(eng);
    saveEngine(sid, eng);
    return eng;
  }
}

export function saveEngine(sid: string, engine: NarrativeEngine): void {
  ensureSessionDir();
  const p = sessionPath(sid);
  fs.writeFileSync(p, JSON.stringify(engine.toSnapshot(), null, 2), "utf-8");
}

export function newSessionId(): string {
  return crypto.randomUUID();
}
