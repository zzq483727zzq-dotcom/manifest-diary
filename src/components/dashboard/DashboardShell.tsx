'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

const items = [
  { href: '/', label: '今日', short: '01' },
  { href: '/projects', label: '项目', short: '02' },
  { href: '/calendar', label: '日历', short: '03' },
];

export function DashboardShell({
  children,
  userEmail,
  todayBadge = 0,
}: {
  children: ReactNode;
  userEmail: string;
  todayBadge?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    document.cookie = 'manifest-local-session=; Max-Age=0; path=/';
    router.push('/unlock');
    router.refresh();
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="dashboard-frame">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <span className="brand-mark" aria-hidden>
            <span className="brand-mark-inner" />
          </span>
          <span>
            CLARITY
            <br />
            <em>个人项目执行系统</em>
          </span>
        </div>

        <nav className="dashboard-nav" aria-label="主导航">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
              <span>{item.short}</span>
              <span className="nav-label">
                {item.label}
                {item.href === '/' && todayBadge > 0 ? (
                  <em className="nav-badge">{todayBadge > 99 ? '99+' : todayBadge}</em>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>

        <div className="dashboard-sidebar-foot">
          <div className="privacy-pill">
            <span className="status-dot" />
            数据只属于你
          </div>
          <small>{userEmail.split('@')[0]}</small>
          <div className="sidebar-actions">
            <Link href="/settings" className="dashboard-signout">
              设置
            </Link>
            <button className="dashboard-signout" onClick={signOut} type="button">
              退出解锁 ↗
            </button>
          </div>
        </div>
      </aside>

      <div className="dashboard-content">{children}</div>

      <nav className="dashboard-mobile-nav" aria-label="移动端导航">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
            <span>{item.short}</span>
            {item.label}
            {item.href === '/' && todayBadge > 0 ? (
              <em className="nav-badge mobile">{todayBadge > 99 ? '99+' : todayBadge}</em>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
