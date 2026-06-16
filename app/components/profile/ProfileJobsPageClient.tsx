'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Play, Settings2 } from 'lucide-react';

import { ProfileSecondaryNav } from '@/app/components/profile/ProfileSecondaryNav';
import {
  profileCard,
  profileCardHeaderCompact,
  profileGhostButton,
  profilePageShell,
  profileStatusBadge,
  formatProfileDate,
} from '@/app/components/profile/profile-utils';
import { SPREAD_PLATFORM_OPTIONS } from '@/lib/geo/bounty/spread-platforms';
import type { BountySpreadPlatform } from '@/app/generated/prisma/client';

type JobFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';
type CompanyJobType =
  | 'META_AUTO_ADS'
  | 'BOUNTY_PAGE_GENERATION'
  | 'BOUNTY_TOPIC_SCAN'
  | 'RADAR_PROMPT_REFRESH';

type JobRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type JobRow = {
  id: string;
  jobType: CompanyJobType;
  label: string;
  enabled: boolean;
  frequency: JobFrequency;
  frequencyLabel: string;
  settings: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  recentRuns: JobRun[];
};

const FREQUENCIES: JobFrequency[] = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'];

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function statusBadgeClass(status: string) {
  if (status === 'SUCCESS') return profileStatusBadge.success;
  if (status === 'SKIPPED') return profileStatusBadge.warning;
  return 'bg-destructive/10 text-destructive';
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-border/40 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
    </label>
  );
}

