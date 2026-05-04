/**
 * 玩法确定性规则回归（无 LLM / 无 Next），由 npm run verify 串联执行。
 */
import assert from "node:assert/strict";
import { arbitrateTrustDeltaForChoiceContext } from "../src/lib/game/domain/choice-delta-arbitration";
import { coldWarRemainingAfterDelta } from "../src/lib/game/domain/cold-war-rules";
import { applyFlagDeltaToFlags } from "../src/lib/game/domain/merge-flag-delta";
import {
  choiceTagSystemPrefixForLlm,
  resolveChoiceTagForPick,
} from "../src/lib/game/narrative/choice-tag-context";
import { parseLlmResponse } from "../src/lib/game/narrative/parser";
import {
  defaultStarterInventoryRow,
  itemCatalogConsumeOnUse,
  POCKET_MONEY_FLAG,
  readPocketMoney,
} from "../src/lib/game/content/item-catalog";
import { tryResolveItemUse } from "../src/lib/game/world/item-use";
import { sanitizeItemUseFlagDelta } from "../src/lib/game/world/item-use-flag-sanitize";
import { tryApplyShopPurchase } from "../src/lib/game/world/shop-purchase";

assert.equal(coldWarRemainingAfterDelta(0, 0, 5), 2, "trust<8 保底 2");
assert.equal(coldWarRemainingAfterDelta(2, -1, 9), 1, "trust 8–11：2→1 保留底限 1");
assert.equal(coldWarRemainingAfterDelta(2, -2, 9), 0, "trust 8–11：一次减净可到 0");
assert.equal(coldWarRemainingAfterDelta(1, -1, 9), 0, "1→0 信任未过线也可归零");
assert.equal(coldWarRemainingAfterDelta(5, -5, 12), 0, "trust≥12 无 floor");
assert.equal(coldWarRemainingAfterDelta(0, 0, 11), 0, "无疏离时不强抬");
assert.equal(coldWarRemainingAfterDelta(1, 0, 11), 1, "仍有疏离时 trust8–11 不低于 1");

const px1 = choiceTagSystemPrefixForLlm(
  "跟随老师做题",
  "choice",
  ["跟随老师做题", "", "", ""],
  ["advance", "advance", "advance", "advance"],
);
assert.match(px1, /标签为「advance」/);

const px2 = choiceTagSystemPrefixForLlm(
  "靠近看笔记",
  "choice",
  ["", "靠近看笔记", "", ""],
  ["advance", "probe", "advance", "advance"],
);
assert.match(px2, /标签为「probe」/);

assert.equal(
  choiceTagSystemPrefixForLlm("自由打字", "custom", ["a", "", "", ""], ["risk", "", "", ""]),
  "",
  "custom 不注入",
);

assert.equal(
  resolveChoiceTagForPick("靠近看笔记", "choice", ["", "靠近看笔记", "", ""], [
    "advance",
    "probe",
    "advance",
    "advance",
  ]),
  "probe",
);
assert.equal(resolveChoiceTagForPick("无此选项", "choice", ["a", "", "", ""], ["advance", "", "", ""]), null);
assert.equal(resolveChoiceTagForPick("a", "custom", ["a", "", "", ""], ["risk", "", "", ""]), null);

const arbRiskCold = arbitrateTrustDeltaForChoiceContext(8, {
  appliedTag: "risk",
  coldWarRemaining: 1,
  inputKind: "choice",
});
assert.equal(arbRiskCold.trustDelta, 2);
assert.equal(arbRiskCold.adjusted, true);

const arbRiskColdNeg = arbitrateTrustDeltaForChoiceContext(-8, {
  appliedTag: "risk",
  coldWarRemaining: 2,
  inputKind: "choice",
});
assert.equal(arbRiskColdNeg.trustDelta, -8);
assert.equal(arbRiskColdNeg.adjusted, false);

const arbAdvanceNoCold = arbitrateTrustDeltaForChoiceContext(-10, {
  appliedTag: "advance",
  coldWarRemaining: 0,
  inputKind: "choice",
});
assert.equal(arbAdvanceNoCold.trustDelta, -6);
assert.equal(arbAdvanceNoCold.adjusted, true);

const arbAdvanceCold = arbitrateTrustDeltaForChoiceContext(-10, {
  appliedTag: "advance",
  coldWarRemaining: 1,
  inputKind: "choice",
});
assert.equal(arbAdvanceCold.trustDelta, -10);
assert.equal(arbAdvanceCold.adjusted, false);

const arbCustom = arbitrateTrustDeltaForChoiceContext(8, {
  appliedTag: "risk",
  coldWarRemaining: 1,
  inputKind: "custom",
});
assert.equal(arbCustom.trustDelta, 8);
assert.equal(arbCustom.adjusted, false);

