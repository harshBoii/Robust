/** Pick the best video asset id in a post wizard group for creative vision analysis. */
export function pickGroupVideoAssetId(group: {
  assets: { id: string; assetType: string }[];
  selectedAssetIds: string[];
}): string | null {
  for (const id of group.selectedAssetIds) {
    const asset = group.assets.find((a) => a.id === id);
    if (asset?.assetType === 'VIDEO') return id;
  }
  const fallback = group.assets.find((a) => a.assetType === 'VIDEO');
  return fallback?.id ?? null;
}
