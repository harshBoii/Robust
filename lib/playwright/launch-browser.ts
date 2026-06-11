import 'server-only';

import type { Browser } from 'playwright-core';

export const IS_SERVERLESS =
  !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL;

/**
 * Launch Chromium for the current environment.
 * - Serverless (Vercel/Lambda): playwright-core + @sparticuz/chromium binary.
 * - Local dev: the full `playwright` package with its downloaded Chromium.
 *
 * Local dev requires: `npx playwright install chromium`
 */
export async function launchBrowser(): Promise<Browser> {
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
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}
