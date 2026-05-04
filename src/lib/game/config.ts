import path from "path";
import { contentRoot, dataRoot } from "@/lib/paths";

export type GameConfig = {
  characterJson: string;
  /** `public/characters`：每角色子目录 `<id>/card.json` */
  characterDir: string;
  modelVersionCache: string;
  outputDir: string;
  /** 场景 JSON 目录（`public/scenes`） */
  sceneDir: string;
};

function pathFromEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? path.resolve(raw) : fallback;
}

export function defaultConfig(): GameConfig {
  const content = contentRoot();
  const data = dataRoot();
  const characterDir = pathFromEnv("GAME_CHARACTER_DIR", path.join(content, "characters"));
  return {
    characterDir,
    characterJson: pathFromEnv(
      "GAME_CHARACTER_JSON",
      path.join(characterDir, "char_chen_yue", "card.json"),
    ),
    modelVersionCache: pathFromEnv(
      "GAME_MODEL_VERSION_CACHE",
      path.join(data, "cache"),
    ),
    outputDir: pathFromEnv("GAME_OUTPUT_DIR", path.join(data, "output")),
    sceneDir: pathFromEnv("GAME_SCENE_DIR", path.join(content, "scenes")),
  };
}

/** 槽位存档与 `.runtime` 会话目录：`data/saves` */
export function savesDir(): string {
  return path.join(dataRoot(), "saves");
}

export const sessionDir = (): string => path.join(savesDir(), ".runtime");
