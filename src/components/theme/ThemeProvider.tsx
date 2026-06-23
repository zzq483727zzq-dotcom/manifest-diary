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
 * 自动主题：按 spec 不做昼夜底色切换，统一返回 night 暖底。
 * cosmos 由显化页路由层覆盖，不受此函数影响。
 */
export function autoTheme(_now: Date = new Date()): Theme {
  return 'night';
}
