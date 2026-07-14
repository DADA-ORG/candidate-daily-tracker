import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "DADA候选人每日追踪工具",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