const arbProbe = arbitrateTrustDeltaForChoiceContext(-10, {
  appliedTag: "probe",
  coldWarRemaining: 0,
  inputKind: "choice",
});
assert.equal(arbProbe.trustDelta, -10);
assert.equal(arbProbe.adjusted, false);
const truncated =
  '{"text":"x","narration":"","choices":["a"],"cg_trigger":true,"cg_explicit":false,"cg_scene":"kne';
const bad = parseLlmResponse(truncated);
assert.equal(bad.ok, false);
assert.ok((bad.parseError ?? "").length > 0);
assert.equal(bad.response.choices[0], "继续");

const flags1: Record<string, unknown> = {
  inventory: [{ id: "homework_folder", name: "作业文件夹", qty: 1, usable: true }],
  phone_threads: [{ id: "a", title: "A", unread: true, lastSnippet: "x" }],
};
applyFlagDeltaToFlags(flags1, {
  inventory: [{ id: "instant_coffee", name: "速溶咖啡", qty: 2, usable: true }],
  colleague_suspicion: true,
});
const inv1 = flags1.inventory as { id: string; qty: number }[];
assert.equal(inv1.length, 2, "inventory merge keeps old + new");
assert.equal(inv1.find((r) => r.id === "homework_folder")?.qty, 1);
assert.equal(inv1.find((r) => r.id === "instant_coffee")?.qty, 2);
assert.equal(flags1.colleague_suspicion, true);

applyFlagDeltaToFlags(flags1, {
  inventory: [{ id: "homework_folder", qty: 0 }],
});
const inv2 = flags1.inventory as { id: string }[];
assert.ok(!inv2.some((r) => r.id === "homework_folder"), "qty 0 removes row");

applyFlagDeltaToFlags(flags1, { inventory: 999 as unknown as number });
const inv3 = flags1.inventory as unknown;
assert.ok(Array.isArray(inv3) && (inv3 as { id: string }[]).some((r) => r.id === "instant_coffee"), "wrong type must not wipe inventory");

applyFlagDeltaToFlags(flags1, {
  phone_threads: [{ id: "a", unread: false, lastSnippet: "read" }],
});
const ph = flags1.phone_threads as { id: string; unread: boolean; lastSnippet: string }[];
assert.equal(ph.find((t) => t.id === "a")?.unread, false);
assert.match(String(ph.find((t) => t.id === "a")?.lastSnippet ?? ""), /read/);

const u1 = tryResolveItemUse({ itemId: "homework_folder", displayName: "作业" });
assert.equal(u1?.trustDelta, 1);
assert.ok((u1?.paragraph ?? "").includes("文件夹"));
assert.equal(tryResolveItemUse({ itemId: "unknown_x", displayName: "x" }), null);

const u2 = tryResolveItemUse({ itemId: "energy_drink", displayName: "饮料" });
assert.equal(u2?.desireDelta, 2);

assert.equal(itemCatalogConsumeOnUse("homework_folder"), false);
assert.equal(itemCatalogConsumeOnUse("instant_coffee"), true);

const san = sanitizeItemUseFlagDelta({ colleague_suspicion: true, not_a_real_story_flag: true });
assert.equal(san.colleague_suspicion, true);
assert.equal(san.not_a_real_story_flag, undefined);

const normFlags: Record<string, unknown> = {
  inventory: [],
};
applyFlagDeltaToFlags(normFlags, { inventory: [{ id: "instant_coffee", qty: 1 }] });
const invNorm = normFlags.inventory as { id: string; name: string }[];
assert.equal(invNorm[0]?.name, "速溶咖啡");

const shopFlags: Record<string, unknown> = {
  [POCKET_MONEY_FLAG]: 30,
  inventory: [defaultStarterInventoryRow()],
};
const shopBad = tryApplyShopPurchase(shopFlags, "nope");
assert.equal(shopBad.ok, false);
const shopPoorFlags: Record<string, unknown> = {
  [POCKET_MONEY_FLAG]: 5,
  inventory: [defaultStarterInventoryRow()],
};
const shopPoor = tryApplyShopPurchase(shopPoorFlags, "shop_instant_coffee");
assert.equal(shopPoor.ok, false);
const shopRich: Record<string, unknown> = {
  [POCKET_MONEY_FLAG]: 30,
  inventory: [defaultStarterInventoryRow()],
};
const shopOk = tryApplyShopPurchase(shopRich, "shop_instant_coffee");
assert.equal(shopOk.ok, true);
assert.equal(readPocketMoney(shopRich), 18);
const invAfter = shopRich.inventory as { id: string; qty: number }[];
assert.ok((invAfter.find((r) => r.id === "instant_coffee")?.qty ?? 0) >= 1);

console.log("OK: gameplay-regression");
