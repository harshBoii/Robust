'use client';

import React, { useState } from 'react';
import { Palette, Sun, Moon, Minus, Check } from 'lucide-react';
import { useTheme, type Theme } from '@/app/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';

const THEME_CONFIG: Record<Theme, { label: string; icon: React.ReactNode; description: string }> = {
  default: {
    label: 'Default',
    icon: <Sun className="w-4 h-4" />,
    description: 'Warm parchment with burnt orange accents',
  },
  dark: {
    label: 'Dark',
    icon: <Moon className="w-4 h-4" />,
    description: 'True black with gold leaf accents',
  },
  monochrome: {
    label: 'Monochrome',
    icon: <Minus className="w-4 h-4" />,
    description: 'Pure white with ink-black text',
  },
  'monochrome-dark': {
    label: 'Mono Dark',
    icon: <Minus className="w-4 h-4" />,
    description: 'Near-black with white text',
  },
  minimal: {
    label: 'Minimal',
    icon: <Palette className="w-4 h-4" />,
    description: 'Clean white with slate-indigo accent',
  },
  'minimal-dark': {
    label: 'Minimal Dark',
    icon: <Palette className="w-4 h-4" />,
    description: 'Deep graphite with slate-indigo accent',
  },
  system: {
    label: 'System',
    icon: <Sun className="w-4 h-4" />,
    description: 'Follows your OS preference',
  },
};

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const currentConfig = THEME_CONFIG[theme];
  const resolvedConfig = THEME_CONFIG[resolvedTheme];

  return (
    <div className="flex w-full flex-col items-center select-none">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onContextMenu={(e) => {
          e.preventDefault();
          cycleTheme();
        }}
        title={`Theme: ${currentConfig.label} (right-click to cycle)`}
        className="sidebar-icon relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 text-muted-foreground/60 hover:text-foreground hover:bg-[var(--glass-hover)]"
      >
        <Palette className="w-[18px] h-[18px]" />
        {/* Theme indicator dot */}
        <span 
          className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{
            background: theme === 'dark' || theme === 'monochrome-dark' || theme === 'minimal-dark' 
              ? 'var(--primary)' 
              : theme === 'monochrome' 
                ? 'oklch(0.14 0 0)' 
                : theme === 'minimal'
                  ? 'oklch(0.46 0.18 262)'
                  : 'var(--primary)'
          }}
        />
      </button>
      <span className="font-ui mt-0.5 text-[9px] leading-none mb-1 text-muted-foreground/40">
        {currentConfig.label}
      </span>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed left-16 bottom-24 z-50 w-56 glass-dropdown p-1.5"
              style={{ marginLeft: '8px' }}
            >
              <div className="px-2 py-1.5 border-b border-[var(--glass-border)] mb-1">
                <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Select Theme
                </span>
              </div>
              
              <div className="space-y-0.5">
                {(Object.keys(THEME_CONFIG) as Theme[]).map((t) => {
                  const config = THEME_CONFIG[t];
                  const isActive = theme === t;
                  const isResolved = resolvedTheme === t && theme === 'system';
                  
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTheme(t);
                        setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-2.5 px-2 py-2 rounded-lg
                        font-body text-[12px] transition-all duration-150
                        ${isActive 
                          ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-foreground' 
                          : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground'
                        }
                      `}
                    >
                      <span className={`
                        flex items-center justify-center w-6 h-6 rounded-md
                        ${isActive ? 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]' : 'bg-[var(--glass-hover)]'}
                      `}>
                        {config.icon}
                      </span>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{config.label}</span>
                          {isActive && <Check className="w-3 h-3 text-primary" />}
                          {isResolved && !isActive && (
                            <span className="text-[9px] text-muted-foreground/50">(active)</span>
                          )}
                        </div>
                        <span className="block text-[10px] text-muted-foreground/50 leading-tight">
                          {config.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-1 pt-1.5 border-t border-[var(--glass-border)] px-2">
                <span className="text-[9px] text-muted-foreground/40 leading-snug block">
                  Right-click theme button to cycle
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
