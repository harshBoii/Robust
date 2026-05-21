import 'server-only';

import { readFile } from 'fs/promises';
import path from 'path';

import { fetchImageBytesFromUrl } from '@/lib/cloudfare/r2-video-thumbnail';
import { getAppOrigin } from '@/lib/app-origin';

import { resolveCatalogImageUrl } from './catalog';

/** Load bytes for a catalog /image-gen/ URL (local public file or remote fallback). */
export async function loadCatalogImageBytes(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith('/image-gen/')) {
    const relative = decodeURIComponent(imageUrl.replace(/^\/image-gen\//, ''));
    const filePath = path.join(process.cwd(), 'public', 'image-gen', relative);
    try {
      return await readFile(filePath);
    } catch {
      const absolute = resolveCatalogImageUrl(imageUrl, getAppOrigin());
      const bytes = await fetchImageBytesFromUrl(absolute, { attempts: 2, delayMs: 800 });
      if (!bytes) throw new Error(`Could not load catalog image: ${relative}`);
      return Buffer.from(bytes);
    }
  }

  const bytes = await fetchImageBytesFromUrl(imageUrl, { attempts: 3, delayMs: 1000 });
  if (!bytes) throw new Error('Could not load reference image');
  return Buffer.from(bytes);
}
