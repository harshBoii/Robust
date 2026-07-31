'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
    gsap.registerPlugin(ScrollTrigger);

    // Lenis is driven by gsap's ticker (not its own rAF) so ScrollTrigger's
    // scrubbed animations resolve on the same frame as the smoothed scroll.
    const instance = new Lenis({ autoRaf: false });
    setLenis(instance);

    const tick = (time: number) => instance.raf(time * 1000);

    instance.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      clearLenisDocumentState();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
