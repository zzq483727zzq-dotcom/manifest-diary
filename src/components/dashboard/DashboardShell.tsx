'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { resetDB } from '@/lib/store/store';
import { useStore } from '@/lib/store/useStore';
import { countActionBadge, listTasks } from '@/lib/store/repository';
import { localDateString } from '@/lib/project/date';
import { TASK_STATUS_LABELS } from '@/types/project';

const items = [
  { href: '/', label: '今日' },
  { href: '/projects', label: '项目' },
  { href: '/calendar', label: '日历' },
  { href: '/review', label: '复盘统计' },
  { href: '/settings', label: '设置' },
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
  if (name === '/calendar') {
    return (
      <svg className="nav-ico" viewBox="0 0 16 16" aria-hidden>
        <rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 6.5h11M6 2.5v2M10 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === '/review') {
    return (
      <svg className="nav-ico" viewBox="0 0 16 16" aria-hidden>
        <rect x="2" y="9" width="3" height="5" rx="0.8" fill="currentColor" opacity="0.7" />
        <rect x="6.5" y="5" width="3" height="9" rx="0.8" fill="currentColor" opacity="0.9" />
        <rect x="11" y="2" width="3" height="12" rx="0.8" fill="currentColor" opacity="0.55" />
      </svg>
    );
  }
  return (
    <svg className="nav-ico" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const db = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // 「今日」导航紧急徽标：今日及之前到期但未完成的任务数（已排除归档项目）。
  // countActionBadge 早就在 repository 里写好，导航从来没渲染过。
  const todayBadge = useMemo(
    () => countActionBadge(db, localDateString()),
    [db],
  );

  // 全局任务搜索：匹配标题 / 描述 / 所属项目名，截断到 15 条。
  // 数据在 localStorage，过滤瞬时，无需防抖。
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const all = listTasks(db).filter((t) => t.project_status !== 'archived');
    const matched = all.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.project_name.toLowerCase().includes(q),
    );
    return matched.slice(0, 15);
  }, [db, searchQuery]);

  const showSearchResults = searchFocused && searchQuery.trim().length > 0;

  // 点击搜索框外部关闭结果浮层。
  useEffect(() => {
    if (!showSearchResults) return;
    const onDown = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [showSearchResults]);

  function goToTask(taskId: string, projectId: string) {
    setSearchQuery('');
    setSearchFocused(false);
    router.push(`/projects/detail?id=${projectId}&task=${taskId}`);
  }

  function clearLocalData() {
    if (
      window.confirm('清除本浏览器中的全部本地数据？项目、任务、耗时都将从这台设备删除，且无法撤销。请先导出备份再继续。')
    ) {
      resetDB();
      window.location.reload();
    }
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

        <div className="sidebar-search" ref={searchBoxRef}>
          <input
            type="search"
            className="sidebar-search-input"
            placeholder="搜索任务…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            aria-label="全局搜索任务"
          />
          {showSearchResults ? (
            <div className="sidebar-search-results" role="listbox">
              {searchResults.length === 0 ? (
                <p className="sidebar-search-empty">没有匹配的任务</p>
              ) : (
                searchResults.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="sidebar-search-item"
                    role="option"
                    aria-selected={false}
                    onClick={() => goToTask(task.id, task.project_id)}
                  >
                    <span className="sidebar-search-swatch" style={{ background: task.project_color }} aria-hidden />
                    <span className="sidebar-search-text">
                      <strong>{task.title}</strong>
                      <span className="sidebar-search-meta">
                        {task.project_name}
                        <span>·</span>
                        {TASK_STATUS_LABELS[task.status]}
                        {task.due_date ? <><span>·</span>{task.due_date}</> : null}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <nav className="dashboard-nav" aria-label="主导航">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
              <span className="nav-label">
                <NavIcon name={item.href} />
                {item.label}
                {item.href === '/' && todayBadge > 0 ? (
                  <span className="nav-badge" aria-label={`${todayBadge} 项今日紧急`}>{todayBadge}</span>
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
          <small>本地用户</small>
          <div className="sidebar-actions">
            <button className="dashboard-signout" onClick={clearLocalData} type="button">
              清除本机数据
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
              <span className="nav-badge mobile" aria-label={`${todayBadge} 项今日紧急`}>{todayBadge}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}