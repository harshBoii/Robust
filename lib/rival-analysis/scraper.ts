import 'server-only';

import { createScrapeContext } from '@/lib/playwright/browser-context';
import { dismissCookieBanners, navigateForScrape } from '@/lib/playwright/navigate-page';
import { IS_SERVERLESS, launchBrowser } from '@/lib/playwright/launch-browser';

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

const MAX_SCROLLS = 15;

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

const log = (msg: string, data?: unknown) => {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[rival-scraper] ${ts} ${msg}`, data);
  } else {
    console.log(`[rival-scraper] ${ts} ${msg}`);
  }
};

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

  log(`Starting scrape — page="${pageName}" country=${country} serverless=${IS_SERVERLESS}`);
  log(`URL: ${url}`);

  log('Launching browser…');
  const browser = await launchBrowser();
  log('Browser launched.');

  try {
    const ctx = await createScrapeContext(browser);
    const page = await ctx.newPage();
    log('Navigating to FB Ad Library…');
    await navigateForScrape(page, url);
    log('Page loaded. Waiting for hydration…');
    await dismissCookieBanners(page);

    // scroll to load ads
    log(`Scrolling up to ${MAX_SCROLLS} times to load ads…`);
    let prevH = 0;
    for (let i = 0; i < MAX_SCROLLS; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2500);
      const h = await page.evaluate('document.body.scrollHeight') as number;
      log(`  scroll ${i + 1}/${MAX_SCROLLS} — height=${h}px${h === prevH ? ' (no change, stopping)' : ''}`);
      if (h === prevH) break;
      prevH = h;
    }

    log('Extracting ads from DOM…');
    const evaluated = await page.evaluate(DOM_EXTRACT_JS);
    const rawAds = (Array.isArray(evaluated) ? evaluated : []) as Omit<ScrapedAd, 'days_running'>[];
    log(`DOM extraction returned ${rawAds.length} raw ad(s).`);

    // log a quick summary of what was found
    if (rawAds.length === 0) {
      const bodySnippet = await page.evaluate('document.body.innerText').catch(() => '') as string;
      log('WARNING: 0 ads found. First 500 chars of page text:', bodySnippet.slice(0, 500));
    } else {
      log('Raw ad library IDs:', rawAds.map(a => a.library_id));
    }

    await browser.close();
    log('Browser closed.');

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

    const top6 = ads
      .filter(a => a.days_running !== null)
      .sort((a, b) => (b.days_running ?? 0) - (a.days_running ?? 0))
      .slice(0, 6);

    log(`After longevity filter: ${top6.length} ad(s) kept (top 6 by days running).`);
    top6.forEach((a, i) =>
      log(`  #${i + 1} library_id=${a.library_id} days=${a.days_running} cta=${a.cta ?? 'none'} images=${a.images.length}`)
    );

    return top6;
  } catch (err) {
    log('ERROR during scrape:', err instanceof Error ? err.message : String(err));
    await browser.close().catch(() => {});
    throw err;
  }
}
