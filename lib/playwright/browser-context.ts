import 'server-only';

import type { Browser, BrowserContext } from 'playwright-core';

export const SCRAPE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

export async function createScrapeContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: SCRAPE_USER_AGENT,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
}
