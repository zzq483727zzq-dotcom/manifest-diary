'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';
import type { ReactNode } from 'react';

const items = [
  { href: '/', label: '总览', short: '01' },
  { href: '/reflect', label: '记录', short: '02' },
  { href: '/history', label: '趋势', short: '03' },
  { href: '/manifest', label: '显化', short: '04' },
];

export function DashboardShell({ children, userEmail }: { children: ReactNode; userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  async function signOut() { await createBrowserClient().auth.signOut(); router.push('/login'); }
  return <div className="dashboard-frame">
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand"><span className="brand-mark">◒</span><span>DAYLIGHT<br /><em>生活操作系统</em></span></div>
      <nav className="dashboard-nav" aria-label="主导航">
        {items.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}><span>{item.short}</span>{item.label}</Link>)}
      </nav>
      <div className="dashboard-sidebar-foot"><span className="status-dot" /> 数据只属于你<br /><small>{userEmail.split('@')[0]}</small><button className="dashboard-signout" onClick={signOut}>退出登录 ↗</button></div>
    </aside>
    <div className="dashboard-content">{children}</div>
    <nav className="dashboard-mobile-nav" aria-label="移动端导航">
      {items.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}><span>{item.short}</span>{item.label}</Link>)}
    </nav>
  </div>;
}
