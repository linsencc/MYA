/**
 * 叙事 LLM 全链路日志：终端 + 本地 NDJSON（便于 Agent 直接读文件排查）。
 * 终端检索：`[game:pipeline]`
 * 文件：`data/logs/game-pipeline-YYYY-MM-DD.ndjson`（{@link dataRoot} 下）
 * - **日期分卷与 `ts` 字段**：固定为 **Asia/Shanghai（北京时区，UTC+8）**，便于与本地游玩时间对齐。
 * - **`ts_utc`**：同一瞬间的 `Date#toISOString()`（UTC），便于与上游/OpenRouter 时间对照。
 * 关闭落盘：`GAME_PIPELINE_LOG=0`
 */

import fs from "fs";
import path from "path";
import { dataRoot } from "@/lib/paths";

export type PipelineAttempt = "primary" | "repair" | "mock" | "fallback_json";

const STRING_CAP = 12_000;

/** 落盘与 `ts` 使用的 IANA 时区（中国无夏令时，与 UTC 恒差 +8） */
export const PIPELINE_LOG_TIMEZONE = "Asia/Shanghai" as const;
const PIPELINE_OFFSET_LABEL = "+08:00";

type BeijingWallParts = {
  y: string;
  m: string;
  d: string;
  h: string;
  mi: string;
  s: string;
  ms: string;
};

function beijingWallParts(date: Date): BeijingWallParts {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: PIPELINE_LOG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    fractionalSecondDigits: 3,
  });
  const parts = dtf.formatToParts(date);
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const fracRaw = map.fractionalSecond;
  const ms =
    fracRaw != null && fracRaw !== ""
      ? fracRaw.replace(/\D/g, "").padEnd(3, "0").slice(0, 3)
      : "000";
  return {
    y: String(map.year ?? "1970"),
    m: String(map.month ?? "01").padStart(2, "0"),
    d: String(map.day ?? "01").padStart(2, "0"),
    h: String(map.hour ?? "00").padStart(2, "0"),
    mi: String(map.minute ?? "00").padStart(2, "0"),
    s: String(map.second ?? "00").padStart(2, "0"),
    ms,
  };
}

/** NDJSON 用：北京时区 RFC3339 风格 + 同条 UTC 时间 */
export function pipelineTimestamps(date: Date): { ts: string; ts_utc: string } {
  const p = beijingWallParts(date);
  const ts = `${p.y}-${p.m}-${p.d}T${p.h}:${p.mi}:${p.s}.${p.ms}${PIPELINE_OFFSET_LABEL}`;
  return { ts, ts_utc: date.toISOString() };
}

function pipelineLogDisabled(): boolean {
  return process.env.GAME_PIPELINE_LOG === "0" || process.env.GAME_PIPELINE_LOG === "false";
}

let logDirReady = false;

function pipelineLogDir(): string {
  return path.join(dataRoot(), "logs");
}

function ensureLogDir(): void {
  if (logDirReady) return;
  fs.mkdirSync(pipelineLogDir(), { recursive: true });
  logDirReady = true;
}

function dailyLogFileAt(date: Date): string {
  const p = beijingWallParts(date);
  const day = `${p.y}-${p.m}-${p.d}`;
  return path.join(pipelineLogDir(), `game-pipeline-${day}.ndjson`);
}

function dailyLogFile(): string {
  return dailyLogFileAt(new Date());
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string") {
      out[k] = v.length > STRING_CAP ? `${v.slice(0, STRING_CAP)}…` : v;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function appendNdjson(
  level: "info" | "warn",
  stage: string,
  fields: Record<string, unknown>,
  stamps: ReturnType<typeof pipelineTimestamps>,
  eventTime: Date,
): void {
  if (pipelineLogDisabled()) return;
  try {
    ensureLogDir();
    const { ts, ts_utc } = stamps;
    const record = {
      ts,
      ts_utc,
      tz: PIPELINE_LOG_TIMEZONE,
      level,
      stage,
      ...sanitizeFields(fields),
    };
    fs.appendFileSync(dailyLogFileAt(eventTime), `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    /* 绝不因日志影响游戏 */
  }
}

function fmt(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => {
      if (typeof v === "boolean") return `${k}=${v}`;
      if (typeof v === "number") return `${k}=${v}`;
      if (typeof v === "object") {
        const raw = JSON.stringify(v).replace(/\s+/g, " ").trim();
        return `${k}=${raw.length > 280 ? `${raw.slice(0, 280)}…` : raw}`;
      }
      const s = String(v).replace(/\s+/g, " ").trim();
      return `${k}=${s.length > 280 ? `${s.slice(0, 280)}…` : s}`;
    })
    .join(" · ");
}

/** 常规信息（console.info） */
export function pipelineLog(stage: string, fields: Record<string, unknown>): void {
  const eventTime = new Date();
  const stamps = pipelineTimestamps(eventTime);
  console.info(`[game:pipeline] ${stamps.ts} ${stage} · ${fmt(fields)}`);
  appendNdjson("info", stage, fields, stamps, eventTime);
}

/** 异常 / 截断 / 解析失败（console.warn） */
export function pipelineWarn(stage: string, fields: Record<string, unknown>): void {
  const eventTime = new Date();
  const stamps = pipelineTimestamps(eventTime);
  console.warn(`[game:pipeline] ${stamps.ts} ${stage} · ${fmt(fields)}`);
  appendNdjson("warn", stage, fields, stamps, eventTime);
}

/** 当前日落盘文件路径（供排查；不存在时尚未写入） */
export function pipelineLogFilePath(): string {
  return dailyLogFile();
}

export function approxMessageChars(messages: { role: string; content: string }[]): number {
  let n = 0;
  for (const m of messages) n += (m.content || "").length;
  return n;
}

/** 用于判断是否「像被掐在字段中间」 */
export function rawSuffixForLog(raw: string, max = 72): string {
  const t = raw.trimEnd();
  if (!t) return "";
  const tail = t.length > max ? t.slice(-max) : t;
  return tail.replace(/\s+/g, " ");
}

export function rawOpensJsonObject(raw: string): boolean {
  return raw.trimStart().startsWith("{");
}
