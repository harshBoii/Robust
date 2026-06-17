'use client';

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const LenisContext = createContext<Lenis | null>(null);

const LENIS_HTML_CLASSES = ['lenis', 'lenis-smooth', 'lenis-stopped', 'lenis-scrolling'] as const;

export function clearLenisDocumentState() {
  const html = document.documentElement;
  const { body } = document;

  html.classList.remove(...LENIS_HTML_CLASSES);
  html.style.removeProperty('overflow');
  html.style.removeProperty('height');
  body.style.removeProperty('overflow');
  body.style.removeProperty('height');
}

export function useLenis() {
  return useContext(LenisContext);
}

export function LenisScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const instance = new Lenis({ autoRaf: true });
    setLenis(instance);

    return () => {
      instance.destroy();
      clearLenisDocumentState();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
