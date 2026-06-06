'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ModalPortal } from '@/app/components/common/ModalPortal';

type Props = {
  onClose: () => void;
  onConnected?: () => void;
};

type IntegrationStatus = {
  id: string;
  customerId?: string | null;
  loginCustomerId?: string | null;
  conversionActionId?: string | null;
} | null;

export function GoogleAdsConnectionModal({ onClose, onConnected }: Props) {
  const [integration, setIntegration] = useState<IntegrationStatus>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [conversionActionId, setConversionActionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isConnected = Boolean(integration?.customerId);

  useEffect(() => {
    fetch('/api/google-ads/integration', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { integration: IntegrationStatus }) => {
        if (d.integration) {
          setIntegration(d.integration);
          setCustomerId(d.integration.customerId ?? '');
          setLoginCustomerId(d.integration.loginCustomerId ?? '');
          setConversionActionId(d.integration.conversionActionId ?? '');
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/google-ads/integration', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, loginCustomerId, conversionActionId }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Save failed');
      }
      setSaved(true);
      onConnected?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <ModalBackdrop onClose={onClose} contentClassName="max-w-lg">
        <div className="max-h-[90vh] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
            <h3 className="font-display text-sm font-semibold">Google Ads connection</h3>
            <button type="button" onClick={onClose} className="glass-button rounded-lg p-1.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="custom-scrollbar max-h-[calc(90vh-3.5rem)] overflow-y-auto p-4 space-y-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {/* OAuth connect button */}
                {!integration ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect your Google Ads account to create Search, Display, and Performance Max campaigns from Robust.
                    </p>
                    <a
                      href="/api/auth/google-ads/start"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Connect Google Ads
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isConnected ? (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                        <Check className="h-4 w-4 shrink-0" />
                        Google Ads connected — customer ID configured
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        OAuth connected — enter your Customer ID below to finish setup
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Customer ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          placeholder="e.g. 1234567890 (no dashes)"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Your 10-digit Google Ads account ID. Find it in the top-right of Google Ads UI.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Manager (MCC) Account ID
                        </label>
                        <input
                          type="text"
                          value={loginCustomerId}
                          onChange={(e) => setLoginCustomerId(e.target.value)}
                          placeholder="Only needed if accessing via MCC"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Conversion Action Resource Name
                        </label>
                        <input
                          type="text"
                          value={conversionActionId}
                          onChange={(e) => setConversionActionId(e.target.value)}
                          placeholder="customers/XXX/conversionActions/YYY"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}

                    {saved && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">Settings saved.</p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || !customerId.trim()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <a
                        href="/api/auth/google-ads/start"
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Re-connect OAuth
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
