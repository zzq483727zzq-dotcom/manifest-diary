'use client';

import { createContext, useContext } from 'react';

export type Theme = 'night' | 'garden' | 'cosmos';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'night',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}