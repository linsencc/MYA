import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyKeysEnvToProcess } from "@/lib/sdk/token-file";
import { toUiPayload } from "@/lib/game/application/game-response";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  loadEngine,
  newSessionId,
  saveEngine,
} from "@/lib/game/application/session-store";

export async function GET() {
  applyKeysEnvToProcess();
  const jar = await cookies();
  let sid = jar.get(SESSION_COOKIE)?.value;
  const created = !sid;
  if (!sid) sid = newSessionId();

  const engine = loadEngine(sid);
  if (created) {
    engine.appendConsole("界面就绪 · 可「开始游戏」或在设置中管理多槽存档", "SYS");
    saveEngine(sid, engine);
  }

  const res = NextResponse.json(toUiPayload(engine, null));
  if (created) {
    res.cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
