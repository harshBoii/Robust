'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { Upload } from 'lucide-react';

import { useToast } from '@/app/components/UI/ToastProvider';
import type { ComplianceDnaDto } from '@/lib/brand-dna/types';

import { extractComplianceDna, fetchComplianceDna, saveComplianceDna } from './dna-api';
import { DnaSaveBar } from './shared/DnaSaveBar';
import { TagInput } from './shared/TagInput';

const emptyForm = (): ComplianceDnaDto => ({
  bannedAbsoluteClaims: [],
  bannedComparativeClaims: [],
  allowedClaims: [],
  bannedWords: [],
  allowedWords: [],
  fearBasedMarketingAllowed: false,
  sensationalLanguageAllowed: false,
  politicalContentAllowed: false,
  religiousContentAllowed: false,
  controversialTopicsAllowed: false,
});

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

export function ComplianceDnaTab({ brandId }: { brandId: string }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ComplianceDnaDto>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewNote, setReviewNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { complianceDna } = await fetchComplianceDna(brandId);
      if (complianceDna) {
        setForm({ ...emptyForm(), ...(complianceDna as ComplianceDnaDto) });
        setShowForm(true);
      }
    } catch (e) {
      toast.push({
        title: 'Could not load Compliance DNA',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [brandId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (partial: Partial<ComplianceDnaDto>) => setForm((f) => ({ ...f, ...partial }));

  const handleFile = async (file: File) => {
    setExtracting(true);
    try {
      const { extracted, sourceFileUrl, sourceFileName } = await extractComplianceDna(brandId, file);
      setForm((f) => ({
        ...f,
        ...(extracted as ComplianceDnaDto),
        sourceFileUrl,
        sourceFileName,
        bannedAbsoluteClaims: (extracted.bannedAbsoluteClaims as string[]) ?? [],
        bannedComparativeClaims: (extracted.bannedComparativeClaims as string[]) ?? [],
        allowedClaims: (extracted.allowedClaims as string[]) ?? [],
        bannedWords: (extracted.bannedWords as string[]) ?? [],
        allowedWords: (extracted.allowedWords as string[]) ?? [],
      }));
      setShowForm(true);
      setReviewNote(true);
      toast.push({ title: 'Review extracted data before saving', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Extraction failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setExtracting(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveComplianceDna(brandId, form as Record<string, unknown>);
      setReviewNote(false);
      toast.push({ title: 'Compliance DNA saved', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Save failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <AiOutlineLoading className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drop PDF, TXT, DOCX, or MD</p>
        <button
          type="button"
          disabled={extracting}
          onClick={() => fileRef.current?.click()}
          className="mt-2 text-sm font-medium text-primary hover:underline disabled:opacity-60"
        >
          {extracting ? 'Extracting…' : 'Choose file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.docx,.md"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {!showForm && (
          <button
            type="button"
            className="mt-3 block w-full text-xs font-medium text-primary hover:underline"
            onClick={() => setShowForm(true)}
          >
            Or enter manually
          </button>
        )}
      </div>

      {reviewNote && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Review extracted data before saving
          {form.sourceFileName ? ` (from ${form.sourceFileName})` : ''}
        </p>
      )}

      {showForm && (
        <div className="space-y-4">
          <TagInput label="Banned Absolute Claims" values={form.bannedAbsoluteClaims ?? []} onChange={(v) => patch({ bannedAbsoluteClaims: v })} />
          <TagInput label="Banned Comparative Claims" values={form.bannedComparativeClaims ?? []} onChange={(v) => patch({ bannedComparativeClaims: v })} />
          <TagInput label="Allowed Claims" values={form.allowedClaims ?? []} onChange={(v) => patch({ allowedClaims: v })} />
          <TagInput label="Banned Words" values={form.bannedWords ?? []} onChange={(v) => patch({ bannedWords: v })} />
          <TagInput label="Allowed Words" values={form.allowedWords ?? []} onChange={(v) => patch({ allowedWords: v })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle label="Fear-based marketing allowed" checked={!!form.fearBasedMarketingAllowed} onChange={(v) => patch({ fearBasedMarketingAllowed: v })} />
            <Toggle label="Sensational language allowed" checked={!!form.sensationalLanguageAllowed} onChange={(v) => patch({ sensationalLanguageAllowed: v })} />
            <Toggle label="Political content allowed" checked={!!form.politicalContentAllowed} onChange={(v) => patch({ politicalContentAllowed: v })} />
            <Toggle label="Religious content allowed" checked={!!form.religiousContentAllowed} onChange={(v) => patch({ religiousContentAllowed: v })} />
            <Toggle label="Controversial topics allowed" checked={!!form.controversialTopicsAllowed} onChange={(v) => patch({ controversialTopicsAllowed: v })} />
          </div>
        </div>
      )}

      {showForm && <DnaSaveBar onSave={() => void onSave()} saving={saving} label="Save Compliance DNA" />}
    </div>
  );
}
