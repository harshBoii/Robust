'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Mail,
  ShieldCheck,
  ScrollText,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { cn } from '@/lib/tailwind';

export type LegalSection = {
  id: string;
  title: string;
  body: string;
};

export type LegalDocument = {
  kind: 'privacy' | 'terms';
  eyebrow: string;
  title: string;
  subtitle: string;
  effectiveDate: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
  contactEmail: string;
};

const DOC_META = {
  privacy: {
    Icon: ShieldCheck,
    label: 'Privacy Policy',
    href: '/privacy-policy',
    crossLabel: 'Terms of Service',
    crossHref: '/terms-and-conditions',
    CrossIcon: ScrollText,
  },
  terms: {
    Icon: ScrollText,
    label: 'Terms of Service',
    href: '/terms-and-conditions',
    crossLabel: 'Privacy Policy',
    crossHref: '/privacy-policy',
    CrossIcon: ShieldCheck,
  },
} as const;

const PANEL_CLASS =
  'border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]';

export default function LegalLayout({ doc }: { doc: LegalDocument }) {
  const meta = DOC_META[doc.kind];
  const Icon = meta.Icon;
  const CrossIcon = meta.CrossIcon;

  const [activeId, setActiveId] = useState<string>(doc.sections[0]?.id ?? '');
  const [showTop, setShowTop] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(doc.sections[0] ? [doc.sections[0].id] : []),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const allExpanded = expanded.size === doc.sections.length;

  const toggleSection = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setExpanded(
      allExpanded ? new Set() : new Set(doc.sections.map((s) => s.id)),
    );

  // Track which section is in view → highlight in TOC.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const headings = doc.sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { root, rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [doc.sections]);

  // Back-to-top visibility.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 400);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Open + scroll to the section referenced by URL hash on mount.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    if (!doc.sections.some((s) => s.id === hash)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded((prev) => new Set(prev).add(hash));
    const tick = requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      const container = scrollRef.current;
      if (!target || !container) return;
      const offset =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        12;
      container.scrollTo({ top: offset });
    });
    return () => cancelAnimationFrame(tick);
  }, [doc.sections]);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    const container = scrollRef.current;
    if (!target || !container) return;
    const offset =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      12;
    container.scrollTo({ top: offset, behavior: 'smooth' });
  };

  const handleTocClick =
    (id: string): React.MouseEventHandler<HTMLAnchorElement> =>
    (e) => {
      e.preventDefault();
      setExpanded((prev) => new Set(prev).add(id));
      requestAnimationFrame(() => scrollToSection(id));
      if (history.replaceState) history.replaceState(null, '', `#${id}`);
    };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--primary) 10%, transparent) 0%, transparent 70%),
            radial-gradient(ellipse 90% 60% at 100% 10%, color-mix(in srgb, var(--clipfox-accent) 6%, transparent) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 0% 20%, color-mix(in srgb, var(--primary) 5%, transparent) 0%, transparent 60%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--foreground) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(to bottom, black 0%, black 30%, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 30%, transparent 80%)',
        }}
      />

      {/* Top navigation — flat (no shadow) */}
      <header
        className="relative z-40 shrink-0 border-b border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)]"
        style={{ background: 'var(--navbar-glass-bg)' }}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="group flex items-center gap-3"
            aria-label="Back to Robust home"
          >
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
              <Image
                src="/mascot/Robust.png"
                alt="Robust"
                width={48}
                height={48}
                className="object-contain p-0.5 dark:invert"
                priority
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-[1rem] font-bold tracking-[-0.02em] text-foreground">
                Robust
              </span>
              <span className="mt-0.5 font-ui text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Ad Intelligence
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href={meta.crossHref}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 font-ui text-[0.8rem] font-medium text-muted-foreground transition-colors hover:bg-[var(--glass-hover)] hover:text-foreground sm:inline-flex"
            >
              <CrossIcon className="h-3.5 w-3.5" />
              {meta.crossLabel}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 font-ui text-[0.8rem] font-medium text-foreground transition-colors hover:bg-[var(--glass-active)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to site</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero (sticky/static – does not scroll) */}
      <section className="relative z-10 shrink-0 border-b border-[var(--glass-border-subtle)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-6 sm:gap-4 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-3 py-1 font-ui text-[0.7rem] font-semibold tracking-[0.04em] uppercase text-foreground/80',
              )}
              style={{ background: 'var(--glass-bg)' }}
            >
              <Icon className="h-3.5 w-3.5" />
              {doc.eyebrow}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:inline-block" />
            <span className="inline-flex items-center gap-1.5 font-ui text-[0.7rem] font-medium tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1 backdrop-blur-[var(--glass-blur)]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Effective</span>
                <span className="text-foreground/80">{doc.effectiveDate}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1 backdrop-blur-[var(--glass-blur)]">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
                <span className="text-muted-foreground">Updated</span>
                <span className="text-foreground/80">{doc.lastUpdated}</span>
              </span>
            </span>
          </div>

          <h1 className="max-w-3xl font-display !text-[1.75rem] !leading-[1.1] !font-semibold !tracking-[-0.03em] text-foreground sm:!text-[2.25rem] md:!text-[2.5rem]">
            {doc.title}
          </h1>

          <p className="hidden max-w-2xl font-body text-[0.9375rem] leading-relaxed text-muted-foreground sm:block sm:text-[1rem]">
            {doc.subtitle}
          </p>
        </div>
      </section>

      {/* Body — TOC sticky, content scrollable */}
      <section className="relative z-10 flex min-h-0 flex-1">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-x-8 gap-y-3 px-5 pb-0 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-none lg:gap-x-10">
          {/* TOC */}
          <aside className="row-start-1 pt-4 sm:pt-6 lg:col-start-1 lg:row-start-1 lg:overflow-hidden lg:pt-6 lg:pb-6">
            {/* Mobile: collapsible */}
            <details
              className={cn(
                PANEL_CLASS,
                'group rounded-xl p-1.5 lg:hidden',
              )}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 font-ui text-[0.8rem] font-semibold tracking-wide text-foreground">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Table of Contents
                  <span className="ml-1 rounded-md bg-[var(--glass-hover)] px-1.5 py-0.5 font-data text-[0.65rem] font-semibold text-muted-foreground tabular-nums">
                    {doc.sections.length}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <nav className="glass-scrollbar max-h-[50vh] overflow-y-auto px-1 pt-1 pb-1.5">
                <TocList
                  sections={doc.sections}
                  activeId={activeId}
                  onClick={handleTocClick}
                />
              </nav>
            </details>

            {/* Desktop: sticky/static, scrolls independently if long */}
            <div className="hidden h-full flex-col lg:flex">
              <div className="mb-2 flex items-center gap-2 px-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-ui text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Contents
                </span>
                <span className="ml-auto rounded-md bg-[var(--glass-hover)] px-1.5 py-0.5 font-data text-[0.65rem] font-semibold text-muted-foreground tabular-nums">
                  {doc.sections.length}
                </span>
              </div>
              <nav className="glass-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                <TocList
                  sections={doc.sections}
                  activeId={activeId}
                  onClick={handleTocClick}
                />
              </nav>
            </div>
          </aside>

          {/* Content (the only scrollable area) */}
          <div
            ref={scrollRef}
            className="custom-scrollbar relative row-start-2 min-h-0 overflow-y-auto pt-2 pb-10 lg:col-start-2 lg:row-start-1 lg:pt-6 w-280"
          >
            {/* Top fade */}
            <div
              aria-hidden
              className="pointer-events-none sticky top-0 z-[1] -mt-2 h-3 w-full bg-gradient-to-b from-background to-transparent"
            />

            <article className="min-w-0 pb-4">
              {/* Intro */}
              <div className={cn(PANEL_CLASS, 'mb-4 rounded-2xl p-6 sm:p-7')}>
                <p className="font-body text-[0.9375rem] leading-relaxed text-foreground/90 sm:text-[1rem]">
                  {doc.intro}
                </p>
              </div>

              {/* Toolbar */}
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 font-ui text-[0.75rem] font-medium text-foreground transition-colors hover:bg-[var(--glass-active)]"
                >
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                      allExpanded && '-rotate-180',
                    )}
                  />
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              {/* Sections (dropdowns / accordions) */}
              <div className="space-y-3">
                {doc.sections.map((s, i) => (
                  <SectionDropdown
                    key={s.id}
                    index={i}
                    section={s}
                    isOpen={expanded.has(s.id)}
                    onToggle={() => toggleSection(s.id)}
                  />
                ))}
              </div>

              {/* Contact CTA */}
              <div
                className="mt-8 overflow-hidden rounded-2xl border border-[var(--glass-border)] p-6 sm:p-7"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent) 0%, color-mix(in srgb, var(--primary) 4%, transparent) 100%)',
                }}
              >
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="!text-[1rem] !font-semibold !tracking-[-0.01em] text-foreground">
                        Questions about this {doc.kind === 'privacy' ? 'policy' : 'agreement'}?
                      </h3>
                      <p className="font-body text-[0.875rem] text-muted-foreground">
                        Our team is happy to clarify anything you read here.
                      </p>
                    </div>
                  </div>
                  <a
                    href={`mailto:${doc.contactEmail}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 font-ui text-[0.875rem] font-semibold text-primary-foreground transition-[filter] hover:brightness-105"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--clipfox-primary-light) 0%, var(--clipfox-primary) 50%, var(--clipfox-primary-dark) 100%)',
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    {doc.contactEmail}
                  </a>
                </div>
              </div>

              {/* Cross-link */}
              <div
                className={cn(
                  PANEL_CLASS,
                  'mt-4 flex items-center justify-between gap-3 rounded-2xl p-5 sm:p-6',
                )}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-hover)]">
                    <CrossIcon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-ui text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Also see
                    </p>
                    <p className="truncate font-display text-[1rem] font-semibold tracking-[-0.01em] text-foreground">
                      {meta.crossLabel}
                    </p>
                  </div>
                </div>
                <Link
                  href={meta.crossHref}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 font-ui text-[0.8rem] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Read
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Footer */}
              <footer className="mt-8 border-t border-[var(--glass-border)] pt-6">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
                      <Image
                        src="/mascot/Robust.png"
                        alt="Robust"
                        width={32}
                        height={32}
                        className="object-contain dark:invert"
                      />
                    </div>
                    <p className="font-ui text-[0.75rem] text-muted-foreground">
                      &copy; {new Date().getFullYear()} Robust. All rights reserved.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-ui text-[0.75rem]">
                    <Link
                      href="/privacy-policy"
                      className={cn(
                        'transition-colors hover:text-foreground',
                        doc.kind === 'privacy'
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      Privacy Policy
                    </Link>
                    <Link
                      href="/terms-and-conditions"
                      className={cn(
                        'transition-colors hover:text-foreground',
                        doc.kind === 'terms'
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      Terms of Service
                    </Link>
                    <a
                      href={`mailto:${doc.contactEmail}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Contact
                    </a>
                  </div>
                </div>
              </footer>
            </article>

            {/* Back to top — anchored to the scroll container */}
            <button
              type="button"
              aria-label="Back to top"
              onClick={() =>
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
              }
              className={cn(
                'sticky bottom-4 z-20 ml-auto -mt-12 mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] transition-all duration-200 hover:bg-[var(--glass-active)]',
                showTop
                  ? 'opacity-100 translate-y-0'
                  : 'pointer-events-none opacity-0 translate-y-2',
              )}
            >
              <ArrowUp className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionDropdown({
  index,
  section,
  isOpen,
  onToggle,
}: {
  index: number;
  section: LegalSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      id={section.id}
      className={cn(
        PANEL_CLASS,
        'scroll-mt-4 overflow-hidden rounded-2xl transition-colors',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${section.id}-body`}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--glass-hover)] sm:px-7 sm:py-5"
      >
        <span className="font-data inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[0.8rem] font-semibold tabular-nums text-primary ring-1 ring-primary/15">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="flex-1 font-display !text-[1.0625rem] !leading-tight !font-semibold !tracking-[-0.02em] text-foreground sm:!text-[1.25rem]">
          {section.title}
        </h2>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180 text-primary',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            id={`${section.id}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--glass-border-subtle)] px-5 py-5 sm:px-7 sm:py-6">
              <MarkdownBody body={section.body} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function TocList({
  sections,
  activeId,
  onClick,
}: {
  sections: LegalSection[];
  activeId: string;
  onClick: (id: string) => React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <ol className="space-y-0.5">
      {sections.map((s, i) => {
        const isActive = s.id === activeId;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={onClick(s.id)}
              className={cn(
                'group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 font-ui text-[0.78rem] leading-snug transition-colors',
                isActive
                  ? 'bg-[var(--sidebar-icon-active)] text-foreground'
                  : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-data text-[0.625rem] font-semibold tabular-nums transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[var(--glass-hover)] text-muted-foreground group-hover:bg-[var(--glass-active)]',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="line-clamp-2">{s.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function MarkdownBody({ body }: { body: string }) {
  return (
    <div className="font-body text-[0.9375rem] leading-[1.75] text-foreground/85 sm:text-[1rem]">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mt-3 first:mt-0 text-foreground/85">{children}</p>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 font-display !text-[1.0625rem] !font-semibold !leading-snug !tracking-[-0.015em] text-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-5 mb-2 font-ui !text-[0.8rem] !font-semibold !tracking-[0.12em] uppercase text-muted-foreground">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="mt-3 space-y-1.5 pl-1">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="relative flex items-start gap-2.5 pl-1 text-foreground/85 marker:text-primary">
              <span
                aria-hidden
                className="mt-[0.6em] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
              />
              <span className="min-w-0 flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className="my-6 border-0 border-t border-[var(--glass-border-subtle)]" />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
