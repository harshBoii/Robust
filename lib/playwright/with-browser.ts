import 'server-only';

import type { Browser } from 'playwright-core';

import { launchBrowser } from './launch-browser';

export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await launchBrowser();
  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}
