'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Toast = {
  id: string;
  title: string;
  message?: string;
  kind?: 'success' | 'error' | 'info';
  createdAt: number;
};

type ToastContextValue = {
  push: (t: Omit<Toast, 'id' | 'createdAt'>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastView({ t, onClose }: { t: Toast; onClose: () => void }) {
  const tone =
    t.kind === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : t.kind === 'error'
        ? 'border-red-500/30 bg-red-500/10 text-red-700'
        : 'border-border/50 bg-background/40 text-foreground';
  return (
    <div className={`glass rounded-2xl border px-4 py-3 shadow-xl ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-ui text-[12px] font-semibold truncate">{t.title}</div>
          {t.message ? (
            <div className="mt-1 text-[11px] opacity-80 break-words">{t.message}</div>
          ) : null}
        </div>
        <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id' | 'createdAt'>) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, createdAt: Date.now(), ...t };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[20000] w-[340px] space-y-2">
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

