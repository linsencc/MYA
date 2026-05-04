/**
 * 将 LLM / 内部的 flag_delta 合并进 state.flags。
 * inventory、phone_threads 为结构化数组：按 id 合并，禁止被 boolean/number/string 整键覆盖写坏。
 */

import { getItemCatalogEntry, normalizeInventoryRow } from "@/lib/game/content/item-catalog";
import { pipelineLog } from "@/lib/game/adapters/llm-pipeline-log";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cloneInventoryRows(flags: Record<string, unknown>): Record<string, unknown>[] {
  const raw = flags.inventory;
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const x of raw) {
    if (!isPlainObject(x)) continue;
    out.push({ ...x });
  }
  return out;
}

function clonePhoneRows(flags: Record<string, unknown>): Record<string, unknown>[] {
  const raw = flags.phone_threads;
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const x of raw) {
    if (!isPlainObject(x)) continue;
    out.push({ ...x });
  }
  return out;
}

function normalizeQty(v: unknown, fallback = 1): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/**
 * 按 id 合并背包行；qty≤0 的行删除。
 */
export function mergeInventoryDelta(flags: Record<string, unknown>, incoming: unknown): void {
  if (incoming === undefined || incoming === null) return;

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of cloneInventoryRows(flags)) {
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    byId.set(id, row);
  }

  if (Array.isArray(incoming)) {
    for (const x of incoming) {
      if (!isPlainObject(x)) continue;
      const id = String(x.id ?? "").trim();
      if (!id) continue;
      const prev = byId.get(id) ?? { id };
      const qty =
        x.qty !== undefined ? normalizeQty(x.qty, 1) : normalizeQty(prev.qty, 1);
      byId.set(id, {
        ...prev,
        ...x,
        id,
        name: x.name !== undefined ? String(x.name).slice(0, 120) : String(prev.name ?? id).slice(0, 120),
        qty,
        usable: x.usable !== undefined ? Boolean(x.usable) : prev.usable !== undefined ? Boolean(prev.usable) : true,
      });
    }
  } else if (isPlainObject(incoming)) {
    for (const [id0, qtyRaw] of Object.entries(incoming)) {
      const id = id0.trim().slice(0, 64);
      if (!id) continue;
      const prev = byId.get(id) ?? { id, name: id, qty: 1, usable: true };
      const qty = normalizeQty(qtyRaw, normalizeQty(prev.qty, 1));
      byId.set(id, { ...prev, id, qty });
    }
  } else {
    return;
  }

  const rows = Array.from(byId.values()).filter((row) => normalizeQty(row.qty, 1) > 0);
  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    if (id && !getItemCatalogEntry(id)) {
      pipelineLog("merge_inventory_unknown_id", { id });
    }
  }
  flags.inventory = rows.map((r) => normalizeInventoryRow(r));
}

/**
 * 按 id 合并手机会话行。
 */
export function mergePhoneThreadsDelta(flags: Record<string, unknown>, incoming: unknown): void {
  if (!Array.isArray(incoming)) return;

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of clonePhoneRows(flags)) {
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    byId.set(id, row);
  }

  for (const x of incoming) {
    if (!isPlainObject(x)) continue;
    const id = String(x.id ?? "").trim();
    if (!id) continue;
    const prev = byId.get(id) ?? { id, title: "消息", unread: false, lastSnippet: "" };
    const title = x.title !== undefined ? String(x.title).slice(0, 120) : String(prev.title ?? "消息").slice(0, 120);
    const lastSnippet =
      x.lastSnippet !== undefined
        ? String(x.lastSnippet).slice(0, 200)
        : String(prev.lastSnippet ?? "").slice(0, 200);
    const unread = x.unread !== undefined ? Boolean(x.unread) : Boolean(prev.unread);
    byId.set(id, { ...prev, id, title, lastSnippet, unread });
  }

  flags.phone_threads = Array.from(byId.values());
}

export function applyFlagDeltaToFlags(
  flags: Record<string, unknown>,
  delta: Record<string, unknown>,
): void {
  for (const [k0, v] of Object.entries(delta)) {
    const k = k0.slice(0, 48);
    if (!k) continue;
    if (k === "inventory") {
      mergeInventoryDelta(flags, v);
      continue;
    }
    if (k === "phone_threads") {
      mergePhoneThreadsDelta(flags, v);
      continue;
    }
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
      flags[k] = v;
    }
  }
}
