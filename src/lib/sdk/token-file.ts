import fs from "fs";
import path from "path";
import { repoRoot } from "@/lib/paths";

/** Repo-root env-style secrets file (gitignored). */
export const KEYS_ENV_FILENAME = ".keys";
export const DEFAULT_TOKEN_FILENAME = ".key";

export function keysEnvPath(): string {
  return path.join(repoRoot(), KEYS_ENV_FILENAME);
}

export function tokenFilePath(filename: string = DEFAULT_TOKEN_FILENAME): string {
  return path.join(repoRoot(), filename);
}

/** Trim BOM / wrapping quotes from `.keys` values (avoids silent token corruption). */
export function normalizeSecretValue(value: string): string {
  let v = value.trim();
  if (v.charCodeAt(0) === 0xfeff) v = v.slice(1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Parse repo-root `.keys` into a dict (does not export secrets). */
export function loadKeysEnv(): Record<string, string> {
  const p = keysEnvPath();
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, "utf-8");
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    const value = normalizeSecretValue(t.slice(i + 1));
    if (key) result[key] = value;
  }
  return result;
}

/** Merge `.keys` into process.env when missing (server-only). */
export function applyKeysEnvToProcess(): void {
  for (const [k, v] of Object.entries(loadKeysEnv())) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

export function ensureApiToken(): void {
  applyKeysEnvToProcess();
  if (process.env.CIVITAI_API_TOKEN?.trim()) return;
  const keys = loadKeysEnv();
  const t = keys.CIVITAI_API_TOKEN?.trim();
  if (t) {
    process.env.CIVITAI_API_TOKEN = t;
    return;
  }
  const legacy = tokenFilePath();
  if (fs.existsSync(legacy)) {
    process.env.CIVITAI_API_TOKEN = normalizeSecretValue(fs.readFileSync(legacy, "utf-8"));
  }
}
