'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RadarRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/geo/radar', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError(data?.error ?? 'Failed to refresh radar data');
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Radar refresh error', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <RefreshIcon />
        )}
        Refresh data
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}
