'use client';

import { useEffect, useState } from 'react';
import { ThemeContext, type Theme } from './ThemeContext';

interface ThemeProviderProps {
  defaultTheme?: Theme;
  children: React.ReactNode;
}

export function ThemeProvider({ defaultTheme = 'night', children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 根据当前小时返回默认主题：
 * - 06:00-18:00 → garden（晨间花园）
 * - 18:00-06:00 → night（夜晚暖光）
 * 显化/宇宙主题由路由层覆盖。
 */
export function autoTheme(now: Date = new Date()): Theme {
  const h = now.getHours();
  if (h >= 6 && h < 18) return 'garden';
  return 'night';
}