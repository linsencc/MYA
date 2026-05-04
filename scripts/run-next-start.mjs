/**
 * Respect GAME_PORT / GAME_BIND like the old Gradio app (default 7860 / 0.0.0.0).
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.GAME_PORT || process.env.PORT || "7860";
const host = process.env.GAME_BIND || "0.0.0.0";
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");
const proc = spawn(process.execPath, [next, "start", "-H", host, "-p", String(port)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
proc.on("exit", (code) => process.exit(code ?? 0));
