import 'server-only';

import { domainToWebsite, normalizeDomain } from './domain';
import type { DomainPreviewResult } from './types';

export type { DomainPreviewResult };

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
const PRODUCT_PATH_RE = /\/products\/[a-z0-9-]+/gi;

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return og[1].trim().slice(0, 120);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) return title[1].trim().replace(/\s+/g, ' ').slice(0, 120);
  return null;
}

function countProductLinks(html: string): number {
  const matches = html.match(PRODUCT_PATH_RE);
  if (!matches) return 0;
  return new Set(matches.map((m) => m.toLowerCase())).size;
}

function countColors(html: string): number {
  const found = new Set<string>();
  for (const match of html.match(HEX_RE) ?? []) {
    const hex = match.toLowerCase();
    if (hex === '#fff' || hex === '#ffffff' || hex === '#000' || hex === '#000000') continue;
    found.add(hex);
    if (found.size >= 12) break;
  }
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (theme?.[1]?.startsWith('#')) found.add(theme[1].toLowerCase());
  return found.size;
}

function buildMessage(input: {
  title: string | null;
  productLinkCount: number;
  colorCount: number;
  isShopify: boolean;
}): string {
  const parts: string[] = [];
  if (input.title) parts.push(`"${input.title}"`);
  if (input.productLinkCount > 0) {
    parts.push(
      `${input.productLinkCount} product${input.productLinkCount === 1 ? '' : 's'} detected`,
    );
  }
  if (input.colorCount > 0) {
    parts.push(`${input.colorCount} brand color${input.colorCount === 1 ? '' : 's'}`);
  }
  if (input.isShopify) parts.push('Shopify store');
  if (parts.length === 0) return 'Site reachable — we can enrich your brand from this domain.';
  return `Found: ${parts.join(' · ')}`;
}

export async function previewDomain(rawDomain: string): Promise<DomainPreviewResult> {
  const domain = normalizeDomain(rawDomain);
  if (!domain || !domain.includes('.')) {
    return {
      ok: false,
      domain: domain || rawDomain,
      website: '',
      title: null,
      productLinkCount: 0,
      colorCount: 0,
      isShopify: false,
      message: 'Enter a valid domain like acme.com',
    };
  }

  const website = domainToWebsite(domain);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(website, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RobustOnboarding/1.0 (+https://tryrobust.com)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return {
        ok: false,
        domain,
        website,
        title: null,
        productLinkCount: 0,
        colorCount: 0,
        isShopify: false,
        message: `Could not reach ${domain} (HTTP ${res.status}). Check the URL and try again.`,
      };
    }

    const html = (await res.text()).slice(0, 250_000);
    const title = extractTitle(html);
    const productLinkCount = countProductLinks(html);
    const colorCount = countColors(html);
    const isShopify =
      /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(html) ||
      res.url.includes('myshopify.com');

    return {
      ok: true,
      domain,
      website,
      title,
      productLinkCount,
      colorCount,
      isShopify,
      message: buildMessage({ title, productLinkCount, colorCount, isShopify }),
    };
  } catch {
    return {
      ok: false,
      domain,
      website,
      title: null,
      productLinkCount: 0,
      colorCount: 0,
      isShopify: false,
      message: `Could not reach ${domain}. Check spelling or try again in a moment.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
