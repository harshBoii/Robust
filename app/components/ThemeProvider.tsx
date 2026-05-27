'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'default' | 'dark' | 'monochrome' | 'monochrome-dark' | 'minimal' | 'minimal-dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'default' | 'dark' | 'monochrome' | 'monochrome-dark' | 'minimal' | 'minimal-dark';
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_ORDER: Theme[] = ['default', 'dark', 'monochrome', 'monochrome-dark', 'minimal', 'minimal-dark', 'system'];

const STORAGE_KEY = 'robust-theme';

function getSystemTheme(): 'default' | 'dark' {
  if (typeof window === 'undefined') return 'default';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

function resolveTheme(theme: Theme): 'default' | 'dark' | 'monochrome' | 'monochrome-dark' | 'minimal' | 'minimal-dark' {
  if (theme === 'system') {
    const system = getSystemTheme();
    return system === 'dark' ? 'dark' : 'default';
  }
  return theme;
}

function applyThemeClasses(resolved: 'default' | 'dark' | 'monochrome' | 'monochrome-dark' | 'minimal' | 'minimal-dark') {
  const html = document.documentElement;
  
  // Remove all theme classes first
  html.classList.remove('dark', 'monochrome', 'minimal');
  
  // Apply based on resolved theme
  switch (resolved) {
    case 'dark':
      html.classList.add('dark');
      break;
    case 'monochrome':
      html.classList.add('monochrome');
      break;
    case 'monochrome-dark':
      html.classList.add('dark', 'monochrome');
      break;
    case 'minimal':
      html.classList.add('minimal');
      break;
    case 'minimal-dark':
      html.classList.add('dark', 'minimal');
      break;
    case 'default':
    default:
      // No classes needed for default
      break;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('default');
  const [resolvedTheme, setResolvedTheme] = useState<'default' | 'dark' | 'monochrome' | 'monochrome-dark' | 'minimal' | 'minimal-dark'>('default');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme = stored ?? 'default';
    setThemeState(initialTheme);
    const resolved = resolveTheme(initialTheme);
    setResolvedTheme(resolved);
    applyThemeClasses(resolved);
    setMounted(true);
  }, []);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const resolved = resolveTheme('system');
      setResolvedTheme(resolved);
      applyThemeClasses(resolved);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeClasses(resolved);
  }, []);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    const nextTheme = THEME_ORDER[nextIndex];
    setTheme(nextTheme);
  }, [theme, setTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
