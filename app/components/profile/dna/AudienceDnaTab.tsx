'use client';

import { useCallback, useEffect, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import { useToast } from '@/app/components/UI/ToastProvider';
import type { AudienceDnaDto } from '@/lib/brand-dna/types';

import { fetchAudienceDna, generateAudienceDna, saveAudienceDna } from './dna-api';
import { DnaSaveBar } from './shared/DnaSaveBar';
import { SelectField, TextField } from './shared/FormField';
import { TagInput } from './shared/TagInput';

const TECH_LEVELS = ['Beginner', 'Intermediate', 'Expert'];
const KNOWLEDGE_LEVELS = ['Low', 'Medium', 'High'];

const emptyForm = (): AudienceDnaDto => ({
  audiencePainPoints: [],
  audienceMotivations: [],
  audienceObjections: [],
});

export function AudienceDnaTab({ brandId }: { brandId: string }) {
  const toast = useToast();
  const [form, setForm] = useState<AudienceDnaDto>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { audienceDna } = await fetchAudienceDna(brandId);
      if (audienceDna) {
        setForm({
          ...emptyForm(),
          ...(audienceDna as AudienceDnaDto),
          audiencePainPoints: (audienceDna.audiencePainPoints as string[]) ?? [],
          audienceMotivations: (audienceDna.audienceMotivations as string[]) ?? [],
          audienceObjections: (audienceDna.audienceObjections as string[]) ?? [],
        });
        setShowForm(true);
      }
    } catch (e) {
      toast.push({
        title: 'Could not load Audience DNA',
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

  const patch = (partial: Partial<AudienceDnaDto>) => setForm((f) => ({ ...f, ...partial }));

  const runAutofill = async () => {
    setGenerating(true);
    try {
      const { audienceDna } = await generateAudienceDna(brandId);
      setForm((f) => ({
        ...f,
        ...(audienceDna as AudienceDnaDto),
        audiencePainPoints: (audienceDna.audiencePainPoints as string[]) ?? f.audiencePainPoints ?? [],
        audienceMotivations: (audienceDna.audienceMotivations as string[]) ?? f.audienceMotivations ?? [],
        audienceObjections: (audienceDna.audienceObjections as string[]) ?? f.audienceObjections ?? [],
      }));
      setShowForm(true);
      toast.push({ title: 'Audience DNA auto-filled', kind: 'success' });
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

  const onSave = async () => {
    setSaving(true);
    try {
      await saveAudienceDna(brandId, form as Record<string, unknown>);
      toast.push({ title: 'Audience DNA saved', kind: 'success' });
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
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Primary Persona" value={form.primaryPersona ?? ''} onChange={(v) => patch({ primaryPersona: v })} />
            <TextField label="Secondary Persona" value={form.secondaryPersona ?? ''} onChange={(v) => patch({ secondaryPersona: v })} />
            <TextField label="Industry Focus" value={form.industryFocus ?? ''} onChange={(v) => patch({ industryFocus: v })} />
            <SelectField label="Technical Level" value={form.technicalLevel ?? ''} onChange={(v) => patch({ technicalLevel: v })} options={TECH_LEVELS} />
            <SelectField label="Domain Knowledge Level" value={form.domainKnowledgeLevel ?? ''} onChange={(v) => patch({ domainKnowledgeLevel: v })} options={KNOWLEDGE_LEVELS} />
          </div>
          <TagInput
            label="Audience Pain Points"
            values={form.audiencePainPoints ?? []}
            onChange={(v) => patch({ audiencePainPoints: v })}
          />
          <TagInput
            label="Audience Motivations"
            values={form.audienceMotivations ?? []}
            onChange={(v) => patch({ audienceMotivations: v })}
          />
          <TagInput
            label="Audience Objections"
            values={form.audienceObjections ?? []}
            onChange={(v) => patch({ audienceObjections: v })}
          />
        </div>
      )}

      {showForm && <DnaSaveBar onSave={() => void onSave()} saving={saving} label="Save Audience DNA" />}
    </div>
  );
}
