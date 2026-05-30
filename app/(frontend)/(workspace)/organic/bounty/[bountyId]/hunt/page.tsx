// app/(public)/bounty/[bountyId]/page.tsx

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HuntPageClient } from "./hunt-page-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type InlinePart = string | React.ReactElement;

// ─── Inline Markdown Renderer ─────────────────────────────────────────────────
// Supports: **bold**, *italic*, `code`, [text](url)

function renderInlineText(text: string, keyPrefix = ""): InlinePart[] {
  const parts: InlinePart[] = [];
  // Order matters: bold before italic to handle ** vs *
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    const key = `${keyPrefix}-${start}`;

    if (match[2] !== undefined) {
      // **bold**
      parts.push(
        <strong key={key} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined) {
      // *italic*
      parts.push(
        <em key={key} className="italic">
          {match[3]}
        </em>
      );
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(
        <code
          key={key}
          className="px-[5px] py-[2px] rounded-md bg-[var(--glass)]/60 text-[12.5px] font-mono text-[var(--sibling-accent)] border border-[var(--glass-border)]"
        >
          {match[4]}
        </code>
      );
    } else if (match[5] !== undefined && match[6] !== undefined) {
      // [text](url)
      parts.push(
        <a
          key={key}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-[3px] decoration-foreground/30 hover:decoration-foreground transition-colors"
        >
          {match[5]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// ─── Heading size map ─────────────────────────────────────────────────────────

const headingClasses: Record<number, string> = {
  1: "text-3xl sm:text-4xl font-extrabold tracking-tight mt-10 mb-4 text-foreground",
  2: "text-2xl sm:text-3xl font-bold tracking-tight mt-9 mb-3 text-foreground",
  3: "text-xl sm:text-2xl font-bold mt-8 mb-3 text-foreground",
  4: "text-lg font-semibold mt-6 mb-2 text-foreground",
  5: "text-base font-semibold mt-5 mb-2 text-foreground",
  6: "text-sm font-semibold uppercase tracking-wider mt-5 mb-2 text-muted-foreground",
};

// ─── Article Markdown Renderer ────────────────────────────────────────────────

function MarkdownArticle({ markdown }: { markdown: string }) {
  const normalized = (markdown ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const nodes: React.ReactElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // ── Blank lines ──────────────────────────────────────────────────────────
    if (!line.trim()) {
      i++;
      continue;
    }

    // ── Horizontal rule ──────────────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      nodes.push(
        <hr
          key={`hr-${i}`}
          className="my-10 border-none h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent"
        />
      );
      i++;
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length) as 1 | 2 | 3 | 4 | 5 | 6;
      const content = headingMatch[2].trim();
      const key = `h-${i}`;
      switch (level) {
        case 1:
          nodes.push(
            <h1 key={key} className={headingClasses[1]}>
              {renderInlineText(content, key)}
            </h1>
          );
          break;
        case 2:
          nodes.push(
            <h2 key={key} className={headingClasses[2]}>
              {renderInlineText(content, key)}
            </h2>
          );
          break;
        case 3:
          nodes.push(
            <h3 key={key} className={headingClasses[3]}>
              {renderInlineText(content, key)}
            </h3>
          );
          break;
        case 4:
          nodes.push(
            <h4 key={key} className={headingClasses[4]}>
              {renderInlineText(content, key)}
            </h4>
          );
          break;
        case 5:
          nodes.push(
            <h5 key={key} className={headingClasses[5]}>
              {renderInlineText(content, key)}
            </h5>
          );
          break;
        case 6:
          nodes.push(
            <h6 key={key} className={headingClasses[6]}>
              {renderInlineText(content, key)}
            </h6>
          );
          break;
      }
      i++;
      continue;
    }

    // ── Code fences ───────────────────────────────────────────────────────────
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) i++;

      nodes.push(
        <div key={`code-${i}`} className="group relative my-6">
          {lang && (
            <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-mono font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-l border-[var(--glass-border)] rounded-bl-lg rounded-tr-xl bg-[var(--glass)]/60">
              {lang}
            </div>
          )}
          <pre className="rounded-xl border border-[var(--glass-border)] bg-zinc-950 dark:bg-zinc-900 p-5 overflow-auto">
            <code className="font-mono text-[13px] leading-6 text-zinc-300">
              {codeLines.join("\n")}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    // ── Blockquotes ───────────────────────────────────────────────────────────
    if (line.trimStart().startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trimStart().startsWith("> ")) {
        quoteLines.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      nodes.push(
        <blockquote
          key={`bq-${i}`}
          className="my-6 pl-5 border-l-[3px] border-foreground/20 italic text-muted-foreground text-base leading-relaxed"
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx} className={idx > 0 ? "mt-2" : ""}>
              {renderInlineText(ql, `bq-${i}-${idx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────────────────
    if (/^(\s*)[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        const m = /^(\s*)[-*+]\s+(.+)$/.exec(l);
        if (!m) break;
        items.push(m[2].trim());
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-4 space-y-1.5 pl-6 list-disc marker:text-foreground/30">
          {items.map((it, idx) => (
            <li key={idx} className="text-[15px] leading-relaxed text-muted-foreground pl-1">
              {renderInlineText(it, `ul-${i}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────────
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        const m = /^\d+\.\s+(.+)$/.exec(l);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-4 space-y-1.5 pl-6 list-decimal marker:text-muted-foreground/50 marker:text-sm">
          {items.map((it, idx) => (
            <li key={idx} className="text-[15px] leading-relaxed text-muted-foreground pl-1">
              {renderInlineText(it, `ol-${i}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (!l.trim()) break;
      if (/^#{1,6}\s+/.test(l)) break;
      if (l.trim().startsWith("```")) break;
      if (l.trimStart().startsWith("> ")) break;
      if (/^(\s*)[-*+]\s+/.test(l)) break;
      if (/^\d+\.\s+/.test(l)) break;
      if (/^[-*_]{3,}$/.test(l.trim())) break;
      paragraphLines.push(l);
      i++;
    }

    const text = paragraphLines.join(" ").trim();
    nodes.push(
      <p
        key={`p-${i}`}
        className="text-[15.5px] leading-[1.8] text-muted-foreground my-4 first:mt-0"
      >
        {renderInlineText(text, `p-${i}`)}
      </p>
    );
  }

  return <article className="max-w-none">{nodes}</article>;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  PUBLISHED:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  DRAFT:
    "border-[var(--glass-border)] bg-[var(--glass)] text-muted-foreground",
  PENDING:
    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FAILED:
    "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    statusColors[status?.toUpperCase()] ??
    "border-[var(--glass-border)] bg-[var(--glass)] text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

// ─── Metadata Chip ────────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/50">{label}</span>
      <span className="font-semibold text-foreground/80">{value}</span>
    </div>
  );
}

// ─── Confidence Ring ──────────────────────────────────────────────────────────

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color =
    pct >= 75
      ? "stroke-emerald-500"
      : pct >= 50
      ? "stroke-amber-500"
      : "stroke-red-400";

  return (
    <div className="flex items-center gap-2">
      <svg width={36} height={36} className="-rotate-90">
        <circle cx={18} cy={18} r={r} strokeWidth={3} className="stroke-[var(--glass-border)] fill-none" />
        <circle
          cx={18}
          cy={18}
          r={r}
          strokeWidth={3}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          className={`fill-none transition-all ${color}`}
        />
      </svg>
      <div>
        <div className="text-[13px] font-bold text-foreground leading-none">{pct}%</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">confidence</div>
      </div>
    </div>
  );
}

// ─── JSON Block ───────────────────────────────────────────────────────────────

function JsonBlock({ label, value, icon }: { label: string; value: unknown; icon?: string }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);

  return (
    <details className="group rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/30 overflow-hidden transition-all">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--glass-hover)]/20 transition-colors">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {isEmpty && (
            <span className="rounded-full bg-[var(--glass)]/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-[var(--glass-border)]">
              empty
            </span>
          )}
        </div>
        <svg
          className="size-4 text-muted-foreground/50 rotate-0 group-open:rotate-180 transition-transform duration-200"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </summary>

      <div className="px-5 pb-5 pt-1">
        <div className="rounded-xl border border-[var(--glass-border)] bg-zinc-950 dark:bg-zinc-900 overflow-auto max-h-[480px]">
          <pre className="p-4 text-[12px] leading-relaxed text-zinc-300 whitespace-pre-wrap font-mono">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider({ className = "" }: { className?: string }) {
  return (
    <hr className={`border-none h-px bg-[var(--glass-border)] ${className}`} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicBountyHuntViewerPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const { bountyId } = await params;

  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId },
    select: {
      id: true,
      query: true,
      status: true,
      confidence: true,
      difficulty: true,
      pageType: true,
      huntedAt: true,
      aeoPageId: true,
      generationContext: true,
      aeoPage: {
        select: {
          id: true,
          slug: true,
          locale: true,
          pageType: true,
          status: true,
          publishedAt: true,
          title: true,
          description: true,
          facts: true,
          faq: true,
          claims: true,
          summary: true,
          knowledgeGraph: true,
          seoTitle: true,
          seoDescription: true,
          canonicalUrl: true,
        },
      },
    },
  });

  if (!bounty) return notFound();

  const aeoPage = bounty.aeoPage ?? null;

  return (
    <div className="min-h-screen">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-[var(--glass-border)] bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-bold text-foreground tracking-tight">GEO</span>
            <span className="opacity-30">/</span>
            <span>Bounty Hunt</span>
          </div>
          <StatusBadge status={bounty.status} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <HuntPageClient
          bountyId={bounty.id}
          query={bounty.query}
          hasBlog={Boolean(aeoPage)}
          blogTitle={aeoPage?.title}
          blogChildren={
              aeoPage ? (
                <div className="space-y-10">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 max-w-3xl">
                    <ConfidenceRing value={bounty.confidence} />
                    <Divider className="hidden sm:block h-8 w-px bg-[var(--glass-border)] mx-1" />
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <Chip label="Difficulty" value={bounty.difficulty} />
                      <Chip label="Locale" value={aeoPage.locale ?? "—"} />
                      {bounty.huntedAt && (
                        <Chip
                          label="Hunted"
                          value={new Date(bounty.huntedAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        />
                      )}
                      {aeoPage.publishedAt && (
                        <Chip
                          label="Published"
                          value={new Date(aeoPage.publishedAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 items-start">
                    <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/30 p-7 sm:p-10">
                      <MarkdownArticle markdown={aeoPage.description ?? ""} />
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-20">
                      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/30 p-5 space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                          Page Details
                        </h3>

                        <div className="space-y-2.5 text-sm">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-0.5">
                              URL
                            </p>
                            <p className="font-mono text-[12px] text-foreground/80 break-all">
                              /{aeoPage.locale}/{aeoPage.slug}
                            </p>
                          </div>

                          <Divider />

                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">Page type</span>
                            <span className="text-xs font-semibold text-foreground/80">
                              {aeoPage.pageType}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">Status</span>
                            <StatusBadge status={aeoPage.status} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">Locale</span>
                            <span className="text-xs font-semibold text-foreground/80">
                              {aeoPage.locale}
                            </span>
                          </div>
                        </div>

                        {aeoPage.canonicalUrl && (
                          <>
                            <Divider />
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-1">
                                Canonical URL
                              </p>
                              <a
                                href={aeoPage.canonicalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-foreground/70 hover:text-foreground underline underline-offset-2 break-all"
                              >
                                {aeoPage.canonicalUrl}
                              </a>
                            </div>
                          </>
                        )}
                      </div>

                      {(aeoPage.seoTitle || aeoPage.seoDescription) && (
                        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/30 p-5 space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                            SEO Preview
                          </h3>
                          {aeoPage.seoTitle && (
                            <p className="text-sm font-semibold text-[var(--sibling-primary)] leading-snug">
                              {aeoPage.seoTitle}
                            </p>
                          )}
                          {aeoPage.seoDescription && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {aeoPage.seoDescription}
                            </p>
                          )}
                        </div>
                      )}
                    </aside>
                  </div>
                </div>
              ) : undefined
          }
        />

        <main className="pb-10">
          {!aeoPage ? (
            /* ── Empty state ─────────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)]/20 py-20 px-8 text-center">
              <div className="mb-4 text-4xl">🎯</div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Not hunted yet
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                This bounty has no generated AEO page associated with it. Run the
                hunt to produce structured content.
              </p>
            </div>
          ) : (
            <section>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground font-heading">Article Payload</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Inspect every structured block generated for this bounty, along with the inputs
                  used during generation.
                </p>
                <p className="mt-2 text-[11px] font-mono text-muted-foreground/50">ID: {bounty.id}</p>
              </div>

              <div className="space-y-3">
                <JsonBlock icon="📝" label="Summary" value={aeoPage.summary ?? {}} />
                <JsonBlock icon="📌" label="Facts" value={aeoPage.facts ?? []} />
                <JsonBlock icon="❓" label="FAQ" value={aeoPage.faq ?? []} />
                <JsonBlock icon="💬" label="Claims" value={aeoPage.claims ?? []} />
                <JsonBlock icon="🕸️" label="Knowledge Graph (JSON-LD)" value={aeoPage.knowledgeGraph ?? {}} />
                <JsonBlock icon="⚙️" label="Generation Context (input)" value={bounty.generationContext ?? {}} />
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
