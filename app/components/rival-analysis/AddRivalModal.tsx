'use client';

import { useState } from 'react';
import { X, Globe, FileText, Tag } from 'lucide-react';

import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ModalPortal } from '@/app/components/common/ModalPortal';

interface AddRivalModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (rival: { id: string; brandName: string; pageName: string; country: string }) => void;
}

const COUNTRIES = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AE', label: 'UAE' },
];

export default function AddRivalModal({ open, onClose, onCreated }: AddRivalModalProps) {
  const [brandName, setBrandName] = useState('');
  const [pageName, setPageName] = useState('');
  const [country, setCountry] = useState('IN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/rival-analysis/rivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: brandName.trim(), pageName: pageName.trim(), country }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to add rival.');
        return;
      }
      onCreated(data.rival);
      setBrandName('');
      setPageName('');
      setCountry('IN');
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalPortal open={open}>
      <ModalBackdrop onClose={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--card)] p-6 shadow-2xl">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Add Rival Brand</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We&apos;ll scrape their Facebook Ad Library for intelligence.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Brand Name */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="e.g. Nykaa"
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[var(--sibling-primary)] focus:ring-1 focus:ring-[var(--sibling-primary)]/30 transition-all"
              />
            </div>

            {/* Facebook Page Name */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Facebook Page Name
                <span className="ml-auto text-[10px] text-muted-foreground/60">used for Ad Library search</span>
              </label>
              <input
                type="text"
                value={pageName}
                onChange={e => setPageName(e.target.value)}
                placeholder="e.g. Nykaa Beauty"
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[var(--sibling-primary)] focus:ring-1 focus:ring-[var(--sibling-primary)]/30 transition-all"
              />
            </div>

            {/* Country */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                Country
              </label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--sibling-primary)] focus:ring-1 focus:ring-[var(--sibling-primary)]/30 transition-all"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-[var(--sibling-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Adding…' : 'Add Rival'}
              </button>
            </div>
          </form>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
