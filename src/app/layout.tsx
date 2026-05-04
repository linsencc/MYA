import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVG · 课后的余晖",
  description: "校园 · 文字 AVG 养成",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
