import 'server-only';

import { createScrapeContext } from '@/lib/playwright/browser-context';
import { dismissCookieBanners, navigateForScrape } from '@/lib/playwright/navigate-page';
import { withBrowser } from '@/lib/playwright/with-browser';

export const ARTICLE_EXTRACT_JS = `
(() => {
  const remove = ['nav','footer','aside','script','style','noscript','header'];
  remove.forEach((tag) => {
    document.querySelectorAll(tag).forEach((el) => el.remove());
  });

  let root =
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main') ||
    document.body;

  if (!root) return '';

  const paragraphs = [...root.querySelectorAll('p')];
  if (paragraphs.length >= 3) {
    return paragraphs.map((p) => (p.innerText || '').trim()).filter(Boolean).join('\\n\\n');
  }

  return (root.innerText || '').trim().slice(0, 50000);
})()
`;

const log = (msg: string, data?: unknown) => {
  if (data !== undefined) console.log(`[brand-dna-article-scraper] ${msg}`, data);
  else console.log(`[brand-dna-article-scraper] ${msg}`);
};

export async function scrapeArticleTexts(urls: string[]): Promise<string[]> {
  const texts: string[] = [];

  await withBrowser(async (browser) => {
    const ctx = await createScrapeContext(browser);

    for (const rawUrl of urls) {
      const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      const page = await ctx.newPage();
      try {
        await navigateForScrape(page, url);
        await dismissCookieBanners(page);
        const text = (await page.evaluate(ARTICLE_EXTRACT_JS)) as string;
        if (text?.trim()) texts.push(text.trim());
        else log('No article text', url);
      } catch (e) {
        log('Failed URL', { url, error: e instanceof Error ? e.message : String(e) });
      } finally {
        await page.close().catch(() => {});
      }
    }
  });

  return texts;
}

export function concatenateArticleTexts(texts: string[], maxChars = 80_000): string {
  let combined = texts.join('\n\n---\n\n');
  if (combined.length > maxChars) combined = combined.slice(0, maxChars);
  return combined;
}
