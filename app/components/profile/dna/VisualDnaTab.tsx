'use client';

import { useCallback, useEffect, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import { useToast } from '@/app/components/UI/ToastProvider';
import type { VisualDnaDto } from '@/lib/brand-dna/types';

import { fetchVisualDna, generateVisualDna, saveVisualDna } from './dna-api';
import { ColorField } from './shared/ColorField';
import { DnaSaveBar } from './shared/DnaSaveBar';
import { SelectField, TextField } from './shared/FormField';

const STEPS = ['Scraping DOM', 'Extracting Tokens', 'Analyzing with Vision Model'];
const LEVELS = ['High', 'Medium', 'Low'];

const emptyForm = (): VisualDnaDto => ({});

export function VisualDnaTab({
  brandId,
  websiteUrl,
}: {
  brandId: string;
  websiteUrl?: string | null;
}) {
  const toast = useToast();
  const [form, setForm] = useState<VisualDnaDto>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [landingUrl, setLandingUrl] = useState(websiteUrl ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { visualDna } = await fetchVisualDna(brandId);
      if (visualDna) {
        setForm(visualDna as VisualDnaDto);
        setShowForm(true);
      }
    } catch (e) {
      toast.push({
        title: 'Could not load Visual DNA',
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

  useEffect(() => {
    if (websiteUrl && !landingUrl) setLandingUrl(websiteUrl);
  }, [websiteUrl, landingUrl]);

  const patch = (partial: Partial<VisualDnaDto>) => setForm((f) => ({ ...f, ...partial }));

  const runGenerate = async () => {
    if (!landingUrl.trim()) {
      toast.push({ title: 'Enter a landing page URL', kind: 'error' });
      return;
    }
    setGenerating(true);
    setStepIdx(0);
    const timer = window.setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, 4000);

    try {
      const { visualDna } = await generateVisualDna(brandId, landingUrl.trim());
      setForm((f) => ({ ...f, ...(visualDna as VisualDnaDto) }));
      setShowForm(true);
      toast.push({ title: 'Visual DNA generated', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Generation failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      window.clearInterval(timer);
      setGenerating(false);
      setStepIdx(0);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveVisualDna(brandId, form as Record<string, unknown>);
      toast.push({ title: 'Visual DNA saved', kind: 'success' });
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
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Analyze website</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="glass-input flex-1 rounded-xl px-3 py-2 text-sm"
            placeholder="https://yourbrand.com"
            value={landingUrl}
            onChange={(e) => setLandingUrl(e.target.value)}
          />
          <button
            type="button"
            disabled={generating}
            onClick={() => void runGenerate()}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {generating ? 'Analyzing…' : 'Analyze Website'}
          </button>
        </div>
        {generating && (
          <div className="mt-3 space-y-1">
            {STEPS.map((s, i) => (
              <p
                key={s}
                className={`text-xs ${i <= stepIdx ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                {i < stepIdx ? '✓' : i === stepIdx ? '…' : '○'} {s}
              </p>
            ))}
          </div>
        )}
        {!showForm && (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-primary hover:underline"
            onClick={() => setShowForm(true)}
          >
            Enter manually
          </button>
        )}
      </div>

      {showForm && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="Primary"
            value={form.primaryColor ?? ''}
            onChange={(v) => patch({ primaryColor: v })}
          />
          <ColorField
            label="Secondary"
            value={form.secondaryColor ?? ''}
            onChange={(v) => patch({ secondaryColor: v })}
          />
          <ColorField
            label="Accent"
            value={form.accentColor ?? ''}
            onChange={(v) => patch({ accentColor: v })}
          />
          <ColorField
            label="Background"
            value={form.backgroundColor ?? ''}
            onChange={(v) => patch({ backgroundColor: v })}
          />
          <TextField label="Visual Style" value={form.visualStyle ?? ''} onChange={(v) => patch({ visualStyle: v })} />
          <TextField label="Visual Maturity" value={form.visualMaturity ?? ''} onChange={(v) => patch({ visualMaturity: v })} />
          <SelectField label="Design Complexity" value={form.designComplexity ?? ''} onChange={(v) => patch({ designComplexity: v })} options={LEVELS} />
          <TextField label="Heading Font" value={form.headingFont ?? ''} onChange={(v) => patch({ headingFont: v })} />
          <TextField label="Body Font" value={form.bodyFont ?? ''} onChange={(v) => patch({ bodyFont: v })} />
          <TextField label="Typography Personality" value={form.typographyPersonality ?? ''} onChange={(v) => patch({ typographyPersonality: v })} />
          <SelectField label="Whitespace Level" value={form.whitespaceLevel ?? ''} onChange={(v) => patch({ whitespaceLevel: v })} options={LEVELS} />
          <SelectField label="Content Density" value={form.contentDensity ?? ''} onChange={(v) => patch({ contentDensity: v })} options={LEVELS} />
          <TextField label="Alignment Style" value={form.alignmentStyle ?? ''} onChange={(v) => patch({ alignmentStyle: v })} />
          <TextField label="Corner Radius Style" value={form.cornerRadiusStyle ?? ''} onChange={(v) => patch({ cornerRadiusStyle: v })} />
          <TextField label="Shadow Style" value={form.shadowStyle ?? ''} onChange={(v) => patch({ shadowStyle: v })} />
          <TextField label="Preferred Visual Motif" value={form.preferredVisualMotif ?? ''} onChange={(v) => patch({ preferredVisualMotif: v })} />
          <TextField label="Visual Emotion" value={form.visualEmotion ?? ''} onChange={(v) => patch({ visualEmotion: v })} />
        </div>
      )}

      {showForm && <DnaSaveBar onSave={() => void onSave()} saving={saving} label="Save Visual DNA" />}
    </div>
  );
}
