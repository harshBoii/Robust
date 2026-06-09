import 'server-only';

import type { Browser } from 'playwright-core';

export interface ScrapedAd {
  library_id: string;
  start_date: string | null;
  status: string;
  platforms: string[];
  ad_copy: string;
  cta: string | null;
  images: string[];
  videos: { src: string | null; poster: string | null }[];
  landing_urls: string[];
  raw_text: string;
  days_running: number | null;
}

const HEADLESS = true;
const MAX_SCROLLS = 15;

const IS_SERVERLESS =
  !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL;

/**
 * Launch Chromium for the current environment.
 * - Serverless (Vercel/Lambda): playwright-core + @sparticuz/chromium binary.
 * - Local dev: the full `playwright` package with its downloaded Chromium.
 */
async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    const { chromium } = await import('playwright-core');
    return chromium.launch({
      args: [...sparticuz.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import('playwright');
  return chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

const DOM_EXTRACT_JS = `
(() => {
  const results = [];
  const libraryNodes = [...document.querySelectorAll('span')].filter(
    el => el.innerText && el.innerText.includes('Library ID:')
  );

  for (const node of libraryNodes) {
    let card = node;
    for (let i = 0; i < 20; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      const txt = card.innerText || '';
      if (
        txt.includes('Library ID:') &&
        txt.includes('Started running on') &&
        txt.includes('See ad details')
      ) break;
    }

    const text = card.innerText || '';
    const idMatch = text.match(/Library ID:\\s*(\\d+)/);
    const startMatch = text.match(/Started running on\\s*([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})/);
    if (!idMatch) continue;

    const images = [];
    card.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if (src.includes('fbcdn') && !src.includes('emoji')) images.push(src);
    });

    const videos = [];
    card.querySelectorAll('video').forEach(v => {
      videos.push({ src: v.src || null, poster: v.poster || null });
    });

    const links = [];
    card.querySelectorAll('a[href]').forEach(a => { if (a.href) links.push(a.href); });

    const ctas = ['Shop now','Shop Now','Learn More','Sign Up','Book Now','Apply Now','Contact Us'];
    let cta = null;
    for (const btn of ctas) { if (text.includes(btn)) { cta = btn; break; } }

    results.push({
      library_id: idMatch[1],
      start_date: startMatch ? startMatch[1] : null,
      status: text.includes('Active') ? 'Active' : 'Inactive',
      platforms: [],
      ad_copy: text,
      cta,
      images: [...new Set(images)],
      videos,
      landing_urls: [...new Set(links)],
      raw_text: text.slice(0, 5000),
    });
  }

  const unique = [];
  const seen = new Set();
  for (const ad of results) {
    if (seen.has(ad.library_id)) continue;
    seen.add(ad.library_id);
    unique.push(ad);
  }
  return unique;
})()
`;

export async function scrapeRivalAds(
  pageName: string,
  country = 'IN',
): Promise<ScrapedAd[]> {
  const url =
    `https://www.facebook.com/ads/library/` +
    `?active_status=active&ad_type=all` +
    `&country=${country}` +
    `&is_targeted_country=false&media_type=all` +
    `&q=${encodeURIComponent(pageName)}` +
    `&search_type=page`;

  const browser = await launchBrowser();

  try {
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });

    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // dismiss cookie banner
    try {
      const btn = page.locator('[data-testid="cookie-policy-manage-dialog-accept-button"]');
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
        await page.waitForTimeout(1000);
      }
    } catch { /* ignore */ }

    // scroll to load ads
    let prevH = 0;
    for (let i = 0; i < MAX_SCROLLS; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2500);
      const h = await page.evaluate('document.body.scrollHeight') as number;
      if (h === prevH) break;
      prevH = h;
    }

    const evaluated = await page.evaluate(DOM_EXTRACT_JS);
    const rawAds = (Array.isArray(evaluated) ? evaluated : []) as Omit<ScrapedAd, 'days_running'>[];
    await browser.close();

    // compute longevity
    const today = new Date();
    const ads: ScrapedAd[] = rawAds.map(ad => {
      let days_running: number | null = null;
      if (ad.start_date) {
        try {
          const start = new Date(ad.start_date.trim());
          if (!isNaN(start.getTime())) {
            days_running = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
          }
        } catch { /* ignore */ }
      }
      return { ...ad, days_running };
    });

    return ads
      .filter(a => a.days_running !== null)
      .sort((a, b) => (b.days_running ?? 0) - (a.days_running ?? 0))
      .slice(0, 6);
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}
