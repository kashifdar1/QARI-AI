import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { colorsFor, type ColorScheme, type ThemeColors } from './colors.js';

export type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  setScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialScheme = 'light',
  children,
}: {
  initialScheme?: ColorScheme;
  children: ReactNode;
}): JSX.Element {
  const [scheme, setScheme] = useState<ColorScheme>(initialScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: colorsFor(scheme), setScheme }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
