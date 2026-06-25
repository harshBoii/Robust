'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import {
  AddCustomProductDialog,
  emptyCustomProductForm,
  productToForm,
} from '@/app/components/profile/AddCustomProductDialog';
import { profileStatusBadge } from '@/app/components/profile/profile-utils';
import { useToast } from '@/app/components/UI/ToastProvider';
import type { CustomProductDto } from '@/lib/custom-products/types';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function statusBadgeClass(status: CustomProductDto['status']) {
  switch (status) {
    case 'ACTIVE':
      return profileStatusBadge.success;
    case 'DRAFT':
      return profileStatusBadge.warning;
    default:
      return profileStatusBadge.neutral;
  }
}

function formatTypeLabel(type: CustomProductDto['productType']) {
  return type === 'PRODUCT' ? 'Product' : 'Service';
}

type Props = {
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
};

export default function CustomProductsSection({
  createDialogOpen = false,
  onCreateDialogOpenChange,
}: Props) {
  const toast = useToast();
  const [products, setProducts] = useState<CustomProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingProduct, setEditingProduct] = useState<CustomProductDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingProduct(null);
    onCreateDialogOpenChange?.(false);
  }, [onCreateDialogOpenChange]);

  const openCreate = useCallback(() => {
    setDialogMode('create');
    setEditingProduct(null);
    setDialogOpen(true);
  }, []);

  const loadProducts = useCallback(async () => {
    const data = await json<{ products: CustomProductDto[] }>(
      await fetch('/api/profile/custom-products', { credentials: 'include' }),
    );
    setProducts(data.products);
    return data.products;
  }, []);

  useEffect(() => {
    setLoading(true);
    loadProducts()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load products'))
      .finally(() => setLoading(false));
  }, [loadProducts]);

  useEffect(() => {
    if (createDialogOpen) {
      openCreate();
    }
  }, [createDialogOpen, openCreate]);

  const openEdit = (product: CustomProductDto) => {
    setDialogMode('edit');
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this product or service?')) return;
    setDeletingId(id);
    try {
      await json(
        await fetch(`/api/profile/custom-products/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        }),
      );
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.push({ title: 'Product deleted', kind: 'success' });
    } catch (e) {
      toast.push({
        title: 'Delete failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (product: CustomProductDto, meta?: { phase?: 'draft' | 'confirmed' }) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx === -1) return [product, ...prev];
      const next = [...prev];
      next[idx] = product;
      return next;
    });

    if (meta?.phase === 'draft') {
      toast.push({
        title: 'AI draft saved — review and confirm',
        kind: 'info',
      });
      return;
    }

    if (meta?.phase === 'confirmed') {
      toast.push({ title: 'Product saved', kind: 'success' });
      return;
    }

    toast.push({
      title: dialogMode === 'create' ? 'Product created' : 'Product updated',
      kind: 'success',
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading text-sm font-semibold text-foreground">
          Your products &amp; services
        </h2>
        <p className="font-body text-[11px] text-muted-foreground">
          Custom offerings for blogs, ads, and LLM content
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No custom products yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Add a product or service to power content generation across your workspace.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="glass-button-primary mt-3 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
          >
            Add product or service
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {products.map((product) => (
            <article
              key={product.id}
              className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate font-semibold text-sm text-foreground">{product.name}</h3>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-ui text-[9px] font-medium ${statusBadgeClass(product.status)}`}
                    >
                      {product.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTypeLabel(product.productType)}
                    {product.category ? ` · ${product.category}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => openEdit(product)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={deletingId === product.id}
                    onClick={() => void handleDelete(product.id)}
                    className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {product.tagline ? (
                <p className="mt-2 line-clamp-2 text-[11px] text-foreground/80">{product.tagline}</p>
              ) : product.description ? (
                <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
              {product.keywords.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {product.keywords.slice(0, 4).map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                  {product.keywords.length > 4 ? (
                    <span className="text-[9px] text-muted-foreground">
                      +{product.keywords.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <AddCustomProductDialog
        open={dialogOpen}
        mode={dialogMode}
        productId={editingProduct?.id}
        initialForm={editingProduct ? productToForm(editingProduct) : emptyCustomProductForm()}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
    </div>
  );
}
