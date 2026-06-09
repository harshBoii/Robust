'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, AlertCircle, Loader2, Swords } from 'lucide-react';

import AddRivalModal from './AddRivalModal';
import RivalAdCard, { type RivalAdCardData } from './RivalAdCard';
import AdDetailModal from './AdDetailModal';
import IntelligenceSummary from './IntelligenceSummary';

interface RivalEntry {
  id: string;
  brandName: string;
  pageName: string;
  country: string;
  scrapeRuns: { id: string; status: string; createdAt: string }[];
}

type RunStatus = 'IDLE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

interface RunData {
  status: RunStatus;
  ads: RivalAdCardData[];
  summary: string | null;
  error: string | null;
}

const POLL_INTERVAL = 3500;

export default function RivalAnalysisClient() {
  const [rivals, setRivals] = useState<RivalEntry[]>([]);
  const [activeRivalId, setActiveRivalId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<RivalAdCardData | null>(null);

  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunData>({ status: 'IDLE', ads: [], summary: null, error: null });
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── fetch rivals list ──────────────────────────────────────────
  const fetchRivals = useCallback(async () => {
    const res = await fetch('/api/rival-analysis/rivals');
    if (!res.ok) return;
    const data = await res.json();
    setRivals(data.rivals ?? []);
    if (!activeRivalId && data.rivals?.length) {
      setActiveRivalId(data.rivals[0].id);
    }
  }, [activeRivalId]);

  useEffect(() => { fetchRivals(); }, [fetchRivals]);

  // ── load latest run when active rival changes ─────────────────
  useEffect(() => {
    if (!activeRivalId) return;
    const rival = rivals.find(r => r.id === activeRivalId);
    const latestRun = rival?.scrapeRuns?.[0];
    if (!latestRun) {
      setRun({ status: 'IDLE', ads: [], summary: null, error: null });
      setRunId(null);
      return;
    }
    setRunId(latestRun.id);
    if (latestRun.status === 'DONE' || latestRun.status === 'FAILED') {
      fetchRunData(latestRun.id);
    } else {
      setRun(prev => ({ ...prev, status: latestRun.status as RunStatus }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRivalId, rivals]);

  // ── polling ───────────────────────────────────────────────────
  const fetchRunData = useCallback(async (id: string) => {
    const res = await fetch(`/api/rival-analysis/run/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setRun({
      status: data.status,
      ads: data.ads ?? [],
      summary: data.summary ?? null,
      error: data.error ?? null,
    });
    return data.status as RunStatus;
  }, []);

  useEffect(() => {
    if (!runId) return;
    if (run.status === 'DONE' || run.status === 'FAILED' || run.status === 'IDLE') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const status = await fetchRunData(runId);
      if (status === 'DONE' || status === 'FAILED') {
        clearInterval(pollRef.current!);
      }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runId, run.status, fetchRunData]);

  // ── start new run ─────────────────────────────────────────────
  async function startRun() {
    if (!activeRivalId) return;
    setStarting(true);
    setRun({ status: 'PENDING', ads: [], summary: null, error: null });
    try {
      const res = await fetch('/api/rival-analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyRivalId: activeRivalId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRun({ status: 'FAILED', ads: [], summary: null, error: data.error ?? 'Failed to start.' });
        return;
      }
      setRunId(data.runId);
      setRun({ status: 'PENDING', ads: [], summary: null, error: null });
    } catch {
      setRun({ status: 'FAILED', ads: [], summary: null, error: 'Network error.' });
    } finally {
      setStarting(false);
    }
  }

  function handleRivalCreated(rival: { id: string; brandName: string; pageName: string; country: string }) {
    const entry: RivalEntry = { ...rival, scrapeRuns: [] };
    setRivals(prev => [...prev, entry]);
    setActiveRivalId(rival.id);
    setRun({ status: 'IDLE', ads: [], summary: null, error: null });
    setRunId(null);
  }

  const activeRival = rivals.find(r => r.id === activeRivalId);
  const isRunning = run.status === 'PENDING' || run.status === 'PROCESSING';

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-0 overflow-y-auto">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[var(--background)]/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--sibling-primary)]/20">
              <Swords className="h-4 w-4 text-[var(--sibling-primary)]" />
            </span>
            <div>
              <h1 className="font-heading text-lg font-semibold text-foreground">Rival Analysis</h1>
              <p className="text-[11px] text-muted-foreground">Facebook Ad Library intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeRivalId && (
              <button
                onClick={startRun}
                disabled={isRunning || starting}
                className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {isRunning ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scraping…</>
                ) : (
                  <><RefreshCw className="h-3.5 w-3.5" /> Run Analysis</>
                )}
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              Add Rival
            </button>
          </div>
        </div>

        {/* ── Rival chips ── */}
        {rivals.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {rivals.map(rival => (
              <motion.button
                key={rival.id}
                layout
                onClick={() => {
                  setActiveRivalId(rival.id);
                  setRun({ status: 'IDLE', ads: [], summary: null, error: null });
                  setRunId(null);
                }}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                  rival.id === activeRivalId
                    ? 'border-[var(--sibling-primary)] bg-[var(--sibling-primary)]/20 text-[var(--sibling-primary)]'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground'
                }`}
              >
                {rival.brandName}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 px-6 pb-10 pt-6">
        {/* Empty state — no rivals */}
        {rivals.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Swords className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-heading text-base font-semibold text-foreground">No rivals yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Add a rival brand to start scraping their Facebook ads and get competitive intelligence.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="glass-button-primary flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Add Your First Rival
            </button>
          </div>
        )}

        {/* Empty state — rival selected but never run */}
        {activeRival && run.status === 'IDLE' && !isRunning && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p className="font-heading text-base font-semibold text-foreground">
              Ready to analyse <span className="text-[var(--sibling-primary)]">{activeRival.brandName}</span>
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Hit &ldquo;Run Analysis&rdquo; to scrape their active Facebook ads.
            </p>
          </div>
        )}

        {/* Running spinner */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-20 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[var(--sibling-primary)]" />
              <p className="font-heading text-base font-semibold text-foreground">
                {run.status === 'PENDING' ? 'Starting scrape…' : 'Scraping ads & running analysis…'}
              </p>
              <p className="text-sm text-muted-foreground">
                This can take 1–3 minutes. You can stay on the page.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {run.status === 'FAILED' && run.error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Scrape failed</p>
              <p className="text-xs text-destructive/80">{run.error}</p>
            </div>
          </div>
        )}

        {/* Ad grid (2 rows × 3 cols) */}
        {run.ads.length > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3"
            >
              {run.ads.map(ad => (
                <RivalAdCard
                  key={ad.id}
                  ad={ad}
                  onClick={() => setSelectedAd(ad)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Intelligence summary */}
        {run.summary && activeRival && (
          <IntelligenceSummary markdown={run.summary} brandName={activeRival.brandName} />
        )}
      </div>

      {/* Modals */}
      <AddRivalModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleRivalCreated}
      />
      <AdDetailModal ad={selectedAd} onClose={() => setSelectedAd(null)} />
    </div>
  );
}
