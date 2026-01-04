// src/contexts/ThemeContext.ts
import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// ✅ Export only the context
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);