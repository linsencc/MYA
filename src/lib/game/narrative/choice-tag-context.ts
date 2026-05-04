import type { ChoiceTag } from "@/lib/game/domain/models";

function normalizeChoiceTag(raw: string): ChoiceTag {
  const t = raw.toLowerCase();
  return t === "probe" ? "probe" : t === "risk" ? "risk" : "advance";
}

/** 与选项文案完全匹配时的索引；不匹配返回 null */
function findChoicePickIndex(playerInput: string, lastChoices: string[]): number | null {
  const raw = playerInput.trim();
  if (!raw) return null;
  for (let i = 0; i < 4; i++) {
    if (String(lastChoices[i] ?? "").trim() === raw) return i;
  }
  return null;
}

/**
 * 解析本回合点选对应的 advance | probe | risk（仅 choice 且文案与上一回合选项一致时）。
 */
export function resolveChoiceTagForPick(
  playerInput: string,
  inputKind: "choice" | "custom",
  lastChoices: string[],
  lastTags: string[],
): ChoiceTag | null {
  if (inputKind !== "choice") return null;
  const idx = findChoicePickIndex(playerInput, lastChoices);
  if (idx === null) return null;
  return normalizeChoiceTag(String(lastTags[idx] ?? "advance"));
}

/**
 * 玩家点选与上一回合选项文案完全一致时，为 LLM 注入 advance/probe/risk 说明
 */
export function choiceTagSystemPrefixForLlm(
  playerInput: string,
  inputKind: "choice" | "custom",
  lastChoices: string[],
  lastTags: string[],
): string {
  if (inputKind !== "choice") return "";
  const idx = findChoicePickIndex(playerInput, lastChoices);
  if (idx === null) return "";
  const t = normalizeChoiceTag(String(lastTags[idx] ?? "advance"));
  return (
    `（系统：玩家点选的是上一回合第 ${idx + 1} 项，规则标签为「${t}」：` +
    `advance=稳妥推进，probe=边界试探，risk=冒险；请据此把握分寸与后果；回复仍须完整汉语、勿谜语简写。）\n`
  );
}
