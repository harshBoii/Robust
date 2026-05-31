'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search } from 'lucide-react';

type ShopProduct = {
  id: string;
  shopifyGid: string;
  title: string;
  status: string | null;
  totalInventory: number | null;
  onlineStoreUrl: string | null;
  priceMinAmount: string | null;
  priceMaxAmount: string | null;
  currencyCode: string | null;
  featuredImageUrl: string | null;
  shopifyUpdatedAt: string | null;
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

function formatPrice(min: string | null, max: string | null, currency: string | null) {
  if (!min && !max) return '—';
  const c = currency ?? '';
  if (min === max || !max) return `${min} ${c}`.trim();
  return `${min} – ${max} ${c}`.trim();
}

export default function ShopProductsClient({ embedded = false }: { embedded?: boolean }) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShopProduct[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const data = await json<{ products: ShopProduct[] }>(
      await fetch('/api/shop/products', { credentials: 'include' }),
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

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setSyncMessage(null);
    setSearchResults(null);
    try {
      const sync = await json<{ success: boolean; synced?: number; error?: string }>(
        await fetch('/api/shopify/product', { credentials: 'include' }),
      );
      if (sync.success) {
        setSyncMessage(`Synced ${sync.synced ?? 0} products from Shopify.`);
      } else {
        throw new Error(sync.error ?? 'Sync failed');
      }
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const data = await json<{
        hits: Array<{
          id: string;
          shopifyGid: string;
          title: string;
          status: string | null;
          onlineStoreUrl: string | null;
        }>;
      }>(
        await fetch('/api/mcp/products/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query: q, limit: 50 }),
        }),
      );
      const hitIds = new Set(data.hits.map((h) => h.id));
      const fromDb = products.filter((p) => hitIds.has(p.id));
      const merged = data.hits.map((hit) => {
        const full = fromDb.find((p) => p.id === hit.id);
        return (
          full ?? {
            id: hit.id,
            shopifyGid: hit.shopifyGid,
            title: hit.title,
            status: hit.status,
            totalInventory: null,
            onlineStoreUrl: hit.onlineStoreUrl,
            priceMinAmount: null,
            priceMaxAmount: null,
            currencyCode: null,
            featuredImageUrl: null,
            shopifyUpdatedAt: null,
          }
        );
      });
      setSearchResults(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const displayList = searchResults ?? products;

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Shop products</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Products synced from Shopify. Connect in{' '}
              <Link href="/profile/integration" className="text-primary hover:underline">
                Profile → Integrations
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            className="glass-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh feed'}
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh feed'}
          </button>
        </div>
      )}

      {error ? (
        <div className="glass-card border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {syncMessage ? (
        <div className="glass-card border border-emerald-500/25 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          {syncMessage}
        </div>
      ) : null}

      <div className="glass-card flex flex-wrap gap-2 p-3">
        <input
          className="glass-input min-w-[200px] flex-1 px-3 py-2 text-sm"
          placeholder="Search products (Elasticsearch)…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
        />
        <button
          type="button"
          className="glass-button inline-flex items-center gap-2 px-4 py-2 text-sm"
          onClick={handleSearch}
          disabled={searching}
        >
          <Search className="h-4 w-4" />
          {searching ? 'Searching…' : 'Search'}
        </button>
        {searchResults ? (
          <button
            type="button"
            className="glass-button px-4 py-2 text-sm"
            onClick={() => {
              setSearchResults(null);
              setSearchQuery('');
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading products…</p>
      ) : displayList.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No products yet. Connect Shopify and click Refresh feed.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayList.map((p) => (
            <article key={p.id} className="glass-card overflow-hidden">
              {p.featuredImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.featuredImageUrl}
                  alt={p.title}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 items-center justify-center bg-black/[0.03] text-xs text-muted-foreground">
                  No image
                </div>
              )}
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-2">{p.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.status ?? '—'} · Inv. {p.totalInventory ?? '—'}
                </p>
                <p className="mt-1 text-xs font-data">
                  {formatPrice(p.priceMinAmount, p.priceMaxAmount, p.currencyCode)}
                </p>
                {p.onlineStoreUrl ? (
                  <a
                    href={p.onlineStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    View in store
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