function JobCard({
  job,
  saving,
  running,
  onPatch,
  onRunNow,
}: {
  job: JobRow;
  saving: boolean;
  running: boolean;
  onPatch: (partial: Partial<JobRow>) => void;
  onRunNow: () => void;
}) {
  const lastRun = job.recentRuns[0];
  const settings = job.settings;

  return (
    <div className={profileCard}>
      <div className={profileCardHeaderCompact}>
        <div>
          <h2 className="font-display text-[13px] font-semibold">{job.label}</h2>
          {job.jobType === 'META_AUTO_ADS' ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Creative defaults live in{' '}
              <Link href="/profile/ads-automation" className="text-primary hover:underline">
                Ads Automation
              </Link>
              .
            </p>
          ) : job.jobType === 'BOUNTY_PAGE_GENERATION' ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Max batch (5 pages) needs ≥ 20 min spacing between microservice calls.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunNow}
            disabled={running || saving}
            className={`${profileGhostButton} gap-1`}
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run now
          </button>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        <ToggleRow
          label="Enabled"
          description="Run on schedule via Upstash QStash"
          checked={job.enabled}
          onChange={(enabled) => onPatch({ enabled })}
        />

        <div>
          <label className="text-[12px] font-medium text-muted-foreground">Frequency</label>
          <select
            value={job.frequency}
            onChange={(e) => onPatch({ frequency: e.target.value as JobFrequency })}
            className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f === 'DAILY'
                  ? 'Daily'
                  : f === 'WEEKLY'
                    ? 'Weekly'
                    : f === 'BIWEEKLY'
                      ? 'Every 2 weeks'
                      : 'Monthly'}
              </option>
            ))}
          </select>
        </div>

        {job.jobType === 'META_AUTO_ADS' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Ads per run</label>
              <input
                type="number"
                min={1}
                max={5}
                value={Number(settings.adsPerRun ?? 1)}
                onChange={(e) =>
                  onPatch({
                    settings: {
                      ...settings,
                      adsPerRun: Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                    },
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Publish mode</label>
              <select
                value={String(settings.publishMode ?? 'draft')}
                onChange={(e) =>
                  onPatch({
                    settings: { ...settings, publishMode: e.target.value },
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
              >
                <option value="draft">Save as draft / pending</option>
                <option value="publish">Publish to Meta</option>
              </select>
            </div>
          </div>
        ) : null}

        {job.jobType === 'BOUNTY_PAGE_GENERATION' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[12px] font-medium text-muted-foreground">Min pages</label>
                <input
                  type="number"
                  min={2}
                  max={5}
                  value={Number(settings.minPages ?? 2)}
                  onChange={(e) =>
                    onPatch({
                      settings: {
                        ...settings,
                        minPages: Math.min(5, Math.max(2, Number(e.target.value) || 2)),
                      },
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-muted-foreground">Max pages</label>
                <input
                  type="number"
                  min={2}
                  max={5}
                  value={Number(settings.maxPages ?? 5)}
                  onChange={(e) =>
                    onPatch({
                      settings: {
                        ...settings,
                        maxPages: Math.min(5, Math.max(2, Number(e.target.value) || 5)),
                      },
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
                />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Platforms</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPREAD_PLATFORM_OPTIONS.map((opt) => {
                  const selected = Array.isArray(settings.platforms)
                    ? (settings.platforms as string[]).includes(opt.value)
                    : false;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(settings.platforms)
                          ? ([...settings.platforms] as BountySpreadPlatform[])
                          : [];
                        const next = selected
                          ? current.filter((p) => p !== opt.value)
                          : [...current, opt.value];
                        onPatch({ settings: { ...settings, platforms: next } });
                      }}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}

        <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Last run: {job.lastRunAt ? formatProfileDate(job.lastRunAt) : 'Never'}
          </div>
          {lastRun ? (
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(lastRun.status)}`}
              >
                {lastRun.status}
              </span>
              {lastRun.error ? <span className="text-destructive">{lastRun.error}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProfileJobsPageClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<CompanyJobType | null>(null);
  const [runningType, setRunningType] = useState<CompanyJobType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<{ jobs: JobRow[] }>(
        await fetch('/api/company/jobs', { credentials: 'include' }),
      );
      setJobs(data.jobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveJob = async (job: JobRow) => {
    setSavingType(job.jobType);
    setError(null);
    try {
      const data = await json<{ job: JobRow }>(
        await fetch('/api/company/jobs', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobType: job.jobType,
            enabled: job.enabled,
            frequency: job.frequency,
            settings: job.settings,
          }),
        }),
      );
      setJobs((prev) => prev.map((j) => (j.jobType === job.jobType ? { ...j, ...data.job } : j)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingType(null);
    }
  };

  const runNow = async (jobType: CompanyJobType) => {
    setRunningType(jobType);
    setError(null);
    try {
      await json(
        await fetch(`/api/company/jobs/${jobType}/run-now`, {
          method: 'POST',
          credentials: 'include',
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunningType(null);
    }
  };

  const patchLocal = (jobType: CompanyJobType, partial: Partial<JobRow>) => {
    setJobs((prev) =>
      prev.map((j) => (j.jobType === jobType ? { ...j, ...partial } : j)),
    );
  };

  if (loading) {
    return (
      <div className={`${profilePageShell} flex items-center justify-center py-20`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={profilePageShell}>
      <div className={`${profileCard} mb-4`}>
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <div>
                <h1 className="font-display text-lg font-semibold text-foreground">
                  Background Jobs
                </h1>
                <p className="text-[12px] text-muted-foreground">
                  Schedule automated ads, bounty pages, topic scans, and radar refreshes per company.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-border px-3 py-2">
          <ProfileSecondaryNav />
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map((job) => (
          <div key={job.jobType} className="space-y-2">
            <JobCard
              job={job}
              saving={savingType === job.jobType}
              running={runningType === job.jobType}
              onPatch={(partial) => patchLocal(job.jobType, partial)}
              onRunNow={() => void runNow(job.jobType)}
            />
            <button
              type="button"
              onClick={() => void saveJob(job)}
              disabled={savingType === job.jobType}
              className={`${profileGhostButton} w-full justify-center font-semibold disabled:opacity-60`}
            >
              {savingType === job.jobType ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save job settings'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
