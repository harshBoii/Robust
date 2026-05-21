/** Curated static assets for Product on Model (Subpath 3). Files live under public/image-gen/. */

export type CatalogItem = {
  id: string;
  label: string;
  imageUrl: string;
  category?: string;
};

export type ModelCategory = 'male' | 'female' | 'kids';

const BASE = '/image-gen';

/** Encode path segments so spaces and parentheses work in Next.js public URLs. */
function publicAsset(relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean).map((s) => encodeURIComponent(s));
  return `${BASE}/${segments.join('/')}`;
}

export const MODEL_CATALOG: Array<CatalogItem & { category: ModelCategory }> = [
  {
    id: 'model-m-1',
    category: 'male',
    label: 'Alex',
    imageUrl: publicAsset('male/generation-1 (3).png'),
  },
  {
    id: 'model-f-1',
    category: 'female',
    label: 'Sam',
    imageUrl: publicAsset('female/female 1.jpeg'),
  },
  {
    id: 'model-f-2',
    category: 'female',
    label: 'Riley',
    imageUrl: publicAsset('female/female 2.jpg'),
  },
  {
    id: 'model-k-1',
    category: 'kids',
    label: 'Casey',
    imageUrl: publicAsset('kids/kids 1.jpeg'),
  },
];

export const BACKGROUND_CATALOG: CatalogItem[] = [
  { id: 'bg-1', label: 'Studio light', imageUrl: publicAsset('backgrounds/bg 1.jpeg') },
  { id: 'bg-2', label: 'Urban street', imageUrl: publicAsset('backgrounds/bg 2.jpeg') },
  { id: 'bg-3', label: 'Outdoor nature', imageUrl: publicAsset('backgrounds/bg 3.jpeg') },
];

export const POSE_CATALOG: CatalogItem[] = [
  { id: 'pose-1', label: 'Front facing', imageUrl: publicAsset('poses/pose 1.jpeg') },
  { id: 'pose-2', label: 'Three-quarter', imageUrl: publicAsset('poses/pose 2.jpeg') },
  { id: 'pose-3', label: 'Holding product', imageUrl: publicAsset('poses/pose 3.jpeg') },
  { id: 'pose-4', label: 'Casual stance', imageUrl: publicAsset('poses/pose 4.jpeg') },
  { id: 'pose-5', label: 'Dynamic pose', imageUrl: publicAsset('poses/pose 5.jpeg') },
];

export function getCatalogForWidget() {
  return {
    models: MODEL_CATALOG,
    backgrounds: BACKGROUND_CATALOG,
    poses: POSE_CATALOG,
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

/** Absolute URL for server-side generation. */
export function resolveCatalogImageUrl(pathOrData: string, appOrigin: string): string {
  if (pathOrData.startsWith('data:') || pathOrData.startsWith('http')) return pathOrData;
  return `${appOrigin.replace(/\/$/, '')}${pathOrData}`;
}
