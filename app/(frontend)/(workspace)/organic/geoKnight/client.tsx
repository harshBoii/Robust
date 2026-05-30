'use client';

import { useCallback, useMemo, useState } from 'react';
import { minimalMarkdownToHtml } from '@/lib/markdown/minimalMarkdownToHtml';
import { RevenueChip } from '@/app/components/geo/revenue-chip';
import { ViewMoreDropdown } from '@/app/components/common/UI/ViewMoreDropdown';
import { focusRankingForPrompt } from '@/lib/geo/geoknight/buildRivalAnalyzeMicroPayload';
import {
  cleanCompanyNameForLabel,
  cleanCompanyNameForMatch,
  compileCompanyNameRegex,
  escapeRegExpLiteral,
  uniqueCompanyNamesForPrompt,
} from '@/lib/geo/geoknight/companyNameMatch';

// ─── Types ───────────────────────────────────────────────────────────────────

type RivalConsensus = {
  companyName: string;
  avgRank: number | null;
  mentions: number;
};

type RivalByModel = {
  model: string;
  companyName: string;
  rank: number | null;
};

type PromptRevenueView = {
  estimatedRevenue: number | null;
  monthlyPromptReach: number | null;
  visibilityWeight: number | null;
  ctr: number | null;
  cvr: number | null;
  aov: number | null;
} | null;

type PromptView = {
  id: string;
  query: string;
  reason: string | null;
  createdAt: string;
  ishunted: boolean;
  revenue: PromptRevenueView;
  consensus: RivalConsensus[];
  byModel: RivalByModel[];
};

type TopicView = {
  id: string;
  name: string;
  reason: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  createdAt: string;
  prompts: PromptView[];
};

type RivalCompanyView = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SortMode = 'recentTopics' | 'mostPrompts' | 'fewestPrompts' | 'name';
type DifficultyFilter = 'ALL' | 'EASY' | 'MEDIUM' | 'HARD';
type PromptSortMode = 'recentFirst' | 'oldestFirst' | 'queryAz';
type ShowFocusValue = 'all' | 'self' | `rival:${string}`;

