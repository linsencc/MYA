import { CHEN_YUE_CHARACTER_PROMPT, CHEN_YUE_SUPPORTING_CAST_PROMPT } from "@/lib/game/character/chen-yue";

/** 日后多角色时在此按 state.primaryCharacterId 分支 */
export function buildActiveCharacterPromptBlocks(): { character: string; supportingCast: string } {
  return {
    character: CHEN_YUE_CHARACTER_PROMPT,
    supportingCast: CHEN_YUE_SUPPORTING_CAST_PROMPT,
  };
}
