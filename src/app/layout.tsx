import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manifest Diary — 显化手账",
  description: "夜间陪伴你复盘 + 早晨推你出门 + 长期帮你显化的 AI 副驾驶",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
