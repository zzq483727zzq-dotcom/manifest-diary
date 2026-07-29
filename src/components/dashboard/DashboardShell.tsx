'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

const items = [
  { href: '/', label: '今日' },
  { href: '/projects', label: '项目' },
  { href: '/calendar', label: '日历' },
] as const;

function NavIcon({ name }: { name: (typeof items)[number]['href'] }) {
  if (name === '/') {
    return (
      <svg className="nav-ico" viewBox="0 0 16 16" aria-hidden>
        <rect x="2" y="2" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.9" />
        <rect x="9" y="2" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.45" />
        <rect x="2" y="9" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.45" />
        <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.7" />
      </svg>
    );
  }
  if (name === '/projects') {
    return (
      <svg className="nav-ico" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M2.5 4.5h4L8 6h5.5v6.5A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5v-8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className="nav-ico" viewBox="0 0 16 16" aria-hidden>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M6 2.5v2M10 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

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
          <div>
            <strong>Clarity</strong>
            <span>个人项目执行</span>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="主导航">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
              <span className="nav-label">
                <NavIcon name={item.href} />
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
            数据只在本机
          </div>
          <small>{userEmail.split('@')[0]}</small>
          <div className="sidebar-actions">
            <Link href="/settings" className="dashboard-signout">
              设置
            </Link>
            <button className="dashboard-signout" onClick={signOut} type="button">
              退出解锁
            </button>
          </div>
        </div>
      </aside>

      <div className="dashboard-content">{children}</div>

      <nav className="dashboard-mobile-nav" aria-label="移动端导航">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
            <NavIcon name={item.href} />
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