function sortPromptsForDisplay(prompts: PromptView[], mode: PromptSortMode): PromptView[] {
  const copy = [...prompts];
  if (mode === 'recentFirst') {
    copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (mode === 'oldestFirst') {
    copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    copy.sort((a, b) => a.query.localeCompare(b.query));
  }
  return copy;
}

function difficultyMeta(d: 'EASY' | 'MEDIUM' | 'HARD') {
  switch (d) {
    case 'EASY':
      return {
        label: 'Easy',
        border: 'border-l-emerald-500/70',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        dot: 'bg-emerald-500',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        border: 'border-l-amber-500/70',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
        dot: 'bg-amber-500',
      };
    case 'HARD':
      return {
        label: 'Hard',
        border: 'border-l-red-500/70',
        badge: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/25',
        dot: 'bg-red-500',
      };
  }
}

function rankBadge(rank: number | null): { text: string; cls: string } {
  if (rank == null) return { text: '—', cls: 'text-muted-foreground' };
  const r = Math.round(rank * 10) / 10;
  if (r <= 1)
    return { text: `#${r}`, cls: 'font-bold text-amber-600 dark:text-amber-400' };
  if (r <= 2)
    return { text: `#${r}`, cls: 'font-semibold text-slate-500 dark:text-slate-300' };
  if (r <= 3)
    return { text: `#${r}`, cls: 'font-semibold text-orange-600 dark:text-orange-400' };
  return { text: `#${r}`, cls: 'text-muted-foreground tabular-nums' };
}

function uniqueCompanyNamesForTopic(topic: TopicView): string[] {
  const names = new Set<string>();
  for (const p of topic.prompts ?? []) {
    for (const n of uniqueCompanyNamesForPrompt(p)) names.add(n);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function parseShowFocus(raw: string): ShowFocusValue {
  if (raw === 'all' || raw === 'self') return raw;
  if (raw.startsWith('rival:')) return raw as ShowFocusValue;
  return 'all';
}

function buildInsightTopics(topics: TopicView[]) {
  return topics.map((t) => ({
    name: t.name,
    prompts: t.prompts.map((p) => ({
      query: p.query,
      consensus: p.consensus ?? [],
      byModel: p.byModel ?? [],
    })),
  }));
}

function mergeConsensusRowsBestRank(rows: RivalConsensus[]) {
  const map = new Map<string, { bestRank: number | null; mentions: number }>();
  for (const c of rows) {
    const cur = map.get(c.companyName) ?? { bestRank: null as number | null, mentions: 0 };
    cur.mentions += c.mentions;
    if (c.avgRank != null && !Number.isNaN(c.avgRank)) {
      cur.bestRank = cur.bestRank == null ? c.avgRank : Math.min(cur.bestRank, c.avgRank);
    }
    map.set(c.companyName, cur);
  }
  const out: Array<{ companyName: string; bestRank: number | null; mentions: number }> = [];
  for (const [companyName, { bestRank, mentions }] of map) {
    out.push({ companyName, bestRank, mentions });
  }
  out.sort((a, b) => a.companyName.localeCompare(b.companyName));
  return out;
}

function mergeByModelRowsBestRank(rows: RivalByModel[]) {
  const map = new Map<string, { bestRank: number | null; model: string; companyName: string }>();
  for (const c of rows) {
    const key = `${c.model}\0${c.companyName}`;
    const cur = map.get(key) ?? { bestRank: null as number | null, model: c.model, companyName: c.companyName };
    if (c.rank != null && !Number.isNaN(c.rank)) {
      cur.bestRank = cur.bestRank == null ? c.rank : Math.min(cur.bestRank, c.rank);
    }
    map.set(key, cur);
  }
  const out: RivalByModel[] = [];
  for (const { bestRank, model, companyName } of map.values()) {
    out.push({ model, companyName, rank: bestRank });
  }
  out.sort((a, b) => a.model.localeCompare(b.model) || a.companyName.localeCompare(b.companyName));
  return out;
}

// ─── Pie Chart ───────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#01696f',
  '#da7101',
  '#7a39bb',
  '#006494',
  '#437a22',
  '#a13544',
  '#d19900',
  '#4f98a3',
] as const;

function GeoMentionsPieChart({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const nonZero = segments.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);
  if (total === 0 || nonZero.length === 0) return null;

  const SIZE = 110;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R_OUT = SIZE / 2 - 3;
  const R_IN = SIZE / 2 - 22;

  let angle = -Math.PI / 2;

  const slices = nonZero.map((seg) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const a0 = angle;
    angle += sweep;
    const a1 = angle;

    if (nonZero.length === 1) {
      const d = [
        `M ${(cx + R_OUT).toFixed(2)} ${cy.toFixed(2)}`,
        `A ${R_OUT} ${R_OUT} 0 1 1 ${(cx + R_OUT - 0.01).toFixed(2)} ${cy.toFixed(2)}`,
        `Z`,
        `M ${(cx + R_IN).toFixed(2)} ${cy.toFixed(2)}`,
        `A ${R_IN} ${R_IN} 0 1 0 ${(cx + R_IN - 0.01).toFixed(2)} ${cy.toFixed(2)}`,
        `Z`,
      ].join(' ');
      return { ...seg, d, pct: 100 };
    }

    const large = sweep > Math.PI ? 1 : 0;
    const ox0 = cx + R_OUT * Math.cos(a0),
      oy0 = cy + R_OUT * Math.sin(a0);
    const ox1 = cx + R_OUT * Math.cos(a1),
      oy1 = cy + R_OUT * Math.sin(a1);
    const ix0 = cx + R_IN * Math.cos(a1),
      iy0 = cy + R_IN * Math.sin(a1);
    const ix1 = cx + R_IN * Math.cos(a0),
      iy1 = cy + R_IN * Math.sin(a0);
    const d = `M ${ox0.toFixed(2)} ${oy0.toFixed(2)} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)} L ${ix0.toFixed(2)} ${iy0.toFixed(2)} A ${R_IN} ${R_IN} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;

    return { ...seg, d, pct: Math.round((seg.value / total) * 100) };
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} className="transition-opacity hover:opacity-75" />
          ))}
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
            {total}
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7.5" fill="currentColor" opacity={0.55}>
            mentions
          </text>
        </svg>
      </div>

      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-foreground/80 truncate flex-1 min-w-0" title={s.label}>
              {s.label}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-foreground shrink-0">{s.pct}%</span>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">({s.value})</span>
          </div>
        ))}
        <div className="pt-1 border-t border-[var(--glass-border)]/40">
          <span className="text-[10px] text-muted-foreground">
            {total} total across {nonZero.length} entit{nonZero.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GeoKnightClient({
  topics,
  companyName,
  rivals,
}: {
  topics: TopicView[];
  companyName: string | null;
  rivals: RivalCompanyView[];
}) {
  const [sortMode, setSortMode] = useState<SortMode>('mostPrompts');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('ALL');
  const [showFocus, setShowFocus] = useState<string>('all');
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [selectedRivalId, setSelectedRivalId] = useState<string>('');
  const [analyzeMode, setAnalyzeMode] = useState<'rival' | 'ours'>('rival');
  const [analyzeStep, setAnalyzeStep] = useState<'idle' | 'seeding' | 'radar' | 'done' | 'error'>('idle');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [rivalRadarPayload, setRivalRadarPayload] = useState<any>(null);
  const [showAllTopicCompanies, setShowAllTopicCompanies] = useState<Record<string, boolean>>({});
  const [showAllPromptCompanies, setShowAllPromptCompanies] = useState<Record<string, boolean>>({});
  const [promptSortByTopicId, setPromptSortByTopicId] = useState<Record<string, PromptSortMode>>({});
  const [simOpen, setSimOpen] = useState(false);
  const [simPrompt, setSimPrompt] = useState<{ id: string; query: string } | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simExecs, setSimExecs] = useState<Array<{ id: string; model: string; executedAt: string; response: string }>>(
    [],
  );
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [insightMessage, setInsightMessage] = useState<string | null>(null);

  async function openSimulation(prompt: { id: string; query: string }) {
    setSimOpen(true);
    setSimPrompt(prompt);
    setSimError(null);
    setSimExecs([]);
    setSimLoading(true);
    try {
      const res = await fetch(`/api/geo/geoknight/simulate?promptId=${encodeURIComponent(prompt.id)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setSimError(data?.error ?? 'Failed to load simulation response');
        return;
      }
      setSimExecs(Array.isArray(data.executions) ? data.executions : []);
    } catch {
      setSimError('Network error while loading responses.');
    } finally {
      setSimLoading(false);
    }
  }

  const showFocusParsed = useMemo(() => parseShowFocus(showFocus), [showFocus]);

  const showFocusLabel = useMemo(() => {
    if (showFocus === 'all') return 'All prompts';
    if (showFocus === 'self') return companyName?.trim() ?? 'Your company';
    if (showFocus.startsWith('rival:')) {
      const id = showFocus.slice('rival:'.length);
      const raw = rivals.find((r) => r.id === id)?.name?.trim() ?? '';
      return cleanCompanyNameForLabel(raw) || raw || 'Rival';
    }
    return 'All prompts';
  }, [showFocus, companyName, rivals]);

  const rivalNameForFocus = useMemo(() => {
    if (showFocusParsed.startsWith('rival:')) {
      const id = showFocusParsed.slice('rival:'.length);
      const raw = rivals.find((r) => r.id === id)?.name?.trim() ?? '';
      return cleanCompanyNameForMatch(raw);
    }
    return '';
  }, [showFocusParsed, rivals]);

  const focusNameRegex = useMemo(() => {
    if (showFocusParsed === 'self') {
      const name = cleanCompanyNameForMatch(companyName?.trim() ?? '');
      return name ? compileCompanyNameRegex(escapeRegExpLiteral(name)) : null;
    }
    if (showFocusParsed.startsWith('rival:')) {
      const name = rivalNameForFocus.trim();
      return name ? compileCompanyNameRegex(escapeRegExpLiteral(name)) : null;
    }
    return null;
  }, [showFocusParsed, companyName, rivalNameForFocus]);

  const filteredTopics = useMemo(() => {
    let rows = topics.filter((t) => (difficulty === 'ALL' ? true : t.difficulty === difficulty));
    rows = rows
      .map((t) => {
        let prompts = t.prompts;
        if (focusNameRegex) {
          prompts = prompts.filter((p) => {
            const names = uniqueCompanyNamesForPrompt(p)
              .map(cleanCompanyNameForMatch)
              .filter(Boolean);
            return names.some((n) => focusNameRegex.test(n));
          });
        }
        if (prompts.length === 0) return null;
        return { ...t, prompts };
      })
      .filter((t): t is TopicView => t != null);

    const clone = [...rows];
    if (sortMode === 'recentTopics') {
      clone.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortMode === 'name') {
      clone.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'fewestPrompts') {
      clone.sort((a, b) => a.prompts.length - b.prompts.length);
    } else {
      clone.sort((a, b) => b.prompts.length - a.prompts.length);
    }
    return clone;
  }, [topics, focusNameRegex, sortMode, difficulty]);

  const filterChipsForFocus = useMemo(() => {
    if (focusNameRegex) return (names: string[]) => names.filter((n) => focusNameRegex.test(n));
    return (names: string[]) => names;
  }, [focusNameRegex]);

  const filterTableRowsForFocus = useMemo(() => {
    if (focusNameRegex) return (rowName: string) => focusNameRegex.test(rowName);
    return () => true;
  }, [focusNameRegex]);

  let promptCount = 0;
  for (const t of filteredTopics) promptCount += t.prompts.length;

  const diffCounts = useMemo(() => {
    const all = topics;
    return {
      EASY: all.filter((t) => t.difficulty === 'EASY').length,
      MEDIUM: all.filter((t) => t.difficulty === 'MEDIUM').length,
      HARD: all.filter((t) => t.difficulty === 'HARD').length,
    };
  }, [topics]);

  const sendRivalInsight = useCallback(async () => {
    const parsed = parseShowFocus(showFocus);
    if (parsed === 'all' || promptCount === 0) return;
    setInsightLoading(true);
    setInsightError(null);
    setInsightMessage(null);
    try {
      const topicsPayload = buildInsightTopics(filteredTopics);
      const focus =
        parsed === 'self'
          ? { kind: 'self' as const, displayName: companyName?.trim() ?? '' }
          : {
              kind: 'rival' as const,
              rivalCompanyId: parsed.slice('rival:'.length),
              displayName:
                cleanCompanyNameForLabel(
                  rivals.find((r) => r.id === parsed.slice('rival:'.length))?.name ?? '',
                ) ||
                rivals.find((r) => r.id === parsed.slice('rival:'.length))?.name ||
                '',
            };
      const res = await fetch('/api/geo/geoknight/rival-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus, topics: topicsPayload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setInsightError(data?.error ?? 'Get insight failed.');
        return;
      }
      setInsightMessage('Insight request completed.');
    } catch {
      setInsightError('Network error while sending insight.');
    } finally {
      setInsightLoading(false);
    }
  }, [showFocus, promptCount, filteredTopics, companyName, rivals]);

  const allMentionStats = useMemo(() => {
    const companyClean = cleanCompanyNameForMatch(companyName?.trim() ?? '');
    const companyRegex = companyClean
      ? compileCompanyNameRegex(escapeRegExpLiteral(companyClean))
      : null;

    const rivalEntries = rivals.map((r) => {
      const clean = cleanCompanyNameForMatch(r.name?.trim() ?? '');
      const label = cleanCompanyNameForLabel(r.name?.trim() ?? '') || r.name?.trim() || 'Rival';
      const regex = clean ? compileCompanyNameRegex(escapeRegExpLiteral(clean)) : null;
      return { id: r.id, label, regex, count: 0 };
    });

    let companyCount = 0;
    let otherCount = 0;

    for (const topic of topics) {
      for (const prompt of topic.prompts) {
        for (const c of prompt.consensus ?? []) {
          const rawName = c.companyName ?? '';
          const m = c.mentions ?? 1;
          if (companyRegex && companyRegex.test(rawName)) {
            companyCount += m;
          } else {
            const hit = rivalEntries.find((re) => re.regex && re.regex.test(rawName));
            if (hit) {
              hit.count += m;
            } else {
              otherCount += m;
            }
          }
        }
      }
    }

    return { companyCount, rivalEntries, otherCount };
  }, [topics, companyName, rivals]);

  const pieSegments = useMemo(() => {
    const segs: Array<{ label: string; value: number; color: string }> = [];
    if (allMentionStats.companyCount > 0) {
      segs.push({
        label: companyName?.trim() || 'Company',
        value: allMentionStats.companyCount,
        color: PIE_COLORS[0],
      });
    }
    allMentionStats.rivalEntries.forEach((r, i) => {
      if (r.count > 0) {
        segs.push({
          label: r.label,
          value: r.count,
          color: PIE_COLORS[1 + (i % (PIE_COLORS.length - 1))],
        });
      }
    });
    if (allMentionStats.otherCount > 0) {
      segs.push({ label: 'Others', value: allMentionStats.otherCount, color: '#9ca3af' });
    }
    return segs;
  }, [allMentionStats, companyName]);

  const recentCompanyPrompts = useMemo(() => {
    const companyClean = cleanCompanyNameForMatch(companyName?.trim() ?? '');
    if (!companyClean) return [];
    const regex = compileCompanyNameRegex(escapeRegExpLiteral(companyClean));
    const matched: Array<{ topicName: string; prompt: PromptView }> = [];
    for (const topic of topics) {
      for (const prompt of topic.prompts) {
        const names = uniqueCompanyNamesForPrompt(prompt)
          .map(cleanCompanyNameForMatch)
          .filter(Boolean);
        if (regex && names.some((n) => regex.test(n))) {
          matched.push({ topicName: topic.name, prompt });
        }
      }
    }
    matched.sort(
      (a, b) => new Date(b.prompt.createdAt).getTime() - new Date(a.prompt.createdAt).getTime(),
    );
    return matched.slice(0, 5);
  }, [topics, companyName]);

  async function runAnalyzeRival() {
    if (!selectedRivalId) return;
    setAnalyzeError(null);
    setRivalRadarPayload(null);
    setAnalyzeStep('seeding');
    try {
      const res = await fetch('/api/geo/geoknight/analyze-rival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rivalCompanyId: selectedRivalId, mode: analyzeMode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setAnalyzeStep('error');
        setAnalyzeError(data?.error ?? 'Analyze rival failed.');
        return;
      }
      setAnalyzeStep('radar');
      const r2 = await fetch(
        `/api/geo/geoknight/rival-radar?companyId=${encodeURIComponent(selectedRivalId)}`,
      );
      const d2 = await r2.json().catch(() => null);
      if (!r2.ok || !d2?.success) {
        setAnalyzeStep('error');
        setAnalyzeError(d2?.error ?? 'Failed to load rival radar results.');
        return;
      }
      setRivalRadarPayload(d2.payload ?? null);
      setAnalyzeStep('done');
    } catch {
      setAnalyzeStep('error');
      setAnalyzeError('Network error while analyzing rival.');
    }
  }

  const difficultyPills: { value: DifficultyFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'EASY', label: 'Easy' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HARD', label: 'Hard' },
  ];

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-[60vh] px-4 pb-8 pt-2 space-y-5">
      {/* ── Command Deck Hero ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--glass-border)] overflow-hidden">
        <div className="bg-gradient-to-br from-[var(--glass)] via-[var(--glass)]/80 to-[var(--sibling-primary)]/5 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--sibling-accent)] font-bold">
                Command Deck
              </p>
              <h1 className="mt-1.5 text-2xl font-bold text-foreground tracking-tight">GeoKnight</h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
                Strategic watchtower for topic battles. Expand fronts, inspect prompt battle briefs,
                and track rival rank formations by consensus and by model.
              </p>

              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setAnalyzeOpen(true);
                    if (!selectedRivalId && rivals.length > 0) setSelectedRivalId(rivals[0]!.id);
                    setAnalyzeStep('idle');
                    setAnalyzeError(null);
                    setRivalRadarPayload(null);
                  }}
                  disabled={!rivals || rivals.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--sibling-primary)]/90 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--sibling-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="2" />
                    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                  </svg>
                  Analyze rival
                </button>
                <span className="text-[11px] text-muted-foreground">
                  Runs seed → radar and persists results.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:w-56 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/60 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    Fronts
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                    {filteredTopics.length}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/60 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    Prompts
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{promptCount}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/60 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2">
                  Difficulty spread
                </p>
                <div className="space-y-1.5">
                  {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => {
                    const meta = difficultyMeta(d);
                    const count = diffCounts[d];
                    const pct = topics.length > 0 ? Math.round((count / topics.length) * 100) : 0;
                    return (
                      <div key={d} className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold w-12 shrink-0 ${meta.badge.split(' ').find((c) => c.startsWith('text-'))}`}
                        >
                          {meta.label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--glass-border)]/50 overflow-hidden">
                          <div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground w-5 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      <section className="glass-card rounded-xl border border-[var(--glass-border)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--glass-border)]/30">
            {difficultyPills.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  difficulty === value
                    ? 'bg-[var(--glass)] border border-[var(--glass-border)] text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden sm:block h-5 w-px bg-[var(--glass-border)]" />

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-1.5 text-xs outline-none focus:border-[var(--sibling-primary)] text-foreground"
          >
            <option value="recentTopics">Recent topics first</option>
            <option value="mostPrompts">Most prompts first</option>
            <option value="fewestPrompts">Fewest prompts first</option>
            <option value="name">Topic name A–Z</option>
          </select>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Show:</span>
            <div className="flex items-center gap-1.5">
              <ViewMoreDropdown tooltipContent="Filter by company or rival" align="right">
                {(close) => (
                  <div className="py-1 max-h-[280px] overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFocus('all');
                        setInsightError(null);
                        setInsightMessage(null);
                        close();
                      }}
                      className={`w-full px-3 py-2 text-left text-xs ${showFocus === 'all' ? 'text-primary font-medium bg-primary/10' : 'text-foreground hover:bg-[var(--glass-hover)]'}`}
                    >
                      All prompts
                    </button>
                    {companyName?.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowFocus('self');
                          setInsightError(null);
                          setInsightMessage(null);
                          close();
                        }}
                        className={`w-full px-3 py-2 text-left text-xs ${showFocus === 'self' ? 'text-primary font-medium bg-primary/10' : 'text-foreground hover:bg-[var(--glass-hover)]'}`}
                      >
                        {companyName.trim()}
                      </button>
                    ) : null}
                    {rivals.map((r) => {
                      const val = `rival:${r.id}`;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setShowFocus(val);
                            setInsightError(null);
                            setInsightMessage(null);
                            close();
                          }}
                          className={`w-full px-3 py-2 text-left text-xs ${showFocus === val ? 'text-primary font-medium bg-primary/10' : 'text-foreground hover:bg-[var(--glass-hover)]'}`}
                        >
                          {cleanCompanyNameForLabel(r.name) || r.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ViewMoreDropdown>

              <div
                className="min-w-0 max-w-[9rem] truncate rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2.5 py-1.5 text-xs text-foreground"
                title={showFocusLabel}
              >
                {showFocusLabel}
              </div>

              {showFocus !== 'all' ? (
                <button
                  type="button"
                  onClick={() => void sendRivalInsight()}
                  disabled={insightLoading || promptCount === 0}
                  className="rounded-lg border border-[var(--glass-border)] bg-[var(--sibling-primary)]/10 text-[var(--sibling-primary)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--sibling-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {insightLoading ? 'Sending…' : 'Get insight'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {insightError || insightMessage ? (
          <div className="mt-2 pt-2 border-t border-[var(--glass-border)]/50">
            {insightError && <p className="text-[11px] text-destructive">{insightError}</p>}
            {insightMessage && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{insightMessage}</p>
            )}
          </div>
        ) : null}
      </section>

      {/* ── Layout: Left 60% · Right 40% ── */}
      <div className="flex gap-4 items-start">
        {/* ── Left col ─────────────────────────────────────────────────────── */}
        <div className="flex-[60] min-w-0">
          {filteredTopics.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)]/40 py-14 flex flex-col items-center gap-3 text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/50"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
              </svg>
              <p className="text-sm text-muted-foreground">No fronts match your filters.</p>
            </div>
          ) : (
            <section className="space-y-2.5">
              {filteredTopics.map((topic) => {
                const dm = difficultyMeta(topic.difficulty);
                return (
                  <details
                    key={topic.id}
                    className={`glass-card rounded-xl border border-[var(--glass-border)] border-l-4 ${dm.border} group`}
                  >
                    <summary className="cursor-pointer list-none px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-semibold text-foreground">{topic.name}</h2>
                            <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${dm.badge}`}>
                              {dm.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {topic.prompts.length} prompt{topic.prompts.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {(() => {
                            const topicCompanies = uniqueCompanyNamesForTopic(topic);
                            const finalTopicCompanies = filterChipsForFocus(topicCompanies);
                            if (finalTopicCompanies.length === 0) return null;
                            const showAll = showAllTopicCompanies[topic.id] ?? false;
                            const visibleCompanies = showAll
                              ? finalTopicCompanies
                              : finalTopicCompanies.slice(0, 18);
                            return (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {visibleCompanies.map((name) => (
                                  <span
                                    key={name}
                                    className="text-[11px] rounded-full border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2.5 py-0.5 text-foreground/80"
                                    title={name}
                                  >
                                    {name}
                                  </span>
                                ))}
                                {finalTopicCompanies.length > 18 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setShowAllTopicCompanies((prev) => ({
                                        ...prev,
                                        [topic.id]: !showAll,
                                      }));
                                    }}
                                    className="text-[11px] rounded-full border border-[var(--sibling-primary)]/30 bg-[var(--sibling-primary)]/8 px-2.5 py-0.5 text-[var(--sibling-primary)] hover:opacity-80 transition-opacity"
                                  >
                                    {showAll ? 'Less' : `+${finalTopicCompanies.length - 18} more`}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                        <span className="text-[11px] font-semibold rounded-lg bg-[var(--sibling-primary)]/12 text-[var(--sibling-primary)] border border-[var(--sibling-primary)]/20 px-3 py-1.5 shrink-0 group-open:bg-[var(--sibling-primary)]/20">
                          Open Front
                        </span>
                      </div>
                    </summary>

                    <div className="px-5 pb-5 space-y-4">
                      <div className="rounded-xl bg-[var(--sibling-primary)]/5 border border-[var(--sibling-primary)]/15 px-4 py-3 flex gap-3">
                        <div className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-[var(--sibling-primary)]/20 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--sibling-primary)]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sibling-primary)] mb-1">
                            Topic Brief
                          </p>
                          <p className="text-xs text-foreground/85 leading-relaxed">
                            {topic.reason || 'No topic reason available.'}
                          </p>
                        </div>
                      </div>

                      {topic.prompts.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No prompts linked to this topic.</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Prompts in this topic
                            </p>
                            <select
                              value={promptSortByTopicId[topic.id] ?? 'recentFirst'}
                              onChange={(e) =>
                                setPromptSortByTopicId((prev) => ({
                                  ...prev,
                                  [topic.id]: e.target.value as PromptSortMode,
                                }))
                              }
                              className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2 py-1 text-[11px] outline-none focus:border-[var(--sibling-primary)]"
                              aria-label={`Sort prompts for ${topic.name}`}
                            >
                              <option value="recentFirst">Recent prompts first</option>
                              <option value="oldestFirst">Oldest prompts first</option>
                              <option value="queryAz">Prompt text A–Z</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            {sortPromptsForDisplay(
                              topic.prompts,
                              promptSortByTopicId[topic.id] ?? 'recentFirst',
                            ).map((prompt) => (
                              <div
                                key={prompt.id}
                                className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/40 overflow-hidden"
                              >
                                <div className="px-4 pt-3.5 pb-3 border-b border-[var(--glass-border)]/50">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground leading-snug">
                                          {prompt.query}
                                        </p>
                                        {prompt.revenue?.estimatedRevenue != null &&
                                        Number.isFinite(prompt.revenue.estimatedRevenue) ? (
                                          <RevenueChip
                                            amount={prompt.revenue.estimatedRevenue}
                                            tooltipTitle="Prompt revenue estimate"
                                            tooltipLines={[
                                              'From radar / bounty microservice revenue model.',
                                            ]}
                                            breakdown={{
                                              monthlyPromptReach: prompt.revenue.monthlyPromptReach,
                                              visibilityWeight: prompt.revenue.visibilityWeight,
                                              ctr: prompt.revenue.ctr,
                                              cvr: prompt.revenue.cvr,
                                              aov: prompt.revenue.aov,
                                            }}
                                            size="sm"
                                          />
                                        ) : null}
                                      </div>
                                      {(() => {
                                        const companies = filterChipsForFocus(
                                          uniqueCompanyNamesForPrompt(prompt),
                                        );
                                        if (companies.length === 0) return null;
                                        const showAllCompanies =
                                          showAllPromptCompanies[prompt.id] ?? false;
                                        const visibleCompanies = showAllCompanies
                                          ? companies
                                          : companies.slice(0, 14);
                                        return (
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {visibleCompanies.map((name) => (
                                              <span
                                                key={name}
                                                className="text-[11px] rounded-full border border-[var(--glass-border)] bg-[var(--glass)]/60 px-2.5 py-0.5 text-foreground/75"
                                                title={name}
                                              >
                                                {name}
                                              </span>
                                            ))}
                                            {companies.length > 14 ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setShowAllPromptCompanies((prev) => ({
                                                    ...prev,
                                                    [prompt.id]: !showAllCompanies,
                                                  }))
                                                }
                                                className="text-[11px] rounded-full border border-[var(--sibling-primary)]/30 bg-[var(--sibling-primary)]/8 px-2.5 py-0.5 text-[var(--sibling-primary)] hover:opacity-80 transition-opacity"
                                              >
                                                {showAllCompanies
                                                  ? 'Less'
                                                  : `+${companies.length - 14} more`}
                                              </button>
                                            ) : null}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openSimulation({ id: prompt.id, query: prompt.query })
                                      }
                                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/80 px-3 py-1.5 text-[11px] font-semibold text-foreground hover:border-[var(--sibling-primary)]/40 hover:bg-[var(--glass-hover)] active:scale-[0.98] transition-all"
                                    >
                                      <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                      </svg>
                                      Simulate
                                    </button>
                                  </div>
                                </div>
                                <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-5 gap-3">
                                  <div className="lg:col-span-2">
                                    <div className="rounded-lg border-l-2 border-[var(--sibling-accent)] bg-[var(--glass)]/50 px-3 py-2.5 h-full">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sibling-accent)] mb-1">
                                        Prompt Reason
                                      </p>
                                      <p className="text-xs text-foreground/85 leading-relaxed">
                                        {prompt.reason || 'No prompt reason available.'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/50 p-3">
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--sibling-primary)]" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
                                          Consensus Board
                                        </p>
                                      </div>
                                      {(() => {
                                        const rows = mergeConsensusRowsBestRank(
                                          (prompt.consensus ?? []).filter((c) =>
                                            filterTableRowsForFocus(c.companyName),
                                          ),
                                        );
                                        if (rows.length === 0)
                                          return (
                                            <p className="text-[11px] text-muted-foreground">
                                              No consensus data.
                                            </p>
                                          );
                                        return (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                              <thead>
                                                <tr className="border-b border-[var(--glass-border)]/50">
                                                  <th className="text-left py-1 pr-2 font-semibold text-muted-foreground">
                                                    Company
                                                  </th>
                                                  <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                                                    Rank
                                                  </th>
                                                  <th className="text-right py-1 pl-2 font-semibold text-muted-foreground">
                                                    Mentions
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {rows.map((c, idx) => {
                                                  const rb = rankBadge(c.bestRank);
                                                  return (
                                                    <tr
                                                      key={`${c.companyName}-${idx}`}
                                                      className="border-b border-[var(--glass-border)]/20"
                                                    >
                                                      <td className="py-1.5 pr-2 text-foreground/80 truncate max-w-[8rem]">
                                                        {c.companyName}
                                                      </td>
                                                      <td className={`py-1.5 px-2 text-right ${rb.cls}`}>
                                                        {rb.text}
                                                      </td>
                                                      <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">
                                                        {c.mentions}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/50 p-3">
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
                                          Model Duel
                                        </p>
                                      </div>
                                      {(() => {
                                        const rows = mergeByModelRowsBestRank(
                                          (prompt.byModel ?? []).filter((c) =>
                                            filterTableRowsForFocus(c.companyName),
                                          ),
                                        );
                                        if (rows.length === 0)
                                          return (
                                            <p className="text-[11px] text-muted-foreground">
                                              No model data.
                                            </p>
                                          );
                                        return (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                              <thead>
                                                <tr className="border-b border-[var(--glass-border)]/50">
                                                  <th className="text-left py-1 pr-2 font-semibold text-muted-foreground">
                                                    Model
                                                  </th>
                                                  <th className="text-left py-1 pr-2 font-semibold text-muted-foreground">
                                                    Company
                                                  </th>
                                                  <th className="text-right py-1 font-semibold text-muted-foreground">
                                                    Rank
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {rows.map((c, idx) => {
                                                  const rb = rankBadge(c.rank);
                                                  return (
                                                    <tr
                                                      key={`${c.model}-${c.companyName}-${idx}`}
                                                      className="border-b border-[var(--glass-border)]/20"
                                                    >
                                                      <td className="py-1.5 pr-2 text-foreground/60 truncate max-w-[6rem]">
                                                        {c.model}
                                                      </td>
                                                      <td className="py-1.5 pr-2 text-foreground/80 truncate max-w-[7rem]">
                                                        {c.companyName}
                                                      </td>
                                                      <td className={`py-1.5 text-right ${rb.cls}`}>
                                                        {rb.text}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                );
              })}
            </section>
          )}
        </div>

        {/* ── Right col ─────────────────────────────────────────────────────── */}
        <div
          className="flex-[30] min-w-0 flex flex-col gap-3 sticky top-4"
          style={{ height: 'calc(80vh - 7rem)' }}
        >
          {/* Pie chart panel */}
          <div
            className="glass-card rounded-xl border border-[var(--glass-border)] flex flex-col overflow-hidden"
            style={{ flex: '40 1 0', marginLeft: '12.5%' }}
          >
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--sibling-primary)]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Mention Share
              </p>
              <span className="ml-auto text-[10px] text-muted-foreground">all topics</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {pieSegments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-6">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground/40"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <p className="text-[11px] text-muted-foreground">No consensus data yet.</p>
                </div>
              ) : (
                <GeoMentionsPieChart segments={pieSegments} />
              )}
            </div>
          </div>

          {/* Recent mentions panel */}
          <div
            className="glass-card rounded-xl border border-[var(--glass-border)] flex flex-col overflow-hidden"
            style={{ flex: '60 1 0' }}
          >
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Recent Mentions
              </p>
              {companyName?.trim() ? (
                <span
                  className="ml-auto text-[10px] rounded-full border border-[var(--glass-border)] bg-[var(--glass)]/60 px-2 py-0.5 text-foreground/70 truncate max-w-[8rem]"
                  title={companyName}
                >
                  {companyName.trim()}
                </span>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {recentCompanyPrompts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-6">
                  <p className="text-[11px] text-muted-foreground">
                    {companyName?.trim()
                      ? 'No recent prompts found.'
                      : 'Set a company name to see mentions.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentCompanyPrompts.map(({ topicName, prompt }, idx) => (
                    <div
                      key={prompt.id}
                      className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/50 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-[10px] font-bold tabular-nums w-4 text-muted-foreground/60">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-foreground leading-snug line-clamp-2">
                            {prompt.query}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-[10px] text-muted-foreground truncate max-w-[10rem]"
                              title={topicName}
                            >
                              {topicName}
                            </span>
                            {prompt.revenue?.estimatedRevenue != null &&
                            Number.isFinite(prompt.revenue.estimatedRevenue) ? (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                $
                                {prompt.revenue.estimatedRevenue >= 1_000_000
                                  ? `${(prompt.revenue.estimatedRevenue / 1_000_000).toFixed(1)}M`
                                  : prompt.revenue.estimatedRevenue >= 1_000
                                    ? `${(prompt.revenue.estimatedRevenue / 1_000).toFixed(0)}K`
                                    : prompt.revenue.estimatedRevenue.toFixed(0)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                            {new Date(prompt.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Simulate modal ───────────────────────────────────────────────── */}
      {simOpen ? (
        <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSimOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-3xl rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] backdrop-blur-xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--glass-border)]/60">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--sibling-accent)] font-bold">
                  Simulation Chamber
                </p>
                <h2 className="mt-1 text-base font-semibold text-foreground line-clamp-2 leading-snug">
                  {simPrompt?.query ?? 'Prompt response'}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Latest stored model outputs for this prompt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSimOpen(false)}
                className="shrink-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)] transition-all"
              >
                ✕ Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {simLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--sibling-primary)] border-t-transparent animate-spin" />
                  <p className="text-xs text-muted-foreground">Loading responses…</p>
                </div>
              ) : simError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5">
                  <p className="text-xs text-destructive">{simError}</p>
                </div>
              ) : simExecs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)]/40 py-8 flex flex-col items-center gap-2 text-center">
                  <p className="text-xs text-muted-foreground max-w-xs">
                    No stored responses yet. Run a radar refresh to populate raw responses.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto glass-scrollbar pr-1">
                  {simExecs.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/60 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-foreground">{e.model}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(e.executedAt).toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="text-xs text-foreground/90 leading-relaxed space-y-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-[var(--glass-border)] [&_code]:bg-[var(--glass)]/70"
                        dangerouslySetInnerHTML={{
                          __html: minimalMarkdownToHtml(e.response || '—'),
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Analyze Rival modal ──────────────────────────────────────────── */}
      {analyzeOpen ? (
        <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setAnalyzeOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] backdrop-blur-xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--glass-border)]/60">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--sibling-accent)] font-bold">
                  Rival Analysis
                </p>
                <h2 className="mt-1 text-base font-semibold text-foreground">Analyze a rival</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Step 1 enriches the rival profile. Step 2 runs radar and saves results.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnalyzeOpen(false)}
                className="shrink-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/50 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Rival
                    </p>
                    <p className="text-[11px] text-muted-foreground">Competitor to seed + analyze</p>
                  </div>
                  <ViewMoreDropdown tooltipContent="Pick rival" align="right">
                    {(close) => (
                      <div className="py-1">
                        {rivals.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedRivalId(r.id);
                              close();
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-[var(--glass-hover)]"
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </ViewMoreDropdown>
                </div>
                <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-2 text-sm font-medium text-foreground">
                  {rivals.find((r) => r.id === selectedRivalId)?.name ?? 'Select a rival'}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/50 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Mode
                    </p>
                    <p className="text-[11px] text-muted-foreground">Perspective for the analysis</p>
                  </div>
                  <ViewMoreDropdown tooltipContent="Pick mode" align="right">
                    {(close) => (
                      <div className="py-1">
                        {[
                          {
                            id: 'rival' as const,
                            label: "Rival's own space",
                            desc: 'Use their BrandEntity inputs',
                          },
                          {
                            id: 'ours' as const,
                            label: 'Our battlefield',
                            desc: 'Use our BrandEntity inputs',
                          },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setAnalyzeMode(opt.id);
                              close();
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--glass-hover)]"
                          >
                            <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                            <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ViewMoreDropdown>
                </div>
                <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-2 text-sm font-medium text-foreground">
                  {analyzeMode === 'rival' ? "Rival's own space" : 'Our battlefield'}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/40 px-4 py-3">
              <div className="flex items-center gap-2">
                {analyzeStep === 'seeding' || analyzeStep === 'radar' ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--sibling-primary)] border-t-transparent animate-spin" />
                ) : analyzeStep === 'done' ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  </div>
                ) : analyzeStep === 'error' ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-destructive/80" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--glass-border)]" />
                )}
                <span className="text-xs text-muted-foreground">
                  Status:{' '}
                  <span className="font-semibold text-foreground">
                    {analyzeStep === 'idle'
                      ? 'Ready'
                      : analyzeStep === 'seeding'
                        ? 'Seeding rival…'
                        : analyzeStep === 'radar'
                          ? 'Running radar…'
                          : analyzeStep === 'done'
                            ? 'Done'
                            : 'Error'}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={runAnalyzeRival}
                disabled={
                  !selectedRivalId || analyzeStep === 'seeding' || analyzeStep === 'radar'
                }
                className="rounded-lg bg-[var(--sibling-primary)]/90 text-white px-4 py-2 text-xs font-semibold hover:bg-[var(--sibling-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Run analysis
              </button>
            </div>

            {analyzeError ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2">
                <p className="text-xs text-destructive">{analyzeError}</p>
              </div>
            ) : null}

            {analyzeStep === 'done' && rivalRadarPayload ? (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-semibold text-foreground mb-3">
                  Latest rival radar snapshot
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      label: 'Share of voice',
                      value:
                        rivalRadarPayload?.latest?.shareOfVoice != null
                          ? `${Number(rivalRadarPayload.latest.shareOfVoice).toFixed(1)}%`
                          : '—',
                    },
                    {
                      label: 'Top-3 rate',
                      value:
                        rivalRadarPayload?.latest?.top3Rate != null
                          ? `${Number(rivalRadarPayload.latest.top3Rate).toFixed(0)}%`
                          : '—',
                    },
                    {
                      label: 'Query coverage',
                      value:
                        rivalRadarPayload?.latest?.queryCoverage != null
                          ? `${Number(rivalRadarPayload.latest.queryCoverage).toFixed(1)}%`
                          : '—',
                    },
                    {
                      label: 'Competitor rank',
                      value:
                        rivalRadarPayload?.latest?.competitorRank != null
                          ? `#${Number(rivalRadarPayload.latest.competitorRank).toFixed(1)}`
                          : '—',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/60 p-3"
                    >
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-base font-bold text-foreground tabular-nums">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] text-muted-foreground">
                  Data from persisted radar metrics for the rival company.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
