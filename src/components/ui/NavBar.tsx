'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useTheme } from '@/components/theme/ThemeContext';
import { autoTheme } from '@/components/theme/ThemeProvider';

interface NavBarProps {
  userEmail: string;
}

export function NavBar({ userEmail }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();

  // 路由感知的主题切换：显化页 cosmos，其余 night
  useEffect(() => {
    if (pathname.startsWith('/manifest')) {
      setTheme('cosmos');
    } else {
      setTheme(autoTheme());
    }
  }, [pathname, setTheme]);

  const handleSignOut = async () => {
    const sb = createBrowserClient();
    await sb.auth.signOut();
    router.push('/login');
  };

  const link = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className="px-3 py-1.5 rounded-full text-sm transition-opacity"
      style={{
        backgroundColor: pathname === href ? 'var(--bg-card-glow)' : 'transparent',
        color: pathname === href ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav
      className="border-b backdrop-blur-md sticky top-0 z-30"
      style={{ borderColor: 'var(--border-soft)', backgroundColor: 'var(--bg-solid)' }}
    >
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-gold font-medium tracking-wider text-sm"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            ✦ MANIFEST DIARY
          </span>
        </div>
        <div className="flex items-center gap-1">
          {link('/', '今日')}
          {link('/reflect', '复盘')}
          {link('/manifest', '显化')}
          {link('/history', '日历')}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {userEmail.split('@')[0]} ↗
        </button>
      </div>
    </nav>
  );
}
