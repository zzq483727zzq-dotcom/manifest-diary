'use client';

import { useEffect, useState } from 'react';
import { ThemeContext, type Theme } from './ThemeContext';
import { getTimeOfDay, themeForTime } from '@/lib/time-greeting';

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
 * 根据当前时间返回默认主题：
 * - 06:00–21:00 → garden（晨间花园 / 白天 / 黄昏）
 * - 21:00–06:00 → night（深夜暖光）
 * 显化页 cosmos 主题由路由层覆盖，不受此函数影响。
 */
export function autoTheme(now: Date = new Date()): Theme {
  return themeForTime(getTimeOfDay(now));
}
