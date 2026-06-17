import type Lenis from 'lenis';

export function scrollToSection(lenis: Lenis | null, id: string) {
  if (lenis) {
    lenis.scrollTo(id, { offset: -48 });
    return;
  }
  const el = document.querySelector(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
