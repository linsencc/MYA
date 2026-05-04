import type { GameState } from "@/lib/game/domain/state";
import { getSceneRegistry, resolveScene } from "@/lib/game/scene/registry";

export function buildSceneVenuePromptBlock(state: GameState, sceneDir: string): string {
  const reg = getSceneRegistry(sceneDir);
  if (!reg || reg.scenesById.size === 0) return "";
  let r;
  try {
    r = resolveScene(state.location || "", reg);
  } catch {
    return "";
  }
  const v = r.scene.venue;
  const lines: string[] = [
    "## 当前场景口径（系统）",
    `- 场景 id：${r.id}`,
    `- 地点展示：${r.scene.display_name}`,
  ];
  if (v?.narrative_tone) lines.push(`- 场合与边界：${v.narrative_tone}`);
  if (v && v.allow_risk_choices === false) {
    lines.push("- 本处不宜设计 risk 向裸露或公然性描写选项。");
  }
  const hint = v?.cg_policy?.explicit_hint;
  if (hint) lines.push(`- 出图提示：${hint}`);
  return lines.join("\n");
}
