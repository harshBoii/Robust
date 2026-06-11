import 'server-only';

import type { Page } from 'playwright-core';

export async function navigateForScrape(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(5_000);
    return;
  }
  await page.waitForTimeout(3_000);
}

export async function dismissCookieBanners(page: Page): Promise<void> {
  const selectors = [
    '[data-testid="cookie-policy-manage-dialog-accept-button"]',
    '[id*="cookie"] button',
    '[class*="consent"] button',
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("I agree")',
  ];

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2_000 })) {
        await btn.click();
        await page.waitForTimeout(1_000);
        return;
      }
    } catch {
      /* ignore */
    }
  }
}
