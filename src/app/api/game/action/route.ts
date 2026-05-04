import fs from "fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { defaultConfig } from "@/lib/game/config";
import { makeLlm } from "@/lib/game/adapters/llm";
import { NarrativeEngine } from "@/lib/game/narrative/engine";
import type { CalendarAdvanceKind } from "@/lib/game/domain/calendar";
import { applyGodPatch, isGodPatchAllowed, parseGodPatch } from "@/lib/game/domain/god-patch";
import { GameState, slotPath } from "@/lib/game/domain/state";
import { pipelineLog } from "@/lib/game/adapters/llm-pipeline-log";
import { applyKeysEnvToProcess } from "@/lib/sdk/token-file";
import { toUiPayload } from "@/lib/game/application/game-response";
import { tryApplyShopPurchase } from "@/lib/game/world/shop-purchase";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  attachDefaultLlmTemperatureSource,
  loadEngine,
  newSessionId,
  saveEngine,
} from "@/lib/game/application/session-store";

type Body = {
  action: string;
  input?: string;
  slot?: number;
  saveNote?: string;
  newGamePlus?: boolean;
  cgForceInterval?: number;
  enableCg?: boolean;
  /** advance_calendar：next_slot | next_morning */
  calendarKind?: string;
  /** travel：地点 id（各场景 `world_travel_id`，缺省为场景 `id`） */
  locationId?: string;
  itemId?: string;
  /** shop_buy：商品 listingId，见 shop-listings */
  listingId?: string;
  threadId?: string;
  /** 生产环境须与 GAME_GOD_KEY 一致；开发环境可省略 */
  godKey?: string;
  godPatch?: unknown;
};

function parseCalendarKind(raw: unknown): CalendarAdvanceKind | null {
  const s = String(raw ?? "").trim();
  if (s === "next_slot" || s === "next_morning") return s;
  return null;
}

async function ensureSid(): Promise<{ sid: string; jar: Awaited<ReturnType<typeof cookies>> }> {
  const jar = await cookies();
  let sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) sid = newSessionId();
  return { sid, jar };
}

