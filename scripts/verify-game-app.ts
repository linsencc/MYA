/**
 * Next.js 游戏 UI 冒烟验证（无需人工打开浏览器）。
 * 仓库根目录: npx tsx scripts/verify-game-app.ts 或 npm run verify
 */
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      s.close();
      if (a && typeof a === "object") resolve(a.port);
      else reject(new Error("no port"));
    });
    s.on("error", reject);
  });
}

function getUntilOk(url: string, deadlineMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          if (res.statusCode !== 200) {
            if (Date.now() - start > deadlineMs) {
              reject(new Error(`HTTP ${res.statusCode}`));
            } else setTimeout(tryOnce, 400);
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf-8");
            if (!body.includes("课后的余晖")) {
              reject(new Error("body missing title"));
              return;
            }
            resolve();
          });
        })
        .on("error", () => {
          if (Date.now() - start > deadlineMs) reject(new Error("timeout"));
          else setTimeout(tryOnce, 400);
        });
    };
    tryOnce();
  });
}

async function main() {
  process.chdir(ROOT);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npm, ["run", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
  console.log("OK: npm run build");

  const nextCli = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(nextCli)) {
    console.error("Missing next CLI; run npm install");
    process.exit(1);
  }

  const port = await freePort();
  const env = { ...process.env, NODE_ENV: "production" as const };
  const proc = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: ROOT,
    env,
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}/`;
  try {
    await getUntilOk(url, 90000);
    console.log(`OK: GET ${url} -> 200`);

    await new Promise<void>((resolve, reject) => {
      const stateUrl = `${url}api/game/state`;
      const deadline = Date.now() + 20000;
      const tryState = () => {
        http
          .get(stateUrl, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c as Buffer));
            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf-8");
              if (res.statusCode !== 200) {
                if (Date.now() > deadline) reject(new Error(`state HTTP ${res.statusCode}`));
                else setTimeout(tryState, 400);
                return;
              }
              if (!body.includes('"world"') || !body.includes("locations")) {
                if (Date.now() > deadline) reject(new Error("state body missing world.locations"));
                else setTimeout(tryState, 400);
                return;
              }
              resolve();
            });
          })
          .on("error", () => {
            if (Date.now() > deadline) reject(new Error("state request failed"));
            else setTimeout(tryState, 400);
          });
      };
      tryState();
    });
    console.log(`OK: GET ${url}api/game/state -> 200 (world payload)`);
  } finally {
    proc.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
