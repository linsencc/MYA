import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { defaultConfig } from "@/lib/game/config";

const BASENAME_RE = /^cg_\d{2}_\d{3}\.png$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const n = searchParams.get("n") ?? "";
  // v 仅用于客户端缓存破坏，不参与路径解析
  if (!BASENAME_RE.test(n)) {
    return NextResponse.json({ error: "invalid name" }, { status: 400 });
  }
  const outDir = defaultConfig().outputDir;
  const full = path.join(outDir, n);
  const resolved = path.resolve(full);
  const baseResolved = path.resolve(outDir);
  if (!resolved.startsWith(baseResolved)) {
    return NextResponse.json({ error: "path" }, { status: 400 });
  }
  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const buf = fs.readFileSync(resolved);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
