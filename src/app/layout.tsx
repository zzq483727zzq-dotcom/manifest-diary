import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CLARITY · 个人项目执行系统',
  description: '本地优先的个人项目执行系统：项目、任务、截止日期、耗时记录与今日行动台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
