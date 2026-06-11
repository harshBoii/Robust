'use client';

import { useCallback, useEffect, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { Plus, Trash2 } from 'lucide-react';

import { useToast } from '@/app/components/UI/ToastProvider';
import type { CommunicationDnaDto } from '@/lib/brand-dna/types';

import {
  analyzeCommunicationBlogs,
  fetchCommunicationDna,
  generateCommunicationDna,
  saveCommunicationDna,
} from './dna-api';
import { DnaSaveBar } from './shared/DnaSaveBar';
import { SelectField, TextAreaField, TextField } from './shared/FormField';

const LEVELS = ['High', 'Medium', 'Low'];
const ADVANCED_MODE_KEY = 'communicationDnaAdvancedMode';

const emptyForm = (): CommunicationDnaDto => ({});

export function CommunicationDnaTab({ brandId }: { brandId: string }) {
  const toast = useToast();
  const [form, setForm] = useState<CommunicationDnaDto>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<'manual' | 'blogs'>('manual');
  const [blogUrls, setBlogUrls] = useState<string[]>(['']);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { communicationDna } = await fetchCommunicationDna(brandId);
      if (communicationDna) {
        setForm(communicationDna as CommunicationDnaDto);
        setShowForm(true);
      }
      const stored = localStorage.getItem(ADVANCED_MODE_KEY);
      if (stored === 'blogs' || stored === 'manual') setAdvancedMode(stored);
    } catch (e) {
      toast.push({
        title: 'Could not load Communication DNA',
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

  const patch = (partial: Partial<CommunicationDnaDto>) =>
    setForm((f) => ({ ...f, ...partial }));

  const setMode = (mode: 'manual' | 'blogs') => {
    setAdvancedMode(mode);
    localStorage.setItem(ADVANCED_MODE_KEY, mode);
  };

  const runAutofill = async () => {
    setGenerating(true);
    try {
      const { communicationDna } = await generateCommunicationDna(brandId);
      setForm((f) => ({ ...f, ...(communicationDna as CommunicationDnaDto) }));
      setShowForm(true);
      toast.push({ title: 'Communication DNA auto-filled', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Auto-fill failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const runBlogAnalysis = async () => {
    const urls = blogUrls.map((u) => u.trim()).filter(Boolean);
    if (!urls.length) {
      toast.push({ title: 'Add at least one blog URL', kind: 'error' });
      return;
    }
    setAnalyzing(true);
    try {
      const { communicationDna } = await analyzeCommunicationBlogs(brandId, urls);
      setForm((f) => ({ ...f, ...(communicationDna as CommunicationDnaDto) }));
      setShowForm(true);
      toast.push({ title: 'Blog analysis complete', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Blog analysis failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveCommunicationDna(brandId, form as Record<string, unknown>);
      toast.push({ title: 'Communication DNA saved', kind: 'success' });
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
        <button
          type="button"
          disabled={generating}
          onClick={() => void runAutofill()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {generating ? 'Auto-filling…' : 'Auto-fill from Brand Profile'}
        </button>
        {!showForm && (
          <button
            type="button"
            className="ml-3 text-xs font-medium text-primary hover:underline"
            onClick={() => setShowForm(true)}
          >
            Enter manually
          </button>
        )}
      </div>

      {showForm && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Tone" value={form.tone ?? ''} onChange={(v) => patch({ tone: v })} />
            <TextField label="Voice" value={form.voice ?? ''} onChange={(v) => patch({ voice: v })} />
            <TextField label="Brand Personality" value={form.brandPersonality ?? ''} onChange={(v) => patch({ brandPersonality: v })} />
            <SelectField label="Emotional Intensity" value={form.emotionalIntensity ?? ''} onChange={(v) => patch({ emotionalIntensity: v })} options={LEVELS} />
            <TextField label="Headline Style" value={form.headlineStyle ?? ''} onChange={(v) => patch({ headlineStyle: v })} />
            <TextField label="CTA Style" value={form.ctaStyle ?? ''} onChange={(v) => patch({ ctaStyle: v })} />
            <SelectField label="Urgency Level" value={form.urgencyLevel ?? ''} onChange={(v) => patch({ urgencyLevel: v })} options={LEVELS} />
            <TextField label="Social Proof Usage" value={form.socialProofUsage ?? ''} onChange={(v) => patch({ socialProofUsage: v })} />
          </div>
          <TextAreaField label="Primary Messaging Theme" value={form.primaryMessagingTheme ?? ''} onChange={(v) => patch({ primaryMessagingTheme: v })} />
          <TextAreaField label="Secondary Messaging Theme" value={form.secondaryMessagingTheme ?? ''} onChange={(v) => patch({ secondaryMessagingTheme: v })} />
          <TextAreaField label="Avoided Messaging Theme" value={form.avoidedMessagingTheme ?? ''} onChange={(v) => patch({ avoidedMessagingTheme: v })} />

          <button
            type="button"
            className="text-sm font-medium text-primary"
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            {advancedOpen ? '▼' : '▶'} Advanced Settings
          </button>

          {advancedOpen && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${advancedMode === 'manual' ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}
                >
                  Manual entry
                </button>
                <button
                  type="button"
                  onClick={() => setMode('blogs')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${advancedMode === 'blogs' ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}
                >
                  Learn from blogs
                </button>
              </div>

              {advancedMode === 'manual' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Reading Level" value={form.readingLevel ?? ''} onChange={(v) => patch({ readingLevel: v })} />
                  <TextField label="Avg Sentence Length" value={String(form.avgSentenceLength ?? '')} onChange={(v) => patch({ avgSentenceLength: v ? parseInt(v, 10) : null })} />
                  <SelectField label="Paragraph Density" value={form.paragraphDensity ?? ''} onChange={(v) => patch({ paragraphDensity: v })} options={['Dense', 'Airy', 'Mixed']} />
                  <TextField label="Active Voice %" value={String(form.activeVoicePercentage ?? '')} onChange={(v) => patch({ activeVoicePercentage: v ? parseInt(v, 10) : null })} />
                  <TextAreaField label="Positioning Statement" value={form.positioningStatement ?? ''} onChange={(v) => patch({ positioningStatement: v })} />
                  <TextField label="Value Proposition Style" value={form.valuePropositionStyle ?? ''} onChange={(v) => patch({ valuePropositionStyle: v })} />
                  <TextField label="Differentiation Strategy" value={form.differentiationStrategy ?? ''} onChange={(v) => patch({ differentiationStrategy: v })} />
                  <TextField label="Intro Pattern" value={form.introPattern ?? ''} onChange={(v) => patch({ introPattern: v })} />
                  <TextField label="Storytelling Pattern" value={form.storytellingPattern ?? ''} onChange={(v) => patch({ storytellingPattern: v })} />
                  <TextField label="Conclusion Pattern" value={form.conclusionPattern ?? ''} onChange={(v) => patch({ conclusionPattern: v })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Analyze up to 20 blog URLs from this brand</p>
                  {blogUrls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="glass-input flex-1 rounded-xl px-3 py-2 text-sm"
                        value={url}
                        onChange={(e) => {
                          const next = [...blogUrls];
                          next[i] = e.target.value;
                          setBlogUrls(next);
                        }}
                        placeholder="https://blog.example.com/post"
                      />
                      {blogUrls.length > 1 && (
                        <button type="button" onClick={() => setBlogUrls(blogUrls.filter((_, j) => j !== i))} className="p-2 text-muted-foreground">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {blogUrls.length < 20 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                      onClick={() => setBlogUrls([...blogUrls, ''])}
                    >
                      <Plus className="h-3 w-3" /> Add URL
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => void runBlogAnalysis()}
                    className="mt-2 rounded-xl border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-60"
                  >
                    {analyzing ? 'Analyzing blogs…' : 'Analyze Blogs'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showForm && <DnaSaveBar onSave={() => void onSave()} saving={saving} label="Save Communication DNA" />}
    </div>
  );
}
