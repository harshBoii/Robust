'use client';

import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  FileText,
  Mail,
  ShieldCheck,
  ScrollText,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

export default function LegalLayout({ doc }: { doc: LegalDocument }) {
  const meta = DOC_META[doc.kind];
  const Icon = meta.Icon;
  const CrossIcon = meta.CrossIcon;

  const [activeId, setActiveId] = useState<string>(doc.sections[0]?.id ?? '');
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
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
      { rootMargin: '-30% 0px -60% 0px', threshold: [0, 1] },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [doc.sections]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[640px]"
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

      {/* Top navigation */}
      <header className="glass-navbar sticky top-0 z-40">
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
              className="glass-button inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-ui text-[0.8rem] font-medium text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to site</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-14 pb-10 sm:px-8 sm:pt-20 sm:pb-14">
        <div className="flex flex-col items-start gap-6">
          <span className="glass-badge inline-flex items-center gap-1.5 !text-[0.7rem]">
            <Icon className="h-3.5 w-3.5" />
            {doc.eyebrow}
          </span>

          <h1 className="max-w-3xl font-display text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-[3rem] md:text-[3.5rem]">
            {doc.title}
          </h1>

          <p className="max-w-2xl font-body text-[1rem] leading-relaxed text-muted-foreground sm:text-[1.0625rem]">
            {doc.subtitle}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-1.5 font-ui text-[0.75rem] font-medium text-foreground/80 backdrop-blur-[var(--glass-blur)]">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">Effective</span>
              <span>{doc.effectiveDate}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-1.5 font-ui text-[0.75rem] font-medium text-foreground/80 backdrop-blur-[var(--glass-blur)]">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">Last updated</span>
              <span>{doc.lastUpdated}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-24 sm:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
          {/* TOC – sticky on desktop, collapsible on mobile */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <details className="glass-card rounded-2xl p-2 open:p-2 lg:open:p-0 lg:!p-0 lg:[&>summary]:hidden" open>
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2.5 font-ui text-[0.8rem] font-semibold tracking-wide text-foreground lg:hidden">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Table of Contents
                </span>
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
              </summary>
              <div className="hidden items-center gap-2 px-4 pt-4 pb-3 lg:flex">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-ui text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Contents
                </span>
              </div>
              <nav className="max-h-[60vh] overflow-y-auto px-2 pb-2 lg:max-h-[calc(100vh-12rem)] lg:px-2 lg:pb-4">
                <ol className="space-y-0.5">
                  {doc.sections.map((s, i) => {
                    const isActive = s.id === activeId;
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className={cn(
                            'group flex items-start gap-2.5 rounded-lg px-3 py-2 font-ui text-[0.8rem] leading-snug transition-colors',
                            isActive
                              ? 'bg-[var(--sidebar-icon-active)] text-foreground'
                              : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-data text-[0.65rem] font-semibold tabular-nums transition-colors',
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
              </nav>
            </details>
          </aside>

          {/* Content */}
          <article className="min-w-0">
            {/* Intro card */}
            <div className="glass-card-elevated mb-6 rounded-2xl p-6 sm:p-8">
              <p className="font-body text-[1rem] leading-relaxed text-foreground/90 sm:text-[1.0625rem]">
                {doc.intro}
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-5">
              {doc.sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  className="glass-card scroll-mt-24 rounded-2xl p-6 sm:p-8"
                >
                  <header className="mb-4 flex items-start gap-3 border-b border-[var(--glass-border-subtle)] pb-4">
                    <span className="font-data inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[0.8rem] font-semibold tabular-nums text-primary ring-1 ring-primary/15">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 className="font-display !text-[1.25rem] !leading-tight !font-semibold !tracking-[-0.02em] text-foreground sm:!text-[1.5rem]">
                      {s.title}
                    </h2>
                  </header>
                  <MarkdownBody body={s.body} />
                </section>
              ))}
            </div>

            {/* Contact CTA */}
            <div
              className="mt-10 overflow-hidden rounded-2xl border border-[var(--glass-border)] p-6 sm:p-8"
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
                  className="glass-button-primary inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 font-ui text-[0.875rem] font-semibold text-primary-foreground [text-shadow:0_1px_2px_rgba(0,0,0,0.14)]"
                >
                  <Mail className="h-4 w-4" />
                  {doc.contactEmail}
                </a>
              </div>
            </div>

            {/* Cross-link */}
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 backdrop-blur-[var(--glass-blur)] sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-hover)]">
                  <CrossIcon className="h-4.5 w-4.5 text-foreground" />
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
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 font-ui text-[0.8rem] font-semibold text-primary hover:underline underline-offset-4"
              >
                Read
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--glass-border)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
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

      {/* Back to top */}
      <button
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'glass-button fixed right-5 bottom-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200',
          showTop ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3',
        )}
      >
        <ArrowUp className="h-4 w-4 text-foreground" />
      </button>
    </div>
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
