/**
 * Builds small WebP card thumbnails for /templates from the full-size art in public/templates.
 *
 *   npm run templates:thumbs
 *
 * Output: public/templates/thumbs/<slug>.webp (640px wide, enough for 2x on a ~320px card).
 * Re-run after adding or replacing an image in public/templates.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = path.join(process.cwd(), 'public/templates');
const OUT_DIR = path.join(SRC_DIR, 'thumbs');
const WIDTH = 640;
const QUALITY = 72;

/** "meta story:reel.png" -> "meta-story-reel" — must match thumbSlug() in lib/templates/template-previews.ts */
function thumbSlug(file) {
  return path
    .parse(file)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));

for (const file of files) {
  const out = path.join(OUT_DIR, `${thumbSlug(file)}.webp`);
  const info = await sharp(path.join(SRC_DIR, file))
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);
  console.log(`${file} -> thumbs/${path.basename(out)} (${Math.round(info.size / 1024)} KB)`);
}
