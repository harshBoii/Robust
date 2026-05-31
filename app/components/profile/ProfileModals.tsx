'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { X } from 'lucide-react';

import { useToast } from '@/app/components/UI/ToastProvider';
import { ModalPortal } from '@/app/components/common/ModalPortal';
import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ProfileLogoField } from '@/app/components/profile/ProfileLogoField';
import type { CompanyProfile } from '@/lib/profile/company-profile';
import { formatProfileDate } from '@/app/components/profile/profile-utils';

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
};

function ModalShell({ title, onClose, children, wide }: ModalShellProps) {
  return (
    <ModalPortal>
      <ModalBackdrop onClose={onClose} contentClassName={wide ? 'max-w-lg' : 'max-w-md'}>
        <div className="max-h-[85vh] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
            <h3 className="font-display text-sm font-semibold">{title}</h3>
            <button type="button" onClick={onClose} className="glass-button rounded-lg p-1.5">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="custom-scrollbar max-h-[calc(85vh-3.5rem)] overflow-y-auto p-4">{children}</div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

const inputClass =
  'glass-input w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function EditProfileModal({
  profile,
  onClose,
}: {
  profile: CompanyProfile;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email ?? '');
  const [description, setDescription] = useState(profile.description ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');
  const [domain, setDomain] = useState(profile.domain ?? '');
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl ?? '');
  const [logoAssetId, setLogoAssetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const logoPayload = logoAssetId
        ? { logoAssetId }
        : { logoUrl: logoUrl.trim() || null };

      await json(
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || null,
            description: description.trim() || null,
            website: website.trim() || null,
            domain: domain.trim() || null,
            ...logoPayload,
          }),
        }),
      );
      toast.push({ title: 'Profile updated', kind: 'success' });
      onClose();
      router.refresh();
    } catch (e) {
      toast.push({
        title: 'Could not save profile',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Edit profile" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Company name</span>
          <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Email</span>
          <input className={`${inputClass} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Description</span>
          <textarea
            className={`${inputClass} mt-1 min-h-[72px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Website</span>
          <input className={`${inputClass} mt-1`} value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Domain</span>
          <input className={`${inputClass} mt-1`} value={domain} onChange={(e) => setDomain(e.target.value)} />
        </label>
        <ProfileLogoField
          companyId={profile.id}
          logoUrl={logoUrl}
          logoAssetId={logoAssetId}
          onLogoUrlChange={(url) => {
            setLogoUrl(url);
            setLogoAssetId(null);
          }}
          onGallerySelect={({ assetId, previewUrl }) => {
            setLogoAssetId(assetId);
            setLogoUrl(previewUrl);
          }}
          onClearGallery={() => setLogoAssetId(null)}
        />
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void handleSave()}
          className="glass-button-primary mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </ModalShell>
  );
}

export function PasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (next !== confirm) {
      toast.push({ title: 'Passwords do not match', kind: 'error' });
      return;
    }
    setSaving(true);
    try {
      await json(
        await fetch('/api/profile/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        }),
      );
      toast.push({ title: 'Password updated', kind: 'success' });
      onClose();
    } catch (e) {
      toast.push({
        title: 'Could not change password',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Change password" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Current password</span>
          <input
            type="password"
            className={`${inputClass} mt-1`}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">New password</span>
          <input
            type="password"
            className={`${inputClass} mt-1`}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-ui text-[11px] font-medium text-muted-foreground">Confirm new password</span>
          <input
            type="password"
            className={`${inputClass} mt-1`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={saving || !current || !next}
          onClick={() => void handleSave()}
          className="glass-button-primary mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </ModalShell>
  );
}

export function TwoFactorModal({
  enabled,
  onClose,
  onChanged,
}: {
  enabled: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'enable' | 'disable'>(enabled ? 'disable' : 'enable');

  const loadSetup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await json<{ qrDataUrl: string }>(
        await fetch('/api/profile/2fa/setup', { method: 'POST' }),
      );
      setQrDataUrl(data.qrDataUrl);
    } catch (e) {
      toast.push({
        title: 'Could not start 2FA setup',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mode === 'enable' && !enabled) void loadSetup();
  }, [mode, enabled, loadSetup]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const path = mode === 'enable' ? '/api/profile/2fa/enable' : '/api/profile/2fa/disable';
      await json(
        await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
      );
      toast.push({
        title: mode === 'enable' ? '2FA enabled' : '2FA disabled',
        kind: 'success',
      });
      onChanged();
      onClose();
    } catch (e) {
      toast.push({
        title: 'Verification failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title={mode === 'enable' ? 'Enable two-factor authentication' : 'Disable two-factor authentication'} onClose={onClose}>
      {mode === 'enable' && !enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the 6-digit code.
          </p>
          {loading && !qrDataUrl ? (
            <div className="flex justify-center py-8">
              <AiOutlineLoading className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : qrDataUrl ? (
            <div className="mx-auto w-fit rounded-xl border border-[var(--glass-border)] bg-card p-3">
              <Image src={qrDataUrl} alt="2FA QR code" width={200} height={200} unoptimized />
            </div>
          ) : null}
          <input
            className={inputClass}
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            type="button"
            disabled={loading || code.length !== 6}
            onClick={() => void handleSubmit()}
            className="glass-button-primary w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Enable 2FA
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Enter your current authenticator code to disable 2FA.</p>
          <input
            className={inputClass}
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            type="button"
            disabled={loading || code.length !== 6}
            onClick={() => void handleSubmit()}
            className="w-full rounded-xl border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50"
          >
            Disable 2FA
          </button>
        </div>
      )}
    </ModalShell>
  );
}

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
};

export function SessionsModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await json<{ sessions: SessionRow[] }>(await fetch('/api/profile/sessions'));
      setSessions(data.sessions);
    } catch (e) {
      toast.push({
        title: 'Could not load sessions',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    try {
      await json(await fetch(`/api/profile/sessions/${id}`, { method: 'DELETE' }));
      toast.push({ title: 'Session revoked', kind: 'success' });
      void load();
    } catch (e) {
      toast.push({
        title: 'Could not revoke session',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    }
  };

  return (
    <ModalShell title="Active sessions" onClose={onClose} wide>
      {loading ? (
        <div className="flex justify-center py-8">
          <AiOutlineLoading className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-[var(--glass-border)] px-3 py-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {s.isCurrent ? 'This device' : s.userAgent?.slice(0, 48) ?? 'Unknown device'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.ipAddress ?? 'Unknown IP'} · Last active {formatProfileDate(s.lastSeenAt)}
                  </p>
                </div>
                {!s.isCurrent ? (
                  <button
                    type="button"
                    onClick={() => void revoke(s.id)}
                    className="shrink-0 text-[11px] font-medium text-destructive hover:underline"
                  >
                    Revoke
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    Current
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

type ActivityRow = {
  id: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export function LoginActivityModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await json<{ activities: ActivityRow[] }>(
          await fetch('/api/profile/login-activity'),
        );
        setActivities(data.activities);
      } catch (e) {
        toast.push({
          title: 'Could not load login activity',
          message: e instanceof Error ? e.message : undefined,
          kind: 'error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <ModalShell title="Login activity" onClose={onClose} wide>
      {loading ? (
        <div className="flex justify-center py-8">
          <AiOutlineLoading className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No login activity recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {a.success ? 'Successful login' : 'Failed login attempt'}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {a.ipAddress ?? 'Unknown IP'} · {a.userAgent?.slice(0, 60) ?? 'Unknown device'}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatProfileDate(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

export type ProfileModal =
  | 'edit'
  | 'password'
  | '2fa'
  | 'sessions'
  | 'login-activity'
  | null;
