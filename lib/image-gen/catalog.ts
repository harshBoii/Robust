/** Curated static assets for Product on Model (Subpath 3). Place images under public/image-gen/. */

export type CatalogItem = {
  id: string;
  label: string;
  imageUrl: string;
  category?: string;
};

export type ModelCategory = 'male' | 'female' | 'kids';

const BASE = '/image-gen';

/** Placeholder SVG data URLs until real assets are added under public/image-gen/. */
function placeholderSvg(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
    <rect fill="hsl(${hue},30%,92%)" width="400" height="500"/>
    <text x="200" y="250" text-anchor="middle" font-family="system-ui" font-size="18" fill="hsl(${hue},40%,35%)">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const MODEL_CATALOG: Array<CatalogItem & { category: ModelCategory }> = [
  { id: 'model-m-1', category: 'male' as const, label: 'Alex', imageUrl: `${BASE}/models/male/model-1.jpg` },
  { id: 'model-m-2', category: 'male' as const, label: 'Jordan', imageUrl: `${BASE}/models/male/model-2.jpg` },
  { id: 'model-f-1', category: 'female' as const, label: 'Sam', imageUrl: `${BASE}/models/female/model-1.jpg` },
  { id: 'model-f-2', category: 'female' as const, label: 'Riley', imageUrl: `${BASE}/models/female/model-2.jpg` },
  { id: 'model-k-1', category: 'kids' as const, label: 'Casey', imageUrl: `${BASE}/models/kids/model-1.jpg` },
  { id: 'model-k-2', category: 'kids' as const, label: 'Taylor', imageUrl: `${BASE}/models/kids/model-2.jpg` },
];

export const BACKGROUND_CATALOG: CatalogItem[] = [
  { id: 'bg-studio', label: 'Studio white', imageUrl: `${BASE}/backgrounds/studio.jpg` },
  { id: 'bg-urban', label: 'Urban street', imageUrl: `${BASE}/backgrounds/urban.jpg` },
  { id: 'bg-nature', label: 'Outdoor nature', imageUrl: `${BASE}/backgrounds/nature.jpg` },
  { id: 'bg-retail', label: 'Retail shelf', imageUrl: `${BASE}/backgrounds/retail.jpg` },
];

export const POSE_CATALOG: CatalogItem[] = [
  { id: 'pose-front', label: 'Front facing', imageUrl: `${BASE}/poses/front.jpg` },
  { id: 'pose-side', label: 'Three-quarter', imageUrl: `${BASE}/poses/three-quarter.jpg` },
  { id: 'pose-hold', label: 'Holding product', imageUrl: `${BASE}/poses/holding.jpg` },
  { id: 'pose-wear', label: 'Wearing product', imageUrl: `${BASE}/poses/wearing.jpg` },
];

export function getCatalogForWidget() {
  return {
    models: MODEL_CATALOG.map((m) => ({
      ...m,
      imageUrl: m.imageUrl.includes('.jpg') ? placeholderSvg(m.label, m.category === 'male' ? 210 : m.category === 'female' ? 330 : 45) : m.imageUrl,
    })),
    backgrounds: BACKGROUND_CATALOG.map((b, i) => ({
      ...b,
      imageUrl: placeholderSvg(b.label, 120 + i * 40),
    })),
    poses: POSE_CATALOG.map((p, i) => ({
      ...p,
      imageUrl: placeholderSvg(p.label, 180 + i * 25),
    })),
  };
}

export function findModel(id: string) {
  return MODEL_CATALOG.find((m) => m.id === id);
}
export function findBackground(id: string) {
  return BACKGROUND_CATALOG.find((b) => b.id === id);
}
export function findPose(id: string) {
  return POSE_CATALOG.find((p) => p.id === id);
}

/** Absolute URL for server-side generation (catalog may use data URLs). */
export function resolveCatalogImageUrl(pathOrData: string, appOrigin: string): string {
  if (pathOrData.startsWith('data:') || pathOrData.startsWith('http')) return pathOrData;
  return `${appOrigin.replace(/\/$/, '')}${pathOrData}`;
}
