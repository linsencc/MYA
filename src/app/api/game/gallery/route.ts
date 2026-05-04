import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { defaultConfig } from "@/lib/game/config";
import { cgPublicUrlFromDiskPath } from "@/lib/game/application/cg-url";

export async function GET() {
  const { outputDir } = defaultConfig();
  if (!fs.existsSync(outputDir)) {
    return NextResponse.json({ items: [] as { name: string; url: string }[] });
  }
  const names = fs
    .readdirSync(outputDir)
    .filter((n) => /^cg_\d{2}_\d{3}\.png$/i.test(n));
  names.sort();
  const items = names.map((n) => {
    const abs = path.join(outputDir, n);
    return { name: n, url: cgPublicUrlFromDiskPath(abs) };
  });
  return NextResponse.json({ items });
}
