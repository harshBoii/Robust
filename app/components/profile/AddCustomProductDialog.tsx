'use client';

import { useEffect, useRef, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { Globe, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';

import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ModalPortal } from '@/app/components/common/ModalPortal';
import { TagInput } from '@/app/components/profile/dna/shared/TagInput';
import type { CustomProductStatus, CustomProductType } from '@/app/generated/prisma/client';
import { extractCustomProduct } from '@/lib/custom-products/client-api';
import type { CustomProductDto, CustomProductFaq } from '@/lib/custom-products/types';

const inputClass =
  'glass-input w-full rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

const textareaClass =
  'glass-input w-full resize-y rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

const CATEGORY_SUGGESTIONS = [
  'Healthcare',
  'Home Services',
  'Legal',
  'Finance',
  'Education',
  'Technology',
  'Retail',
  'Hospitality',
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type EntryMode = 'manual' | 'ai';
type AiSource = 'website' | 'image' | 'pdf';

export type CustomProductFormState = {
  name: string;
  description: string;
  category: string;
  productType: CustomProductType;
  status: CustomProductStatus;
  tagline: string;
  keyBenefits: string[];
  targetAudience: string;
  keywords: string[];
  toneNotes: string;
  mediaUrls: string[];
  faqs: CustomProductFaq[];
  certifications: string;
};

export type CustomProductSaveMeta = {
  phase: 'draft' | 'confirmed';
};

export const emptyCustomProductForm = (): CustomProductFormState => ({
  name: '',
  description: '',
  category: '',
  productType: 'SERVICE',
  status: 'DRAFT',
  tagline: '',
  keyBenefits: [],
  targetAudience: '',
  keywords: [],
  toneNotes: '',
  mediaUrls: [],
  faqs: [],
  certifications: '',
});

export function productToForm(product: CustomProductDto): CustomProductFormState {
  return {
    name: product.name,
    description: product.description ?? '',
    category: product.category ?? '',
    productType: product.productType,
    status: product.status,
    tagline: product.tagline ?? '',
    keyBenefits: product.keyBenefits,
    targetAudience: product.targetAudience ?? '',
    keywords: product.keywords,
    toneNotes: product.toneNotes ?? '',
    mediaUrls: product.mediaUrls,
    faqs: product.faqs,
    certifications: product.certifications ?? '',
  };
}

function formToPayload(form: CustomProductFormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    category: form.category.trim() || null,
    productType: form.productType,
    status: form.status,
    tagline: form.tagline.trim() || null,
    keyBenefits: form.keyBenefits,
    targetAudience: form.targetAudience.trim() || null,
    keywords: form.keywords,
    toneNotes: form.toneNotes.trim() || null,
    mediaUrls: form.mediaUrls,
    faqs: form.faqs,
    certifications: form.certifications.trim() || null,
  };
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

async function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is too large (max 10MB)');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ base64, mimeType: file.type || 'application/octet-stream' });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
      {children}
    </p>
  );
}

