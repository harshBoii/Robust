import 'server-only';

import { IS_SERVERLESS } from '@/lib/playwright/launch-browser';
import { createScrapeContext } from '@/lib/playwright/browser-context';
import { dismissCookieBanners, navigateForScrape } from '@/lib/playwright/navigate-page';
import { withBrowser } from '@/lib/playwright/with-browser';

import { uploadBrandDnaBuffer } from '../r2';
import { LANDING_DOM_EXTRACT_JS, type LandingDomTokens } from './landing-dom-extract';
import { derivePaletteFromDom } from './normalize-colors';

const log = (msg: string, data?: unknown) => {
  const ts = new Date().toISOString();
  if (data !== undefined) console.log(`[brand-dna-scraper] ${ts} ${msg}`, data);
  else console.log(`[brand-dna-scraper] ${ts} ${msg}`);
};

export function normalizeLandingUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Landing page URL is required');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function scrapeLandingPage(input: {
  landingPageUrl: string;
  companyId: string;
  brandId: string;
}): Promise<{
  domTokens: LandingDomTokens;
  domPalette: ReturnType<typeof derivePaletteFromDom>;
  screenshotUrl: string;
  screenshotBase64: string;
}> {
  const url = normalizeLandingUrl(input.landingPageUrl);
  log(`Scraping ${url} serverless=${IS_SERVERLESS}`);

  return withBrowser(async (browser) => {
    const ctx = await createScrapeContext(browser);
    const page = await ctx.newPage();

    await navigateForScrape(page, url);
    await dismissCookieBanners(page);

    let pngBuffer: Buffer;
    try {
      pngBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    } catch (e) {
      log('Full-page screenshot failed, using viewport', e);
      pngBuffer = await page.screenshot({ fullPage: false, type: 'png' });
    }

    const evaluated = await page.evaluate(LANDING_DOM_EXTRACT_JS);
    const domTokens = evaluated as LandingDomTokens;
    const domPalette = derivePaletteFromDom(domTokens);

    const { publicUrl } = await uploadBrandDnaBuffer({
      companyId: input.companyId,
      brandId: input.brandId,
      subpath: 'screenshots',
      filename: 'landing-page.png',
      bytes: pngBuffer,
      contentType: 'image/png',
    });

    return {
      domTokens,
      domPalette,
      screenshotUrl: publicUrl,
      screenshotBase64: pngBuffer.toString('base64'),
    };
  });
}
