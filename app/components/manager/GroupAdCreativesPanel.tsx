'use client';

export type AssetCreativeState = {
  metaCreativeDbId?: string;
  metaCreativeId?: string;
  status: 'none' | 'creating' | 'ready' | 'error';
  error?: string;
};

export type SavedAdCreative = {
  id: string;
  metaCreativeId: string | null;
  assetId: string | null;
  headline: string;
  thumbnailUrl: string | null;
};

export type BulkAdCreativeResultRow = {
  assetId: string;
  ok: boolean;
  creative?: {
    id: string;
    metaCreativeId: string;
    assetId: string | null;
    headline: string;
  };
  error?: string;
};

type Asset = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  assetType: string;
};

type Props = {
  assets: Asset[];
  selectedAssetIds: string[];
  assetCreatives: Record<string, AssetCreativeState>;
  savedAdCreatives: SavedAdCreative[];
  loadingAdCreatives: boolean;
  bulkResults?: BulkAdCreativeResultRow[] | null;
  onRefreshLibrary: () => void;
  onCreate: (assetId: string) => void;
  onApplySaved: (assetId: string, creativeDbId: string) => void;
};

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function GroupAdCreativesPanel({
  assets,
  selectedAssetIds,
  assetCreatives,
  savedAdCreatives,
  loadingAdCreatives,
  bulkResults,
  onRefreshLibrary,
  onCreate,
  onApplySaved,
}: Props) {
  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Meta ad creatives</p>
          <p className="text-xs text-muted-foreground">
            Create on Meta now and reuse when publishing ads.
            {loadingAdCreatives ? ' Refreshing library…' : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshLibrary}
          className="text-xs font-medium text-primary hover:underline"
        >
          Refresh library
        </button>
      </div>
      <div className="space-y-3">
        {selectedAssetIds.map((assetId) => {
          const asset = assets.find((a) => a.id === assetId);
          const state = assetCreatives[assetId] ?? { status: 'none' as const };
          const libraryForAsset = savedAdCreatives.filter(
            (c) => c.assetId === assetId && c.metaCreativeId,
          );
          return (
            <div
              key={assetId}
              className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {asset?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    {asset?.assetType?.slice(0, 1) ?? '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {asset?.title ?? assetId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {state.status === 'ready' && state.metaCreativeId
                      ? `Ready · ${state.metaCreativeId}`
                      : state.status === 'creating'
                        ? 'Creating on Meta…'
                        : state.status === 'error'
                          ? state.error ?? 'Failed'
                          : 'Not created yet'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {libraryForAsset.length > 0 ? (
                  <Select
                    className="h-9 min-w-[160px]"
                    value={state.metaCreativeDbId ?? ''}
                    onChange={(e) => {
                      if (e.target.value) onApplySaved(assetId, e.target.value);
                    }}
                  >
                    <option value="">Use saved…</option>
                    {libraryForAsset.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.headline.slice(0, 32)}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <button
                  type="button"
                  disabled={state.status === 'creating'}
                  onClick={() => onCreate(assetId)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-input bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  {state.status === 'creating'
                    ? 'Creating…'
                    : state.status === 'ready'
                      ? 'Recreate'
                      : 'Create ad creative'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {bulkResults && bulkResults.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/15 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Meta API results
          </p>
          <ul className="mt-2 space-y-2">
            {bulkResults.map((row) => {
              const asset = assets.find((a) => a.id === row.assetId);
              return (
                <li
                  key={row.assetId}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    row.ok
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'
                      : 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300'
                  }`}
                >
                  <p className="font-medium">{asset?.title ?? row.assetId}</p>
                  {row.ok && row.creative ? (
                    <p className="mt-1 font-mono text-[11px]">
                      DB id: {row.creative.id} · Meta creative id: {row.creative.metaCreativeId}
                    </p>
                  ) : (
                    <p className="mt-1">{row.error ?? 'Failed'}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