function FaqEditor({
  faqs,
  onChange,
}: {
  faqs: CustomProductFaq[];
  onChange: (next: CustomProductFaq[]) => void;
}) {
  const update = (index: number, patch: Partial<CustomProductFaq>) => {
    onChange(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-ui text-[10px] font-medium text-muted-foreground">FAQs</span>
        <button
          type="button"
          onClick={() => onChange([...faqs, { question: '', answer: '' }])}
          className="inline-flex items-center gap-1 font-ui text-[10px] font-medium text-primary"
        >
          <Plus className="h-3 w-3" />
          Add FAQ
        </button>
      </div>
      {faqs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No FAQs yet. Add Q&amp;A pairs for blog sections.</p>
      ) : (
        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-ui text-[9px] font-medium text-muted-foreground">
                  FAQ {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(faqs.filter((_, i) => i !== index))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Remove FAQ"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <input
                className={inputClass}
                value={faq.question}
                onChange={(e) => update(index, { question: e.target.value })}
                placeholder="Question"
              />
              <textarea
                className={`${textareaClass} min-h-[2.5rem]`}
                rows={2}
                value={faq.answer}
                onChange={(e) => update(index, { answer: e.target.value })}
                placeholder="Answer"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileDropZone({
  label,
  hint,
  accept,
  fileName,
  disabled,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  fileName: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      {fileName ? (
        <p className="mt-2 truncate text-[11px] font-medium text-primary">{fileName}</p>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className="mt-3 text-[11px] font-medium text-primary hover:underline disabled:opacity-60"
      >
        Choose file
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function ManualProductForm({
  form,
  setForm,
  error,
  showReviewBanner,
}: {
  form: CustomProductFormState;
  setForm: (next: CustomProductFormState) => void;
  error: string | null;
  showReviewBanner: boolean;
}) {
  return (
    <div className="space-y-5">
      {showReviewBanner ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
          AI draft saved — review the fields below and tap Save to confirm.
        </p>
      ) : null}

      <div className="space-y-3">
        <SectionLabel>Basics</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
              Name <span className="text-red-500">*</span>
            </span>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Deep home cleaning, Cardiology consultation"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
              Type
            </span>
            <select
              className={inputClass}
              value={form.productType}
              onChange={(e) =>
                setForm({ ...form, productType: e.target.value as CustomProductType })
              }
            >
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
              Status
            </span>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as CustomProductStatus })
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
              Category
            </span>
            <input
              className={inputClass}
              list="custom-product-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Healthcare, Home Services, Legal"
            />
            <datalist id="custom-product-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>Description</SectionLabel>
        <label className="block">
          <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
            Tagline
          </span>
          <input
            className={inputClass}
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            placeholder="One-liner pitch for headlines"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
            Description
          </span>
          <textarea
            className={`${textareaClass} min-h-[5rem]`}
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Rich description — main context for content generation"
          />
        </label>
      </div>

      <div className="space-y-3">
        <SectionLabel>Content generation</SectionLabel>
        <TagInput
          label="Key benefits"
          values={form.keyBenefits}
          onChange={(keyBenefits) => setForm({ ...form, keyBenefits })}
          placeholder="Add a benefit and press Enter"
        />
        <label className="block">
          <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
            Target audience
          </span>
          <textarea
            className={`${textareaClass} min-h-[3rem]`}
            rows={2}
            value={form.targetAudience}
            onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
            placeholder="Who is this for?"
          />
        </label>
        <TagInput
          label="Keywords"
          values={form.keywords}
          onChange={(keywords) => setForm({ ...form, keywords })}
          placeholder="SEO / topical terms"
        />
        <label className="block">
          <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
            Tone notes
          </span>
          <input
            className={inputClass}
            value={form.toneNotes}
            onChange={(e) => setForm({ ...form, toneNotes: e.target.value })}
            placeholder='e.g. "formal", "empathetic", "technical"'
          />
        </label>
      </div>

      <div className="space-y-3">
        <SectionLabel>Context</SectionLabel>
        <TagInput
          label="Media URLs"
          values={form.mediaUrls}
          onChange={(mediaUrls) => setForm({ ...form, mediaUrls })}
          placeholder="Image or video URL"
        />
        <FaqEditor faqs={form.faqs} onChange={(faqs) => setForm({ ...form, faqs })} />
        <label className="block">
          <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
            Certifications / accreditations
          </span>
          <input
            className={inputClass}
            value={form.certifications}
            onChange={(e) => setForm({ ...form, certifications: e.target.value })}
            placeholder="e.g. NABH accredited, ISO 9001"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  productId?: string | null;
  initialForm?: CustomProductFormState;
  onClose: () => void;
  onSaved: (product: CustomProductDto, meta?: CustomProductSaveMeta) => void;
};

export function AddCustomProductDialog({
  open,
  mode,
  productId,
  initialForm,
  onClose,
  onSaved,
}: Props) {
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');
  const [aiSource, setAiSource] = useState<AiSource>('website');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [form, setForm] = useState<CustomProductFormState>(emptyCustomProductForm);
  const [draftProductId, setDraftProductId] = useState<string | null>(null);
  const [aiExtracted, setAiExtracted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAiTab = mode === 'create' && !draftProductId;

  useEffect(() => {
    if (!open) return;
    setEntryMode('manual');
    setAiSource('website');
    setWebsiteUrl('');
    setImageFile(null);
    setPdfFile(null);
    setForm(initialForm ?? emptyCustomProductForm());
    setDraftProductId(null);
    setAiExtracted(false);
    setError(null);
  }, [open, initialForm]);

  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      let result;
      if (aiSource === 'website') {
        const url = websiteUrl.trim();
        if (!url) throw new Error('Website URL is required');
        if (!url.startsWith('https://')) {
          throw new Error('Website URL must start with https://');
        }
        result = await extractCustomProduct({ source: 'website', companyDomain: url });
      } else if (aiSource === 'image') {
        if (!imageFile) throw new Error('Choose an image file');
        const { base64, mimeType } = await readFileAsBase64(imageFile);
        result = await extractCustomProduct({
          source: 'image',
          imageBase64: base64,
          imageMimeType: mimeType,
        });
      } else {
        if (!pdfFile) throw new Error('Choose a PDF file');
        const { base64 } = await readFileAsBase64(pdfFile);
        result = await extractCustomProduct({ source: 'pdf', pdfBase64: base64 });
      }

      const { product } = result;
      setDraftProductId(product.id);
      setAiExtracted(true);
      setForm(productToForm(product));
      setEntryMode('manual');
      onSaved(product, { phase: 'draft' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(form);
      const saveId = draftProductId ?? productId;
      const isPatch = Boolean(saveId);

      const res = isPatch
        ? await fetch(`/api/profile/custom-products/${saveId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/profile/custom-products', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await json<{ product: CustomProductDto }>(res);
      onSaved(data.product, { phase: 'confirmed' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const canExtract =
    aiSource === 'website'
      ? websiteUrl.trim().startsWith('https://')
      : aiSource === 'image'
        ? Boolean(imageFile)
        : Boolean(pdfFile);

  if (!open) return null;

  const title = mode === 'create' ? 'Add product or service' : 'Edit product or service';
  const saveLabel =
    draftProductId || mode === 'edit' ? 'Save changes' : mode === 'create' ? 'Create' : 'Save';

  return (
    <ModalPortal>
      <ModalBackdrop onClose={onClose} contentClassName="max-w-2xl">
        <div className="max-h-[90vh] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold">{title}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Define offerings for LLM-powered content generation
              </p>
            </div>
            <button type="button" onClick={onClose} className="glass-button shrink-0 rounded-lg p-1.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {showAiTab ? (
            <div className="border-b border-[var(--glass-border)] px-4 py-2.5">
              <div
                className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
                role="tablist"
                aria-label="Entry mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={entryMode === 'manual'}
                  onClick={() => setEntryMode('manual')}
                  className={`rounded-md px-3 py-1.5 font-ui text-[11px] font-medium transition-colors ${
                    entryMode === 'manual'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={entryMode === 'ai'}
                  onClick={() => setEntryMode('ai')}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-ui text-[11px] font-medium transition-colors ${
                    entryMode === 'ai'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  AI mode
                </button>
              </div>
            </div>
          ) : null}

          <div className="custom-scrollbar max-h-[calc(90vh-9.5rem)] overflow-y-auto p-4">
            {entryMode === 'ai' && showAiTab ? (
              <div className="space-y-4">
                <div
                  className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
                  role="tablist"
                  aria-label="AI source"
                >
                  {(
                    [
                      ['website', 'Website', Globe],
                      ['image', 'Image', Upload],
                      ['pdf', 'PDF', Upload],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={aiSource === key}
                      onClick={() => setAiSource(key)}
                      disabled={extracting}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-ui text-[11px] font-medium transition-colors disabled:opacity-60 ${
                        aiSource === key
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>

                {aiSource === 'website' ? (
                  <label className="block">
                    <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">
                      Product page URL
                    </span>
                    <input
                      className={inputClass}
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      disabled={extracting}
                      placeholder="https://www.example.com/your-product"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Must start with https:// (required for page extraction)
                    </p>
                  </label>
                ) : null}

                {aiSource === 'image' ? (
                  <FileDropZone
                    label="Upload product image"
                    hint="PNG, JPG, or WebP — max 10MB"
                    accept="image/*"
                    fileName={imageFile?.name ?? null}
                    disabled={extracting}
                    onFile={setImageFile}
                  />
                ) : null}

                {aiSource === 'pdf' ? (
                  <FileDropZone
                    label="Upload product PDF"
                    hint="Brochure, spec sheet, or service menu — max 10MB"
                    accept="application/pdf,.pdf"
                    fileName={pdfFile?.name ?? null}
                    disabled={extracting}
                    onFile={setPdfFile}
                  />
                ) : null}

                <p className="text-[11px] text-muted-foreground">
                  Miss Robusta will extract product details and save a draft you can review before
                  confirming.
                </p>

                {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              </div>
            ) : (
              <ManualProductForm
                form={form}
                setForm={setForm}
                error={error}
                showReviewBanner={aiExtracted}
              />
            )}
          </div>

          {entryMode === 'ai' && showAiTab ? (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={extracting}
                className="glass-button rounded-lg px-3 py-2 text-[11px] font-medium disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExtract()}
                disabled={extracting || !canExtract}
                className="glass-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold disabled:opacity-60"
              >
                {extracting ? (
                  <AiOutlineLoading className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {extracting ? 'Extracting…' : 'Extract'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="glass-button rounded-lg px-3 py-2 text-[11px] font-medium disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !form.name.trim()}
                className="glass-button-primary rounded-lg px-4 py-2 text-[11px] font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : saveLabel}
              </button>
            </div>
          )}
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