function cookieIfNew(jar: Awaited<ReturnType<typeof cookies>>, sid: string, res: NextResponse) {
  if (!jar.get(SESSION_COOKIE)?.value) {
    res.cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
}

/** step / custom：NDJSON 流式推送控制台行，便于前端逐条渲染 */
function streamGameStep(
  jar: Awaited<ReturnType<typeof cookies>>,
  sid: string,
  engine: NarrativeEngine,
  playLine: string,
  input: string,
  extras: { clearCustom?: boolean; inputKind?: "choice" | "custom" } = {},
): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      try {
        engine.setConsoleStreamSink((line) => send({ type: "log", line }));
        engine.appendConsole(playLine, "PLAY");
        const resp = await engine.step(input, { inputKind: extras.inputKind ?? "choice" });
        engine.setConsoleStreamSink(null);
        saveEngine(sid, engine);
        send({
          type: "done",
          ...toUiPayload(engine, resp),
          statusMsg: "",
          ...(extras.clearCustom ? { clearCustom: true } : {}),
        });
      } catch (e) {
        engine.setConsoleStreamSink(null);
        try {
          saveEngine(sid, engine);
        } catch {
          /* ignore */
        }
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", message: msg });
        send({
          type: "done",
          ...toUiPayload(engine, null),
          statusMsg: `出错：${msg}`,
          ...(extras.clearCustom ? { clearCustom: true } : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  const res = new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
  cookieIfNew(jar, sid, res);
  return res;
}

function streamCalendarAdvance(
  jar: Awaited<ReturnType<typeof cookies>>,
  sid: string,
  engine: NarrativeEngine,
  kind: CalendarAdvanceKind,
  playLine: string,
): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      try {
        engine.setConsoleStreamSink((line) => send({ type: "log", line }));
        engine.appendConsole(playLine, "PLAY");
        const resp = await engine.advanceCalendarAndNarrate(kind);
        engine.setConsoleStreamSink(null);
        saveEngine(sid, engine);
        send({
          type: "done",
          ...toUiPayload(engine, resp),
          statusMsg: "",
        });
      } catch (e) {
        engine.setConsoleStreamSink(null);
        try {
          saveEngine(sid, engine);
        } catch {
          /* ignore */
        }
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", message: msg });
        send({
          type: "done",
          ...toUiPayload(engine, null),
          statusMsg: `出错：${msg}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  const res = new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
  cookieIfNew(jar, sid, res);
  return res;
}

export async function POST(req: Request) {
  applyKeysEnvToProcess();
  const { sid, jar } = await ensureSid();
  const body = (await req.json()) as Body;
  const cfg = defaultConfig();

  pipelineLog("01_api_game_action", {
    action: body.action,
    sid_prefix: sid.slice(0, 8),
    ...(body.action === "step" || body.action === "custom"
      ? { input_len: String(body.input ?? "").length }
      : {}),
    ...(body.action === "advance_calendar" ? { calendar_kind: String(body.calendarKind ?? "") } : {}),
  });

  const engine = loadEngine(sid);

  if (body.action === "delete_slot") {
    const slot = Math.max(0, Math.min(9, Number(body.slot ?? 0)));
    const deleted = GameState.deleteSlot(slot);
    const res = NextResponse.json({
      ...toUiPayload(engine, null),
      statusMsg: deleted ? `🗑️ 已删除槽位 ${slot + 1}。` : `槽位 ${slot + 1} 原本为空。`,
    });
    cookieIfNew(jar, sid, res);
    return res;
  }

  if (body.action === "set_cg_options") {
    const interval = Math.max(0, Math.min(20, Number(body.cgForceInterval ?? 2)));
    engine.cgForceInterval = interval;
    if (body.enableCg !== undefined) engine.enableCg = Boolean(body.enableCg);
    saveEngine(sid, engine);
    const res = NextResponse.json({
      ...toUiPayload(engine, null),
      statusMsg: `已更新 CG：间隔 ${interval || "关"} · ${engine.enableCg ? "启用" : "关闭"}`,
    });
    cookieIfNew(jar, sid, res);
    return res;
  }

  const doStart = (ngp = false) => {
    if (ngp) {
      const fresh = new NarrativeEngine({ config: cfg, llm: makeLlm() });
      attachDefaultLlmTemperatureSource(fresh);
      fresh.state = GameState.newGamePlus(engine.state);
      fresh.appendConsole("新游戏+ · 保留周目 CG 统计 · 引擎就绪", "SYS");
      const resp = fresh.start();
      saveEngine(sid, fresh);
      const res = NextResponse.json({ ...toUiPayload(fresh, resp), statusMsg: "" });
      cookieIfNew(jar, sid, res);
      return res;
    }
    const fresh = new NarrativeEngine({ config: cfg, llm: makeLlm() });
    attachDefaultLlmTemperatureSource(fresh);
    fresh.state.nsfw_mode = true;
    fresh.appendConsole("新游戏 · 成人向模式 · 引擎就绪", "SYS");
    const resp = fresh.start();
    saveEngine(sid, fresh);
    const res = NextResponse.json({ ...toUiPayload(fresh, resp), statusMsg: "" });
    cookieIfNew(jar, sid, res);
    return res;
  };

  switch (body.action) {
    case "start":
      return doStart(Boolean(body.newGamePlus));
    case "reset":
      return doStart(Boolean(body.newGamePlus));
    case "step": {
      const input = String(body.input ?? "").trim();
      if (!input) {
        const res = NextResponse.json(toUiPayload(engine, null));
        cookieIfNew(jar, sid, res);
        return res;
      }
      const playLine = `选项 · ${input.length > 40 ? `${input.slice(0, 40)}…` : input}`;
      return streamGameStep(jar, sid, engine, playLine, input, { inputKind: "choice" });
    }
    case "custom": {
      const raw = String(body.input ?? "").trim();
      if (!raw) {
        const res = NextResponse.json({ ...toUiPayload(engine, null), clearCustom: true });
        cookieIfNew(jar, sid, res);
        return res;
      }
      const playLine = `自由输入 · ${raw.length > 40 ? `${raw.slice(0, 40)}…` : raw}`;
      return streamGameStep(jar, sid, engine, playLine, raw, { clearCustom: true, inputKind: "custom" });
    }
    case "use_item": {
      const itemId = String(body.itemId ?? "").trim();
      if (!itemId) {
        return NextResponse.json({ error: "缺少 itemId" }, { status: 400 });
      }
      try {
        const resp = engine.useItem(itemId);
        saveEngine(sid, engine);
        const res = NextResponse.json({
          ...toUiPayload(engine, resp),
          statusMsg: "",
        });
        cookieIfNew(jar, sid, res);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const res = NextResponse.json(
          { error: msg, message: msg, ...toUiPayload(engine, null) },
          { status: 400 },
        );
        cookieIfNew(jar, sid, res);
        return res;
      }
    }
    case "shop_buy": {
      const listingId = String(body.listingId ?? "").trim();
      if (!listingId) {
        return NextResponse.json({ error: "缺少 listingId" }, { status: 400 });
      }
      const r = tryApplyShopPurchase(engine.state.flags, listingId);
      if (!r.ok) {
        const res = NextResponse.json(
          { error: r.error, message: r.error, ...toUiPayload(engine, null) },
          { status: 400 },
        );
        cookieIfNew(jar, sid, res);
        return res;
      }
      saveEngine(sid, engine);
      const res = NextResponse.json({
        ...toUiPayload(engine, null),
        statusMsg: "购买成功。",
      });
      cookieIfNew(jar, sid, res);
      return res;
    }
    case "phone_read": {
      const threadId = String(body.threadId ?? "").trim();
      if (!threadId) {
        return NextResponse.json({ error: "缺少 threadId" }, { status: 400 });
      }
      try {
        const title = engine.phoneMarkRead(threadId);
        saveEngine(sid, engine);
        const res = NextResponse.json({
          ...toUiPayload(engine, null),
          statusMsg: `已读：「${title}」`,
        });
        cookieIfNew(jar, sid, res);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const res = NextResponse.json(
          { error: msg, message: msg, ...toUiPayload(engine, null) },
          { status: 400 },
        );
        cookieIfNew(jar, sid, res);
        return res;
      }
    }
    case "travel": {
      const locationId = String(body.locationId ?? "").trim();
      if (!locationId) {
        return NextResponse.json({ error: "缺少 locationId" }, { status: 400 });
      }
      try {
        const resp = engine.travelByLocationId(locationId);
        saveEngine(sid, engine);
        const res = NextResponse.json({
          ...toUiPayload(engine, resp),
          statusMsg: "",
        });
        cookieIfNew(jar, sid, res);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const res = NextResponse.json(
          { error: msg, message: msg, ...toUiPayload(engine, null) },
          { status: 400 },
        );
        cookieIfNew(jar, sid, res);
        return res;
      }
    }
    case "advance_calendar": {
      const kind = parseCalendarKind(body.calendarKind);
      if (!kind) {
        return NextResponse.json(
          { error: "calendarKind must be next_slot or next_morning" },
          { status: 400 },
        );
      }
      const playLine = kind === "next_morning" ? "日历 · 手动睡到明天早上" : "日历 · 手动进入下一时段";
      return streamCalendarAdvance(jar, sid, engine, kind, playLine);
    }
    case "save": {
      const slot = Math.max(0, Math.min(9, Number(body.slot ?? 0)));
      engine.state.save_label = String(body.saveNote ?? "").trim();
      engine.save(slot);
      saveEngine(sid, engine);
      const res = NextResponse.json({
        ...toUiPayload(engine, null),
        statusMsg: `💾 已保存到槽位 ${slot + 1}。`,
      });
      cookieIfNew(jar, sid, res);
      return res;
    }
    case "load": {
      const slot = Math.max(0, Math.min(9, Number(body.slot ?? 0)));
      const existed = fs.existsSync(slotPath(slot));
      engine.load(slot);
      saveEngine(sid, engine);
      const res = NextResponse.json({
        ...toUiPayload(engine, null),
        statusMsg: existed
          ? `📂 已读取槽位 ${slot + 1}。`
          : `📂 槽位 ${slot + 1} 无存档，已载入默认状态。`,
      });
      cookieIfNew(jar, sid, res);
      return res;
    }
    case "god_patch": {
      if (!isGodPatchAllowed(body.godKey)) {
        return NextResponse.json(
          {
            error: "上帝指令未授权：开发环境可用；生产环境请在服务端配置 GAME_GOD_KEY 并在请求中传入 godKey。",
          },
          { status: 403 },
        );
      }
      const parsed = parseGodPatch(body.godPatch);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { applied, warnings } = applyGodPatch(engine.state, parsed.patch);
      const line =
        applied.length > 0
          ? `上帝指令 · ${applied.join(" · ")}`
          : "上帝指令 · （无有效字段变更）";
      engine.appendConsole(line, "SYS");
      saveEngine(sid, engine);
      const warnText = warnings.length > 0 ? ` ⚠ ${warnings.join("；")}` : "";
      const res = NextResponse.json({
        ...toUiPayload(engine, null),
        statusMsg:
          applied.length > 0
            ? `已应用上帝补丁。${warnText}`.trim()
            : `未变更（请填写要修改的字段）。${warnText}`.trim(),
      });
      cookieIfNew(jar, sid, res);
      return res;
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
