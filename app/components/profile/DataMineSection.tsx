'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';

import { useToast } from '@/app/components/UI/ToastProvider';
import type {
  DataMineBrandEntityDto,
  DataMineOfferingDto,
  DataMineSnapshot,
} from '@/lib/data-mine/types';
import type { OfferingType } from '@/app/generated/prisma/client';

const inputClass =
  'glass-input w-full rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

const textareaClass =
  'glass-input w-full resize-y rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function arraysToCsv(arr: string[]): string {
  return arr.join(', ');
}

function csvToArrays(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const emptyBrand = (): DataMineBrandEntityDto => ({
  id: '',
  companyId: '',
  canonicalName: '',
  aliases: [],
  entityType: null,
  oneLiner: null,
  about: null,
  industry: null,
  category: null,
  headquartersCity: null,
  headquartersCountry: null,
  foundedYear: null,
  employeeRange: null,
  businessModel: null,
  topics: [],
  keywords: [],
  targetAudiences: [],
  branding: null,
  createdAt: '',
  updatedAt: '',
});

type OfferingFormState = {
  name: string;
  slug: string;
  description: string;
  offeringType: OfferingType;
  url: string;
  keywords: string;
  useCases: string;
  targetAudiences: string;
  differentiators: string;
  competitors: string;
  isPrimary: boolean;
  isActive: boolean;
};

const emptyOfferingForm = (): OfferingFormState => ({
  name: '',
  slug: '',
  description: '',
  offeringType: 'PRODUCT',
  url: '',
  keywords: '',
  useCases: '',
  targetAudiences: '',
  differentiators: '',
  competitors: '',
  isPrimary: false,
  isActive: true,
});

function offeringToForm(o: DataMineOfferingDto): OfferingFormState {
  return {
    name: o.name,
    slug: o.slug,
    description: o.description ?? '',
    offeringType: o.offeringType,
    url: o.url ?? '',
    keywords: arraysToCsv(o.keywords),
    useCases: arraysToCsv(o.useCases),
    targetAudiences: arraysToCsv(o.targetAudiences),
    differentiators: arraysToCsv(o.differentiators),
    competitors: arraysToCsv(o.competitors),
    isPrimary: o.isPrimary,
    isActive: o.isActive,
  };
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="glass-button rounded-lg p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="custom-scrollbar max-h-[calc(85vh-3.5rem)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export default function DataMineSection() {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [brand, setBrand] = useState<DataMineBrandEntityDto | null>(null);
  const [offerings, setOfferings] = useState<DataMineOfferingDto[]>([]);

  const [savingInputs, setSavingInputs] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  const [offeringModal, setOfferingModal] = useState<'create' | 'edit' | null>(null);
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [offeringForm, setOfferingForm] = useState<OfferingFormState>(emptyOfferingForm);
  const [savingOffering, setSavingOffering] = useState(false);

  const applySnapshot = useCallback((snap: DataMineSnapshot) => {
    setWebsite(snap.website ?? '');
    setLinkedinUrl(snap.linkedinUrl ?? '');
    setBrand(snap.brandEntity);
    setOfferings(snap.offerings);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { dataMine } = await json<{ dataMine: DataMineSnapshot }>(
        await fetch('/api/data-mine', { credentials: 'include' }),
      );
      applySnapshot(dataMine);
    } catch (e) {
      toast.push({
        title: 'Could not load Data Mine',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSeedInputs = async () => {
    setSavingInputs(true);
    try {
      const { dataMine } = await json<{ dataMine: DataMineSnapshot }>(
        await fetch('/api/data-mine', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            website: website.trim() || null,
            linkedinUrl: linkedinUrl.trim() || null,
          }),
        }),
      );
      applySnapshot(dataMine);
      toast.push({ title: 'Seed inputs saved', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Could not save',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSavingInputs(false);
    }
  };

  const runAutoFill = async () => {
    setSeeding(true);
    try {
      const { dataMine } = await json<{ dataMine: DataMineSnapshot }>(
        await fetch('/api/company/seed', {
          method: 'POST',
          credentials: 'include',
        }),
      );
      applySnapshot(dataMine);
      toast.push({ title: 'Auto-fill complete', kind: 'success' });
      router.refresh();
    } catch (e) {
      toast.push({
        title: 'Auto-fill failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSeeding(false);
    }
  };

  const saveBrand = async () => {
    if (!brand) return;
    setSavingBrand(true);
    try {
      const { dataMine } = await json<{ dataMine: DataMineSnapshot }>(
        await fetch('/api/data-mine', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            brandEntity: {
              canonicalName: brand.canonicalName.trim(),
              aliases: brand.aliases,
              entityType: brand.entityType,
              oneLiner: brand.oneLiner,
              about: brand.about,
              industry: brand.industry,
              category: brand.category,
              headquartersCity: brand.headquartersCity,
              headquartersCountry: brand.headquartersCountry,
              foundedYear: brand.foundedYear,
              employeeRange: brand.employeeRange,
              businessModel: brand.businessModel,
              topics: brand.topics,
              keywords: brand.keywords,
              targetAudiences: brand.targetAudiences,
              branding: brand.branding,
            },
          }),
        }),
      );
      applySnapshot(dataMine);
      toast.push({ title: 'Brand entity saved', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Could not save brand',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSavingBrand(false);
    }
  };

  const openCreateOffering = () => {
    setOfferingForm(emptyOfferingForm());
    setEditingOfferingId(null);
    setOfferingModal('create');
  };

  const openEditOffering = (o: DataMineOfferingDto) => {
    setOfferingForm(offeringToForm(o));
    setEditingOfferingId(o.id);
    setOfferingModal('edit');
  };

  const saveOffering = async () => {
    setSavingOffering(true);
    try {
      const payload = {
        name: offeringForm.name.trim(),
        slug: offeringForm.slug.trim(),
        description: offeringForm.description.trim() || null,
        offeringType: offeringForm.offeringType,
        url: offeringForm.url.trim() || null,
        keywords: csvToArrays(offeringForm.keywords),
        useCases: csvToArrays(offeringForm.useCases),
        targetAudiences: csvToArrays(offeringForm.targetAudiences),
        differentiators: csvToArrays(offeringForm.differentiators),
        competitors: csvToArrays(offeringForm.competitors),
        isPrimary: offeringForm.isPrimary,
        isActive: offeringForm.isActive,
      };

      if (offeringModal === 'create') {
        await json(
          await fetch('/api/data-mine/offerings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          }),
        );
        toast.push({ title: 'Offering created', kind: 'success' });
      } else if (editingOfferingId) {
        await json(
          await fetch(`/api/data-mine/offerings/${editingOfferingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          }),
        );
        toast.push({ title: 'Offering updated', kind: 'success' });
      }

      setOfferingModal(null);
      await load();
    } catch (e) {
      toast.push({
        title: 'Could not save offering',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setSavingOffering(false);
    }
  };

  const deleteOffering = async (id: string) => {
    if (!confirm('Delete this offering?')) return;
    try {
      await json(
        await fetch(`/api/data-mine/offerings/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        }),
      );
      toast.push({ title: 'Offering deleted', kind: 'success' });
      await load();
    } catch (e) {
      toast.push({
        title: 'Could not delete',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    }
  };

  const b = brand ?? emptyBrand();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <AiOutlineLoading className="mr-2 h-4 w-4 animate-spin" />
        Loading Data Mine…
      </div>
    );
  }

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {/* Seed inputs */}
      <div>
        <p className="mb-1.5 font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
          Seed inputs
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Website URL</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">LinkedIn URL</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/company/acme"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={savingInputs}
            onClick={() => void saveSeedInputs()}
            className="rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60"
          >
            {savingInputs ? 'Saving…' : 'Save inputs'}
          </button>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void runAutoFill()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {seeding ? (
              <AiOutlineLoading className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Auto Fill Using Miss Robusta
          </button>
        </div>
      </div>

      {/* Brand entity */}
      <div>
        <p className="mb-1.5 font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
          Brand entity
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="font-ui text-[10px] text-muted-foreground">Canonical name *</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.canonicalName}
              onChange={(e) =>
                setBrand({ ...b, canonicalName: e.target.value, id: b.id || 'draft' })
              }
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Entity type</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.entityType ?? ''}
              onChange={(e) => setBrand({ ...b, entityType: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Industry</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.industry ?? ''}
              onChange={(e) => setBrand({ ...b, industry: e.target.value || null })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-ui text-[10px] text-muted-foreground">One-liner</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.oneLiner ?? ''}
              onChange={(e) => setBrand({ ...b, oneLiner: e.target.value || null })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-ui text-[10px] text-muted-foreground">About</span>
            <textarea
              className={`${textareaClass} mt-0.5 min-h-[4rem]`}
              value={b.about ?? ''}
              onChange={(e) => setBrand({ ...b, about: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Category</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.category ?? ''}
              onChange={(e) => setBrand({ ...b, category: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Business model</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.businessModel ?? ''}
              onChange={(e) => setBrand({ ...b, businessModel: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">HQ city</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.headquartersCity ?? ''}
              onChange={(e) => setBrand({ ...b, headquartersCity: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">HQ country</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.headquartersCountry ?? ''}
              onChange={(e) => setBrand({ ...b, headquartersCountry: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Founded year</span>
            <input
              type="number"
              className={`${inputClass} mt-0.5`}
              value={b.foundedYear ?? ''}
              onChange={(e) =>
                setBrand({
                  ...b,
                  foundedYear: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
            />
          </label>
          <label className="block">
            <span className="font-ui text-[10px] text-muted-foreground">Employee range</span>
            <input
              className={`${inputClass} mt-0.5`}
              value={b.employeeRange ?? ''}
              onChange={(e) => setBrand({ ...b, employeeRange: e.target.value || null })}
            />
          </label>
          {(
            [
              ['aliases', 'Aliases (comma-separated)'],
              ['topics', 'Topics'],
              ['keywords', 'Keywords'],
              ['targetAudiences', 'Target audiences'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block sm:col-span-2">
              <span className="font-ui text-[10px] text-muted-foreground">{label}</span>
              <input
                className={`${inputClass} mt-0.5`}
                value={arraysToCsv(b[key])}
                onChange={(e) => setBrand({ ...b, [key]: csvToArrays(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={savingBrand || !b.canonicalName.trim()}
          onClick={() => void saveBrand()}
          className="mt-2 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60"
        >
          {savingBrand ? 'Saving…' : 'Save brand entity'}
        </button>
      </div>

      {/* Offerings */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
            Offerings
          </p>
          <button
            type="button"
            onClick={openCreateOffering}
            className="inline-flex items-center gap-1 font-ui text-[10px] font-medium text-primary"
          >
            <Plus className="h-3 w-3" />
            Add offering
          </button>
        </div>
        {offerings.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No offerings yet. Auto-fill or add one.</p>
        ) : (
          <ul className="divide-y divide-black/[0.04] rounded-lg border border-black/[0.06]">
            {offerings.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {o.name}
                    {o.isPrimary ? (
                      <span className="ml-1 text-[9px] text-primary">(primary)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {o.offeringType} · {o.slug}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => openEditOffering(o)}
                    className="rounded p-1 hover:bg-black/[0.04]"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => void deleteOffering(o.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {offeringModal && (
        <ModalShell
          title={offeringModal === 'create' ? 'Add offering' : 'Edit offering'}
          onClose={() => setOfferingModal(null)}
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Name *</span>
              <input
                className={`${inputClass} mt-1`}
                value={offeringForm.name}
                onChange={(e) => setOfferingForm({ ...offeringForm, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Slug *</span>
              <input
                className={`${inputClass} mt-1`}
                value={offeringForm.slug}
                onChange={(e) => setOfferingForm({ ...offeringForm, slug: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Type</span>
              <select
                className={`${inputClass} mt-1`}
                value={offeringForm.offeringType}
                onChange={(e) =>
                  setOfferingForm({
                    ...offeringForm,
                    offeringType: e.target.value as OfferingType,
                  })
                }
              >
                <option value="PRODUCT">Product</option>
                <option value="SERVICE">Service</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">URL</span>
              <input
                className={`${inputClass} mt-1`}
                value={offeringForm.url}
                onChange={(e) => setOfferingForm({ ...offeringForm, url: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Description</span>
              <textarea
                className={`${textareaClass} mt-1 min-h-[3rem]`}
                value={offeringForm.description}
                onChange={(e) =>
                  setOfferingForm({ ...offeringForm, description: e.target.value })
                }
              />
            </label>
            {(
              [
                ['keywords', 'Keywords'],
                ['useCases', 'Use cases'],
                ['targetAudiences', 'Target audiences'],
                ['differentiators', 'Differentiators'],
                ['competitors', 'Competitors'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs text-muted-foreground">{label}</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={offeringForm[key]}
                  onChange={(e) =>
                    setOfferingForm({ ...offeringForm, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={offeringForm.isPrimary}
                onChange={(e) =>
                  setOfferingForm({ ...offeringForm, isPrimary: e.target.checked })
                }
              />
              Primary offering
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={offeringForm.isActive}
                onChange={(e) =>
                  setOfferingForm({ ...offeringForm, isActive: e.target.checked })
                }
              />
              Active
            </label>
            <button
              type="button"
              disabled={savingOffering || !offeringForm.name.trim() || !offeringForm.slug.trim()}
              onClick={() => void saveOffering()}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {savingOffering ? 'Saving…' : 'Save'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
