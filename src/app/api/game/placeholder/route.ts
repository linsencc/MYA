import { NextResponse } from "next/server";

/** 1×1 透明 PNG，经 API 下发且禁用缓存（不再依赖 `public/placeholders` 静态文件） */
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 占位图经 API 下发，避免 public 静态资源被浏览器长期缓存 */
export async function GET() {
  return new NextResponse(TRANSPARENT_PNG, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
