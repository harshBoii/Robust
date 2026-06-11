import 'server-only';

import type { LandingDomTokens } from './landing-dom-extract';

function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return (
    '#' +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase()
  );
}

function isNeutral(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 15 && max > 230) return true;
  if (max - min < 15 && max < 30) return true;
  return false;
}

function toHexList(colors: string[]): string[] {
  const out: string[] = [];
  for (const c of colors) {
    if (c.startsWith('#')) {
      out.push(c.toLowerCase());
      continue;
    }
    const hex = rgbToHex(c);
    if (hex) out.push(hex);
  }
  return [...new Set(out)];
}

export function derivePaletteFromDom(tokens: LandingDomTokens) {
  const textHex = toHexList(tokens.textColors).filter((h) => !isNeutral(h));
  const bgHex = toHexList(tokens.backgroundColors);
  const accentHex = tokens.buttonBackground ? rgbToHex(tokens.buttonBackground) : null;

  const primary = textHex[0] ?? '#333333';
  const secondary = textHex[1] ?? textHex[0] ?? '#666666';
  const accent = accentHex && !isNeutral(accentHex) ? accentHex : textHex[2] ?? '#0066cc';
  const background =
    bgHex.find((h) => isNeutral(h)) ?? bgHex[0] ?? '#ffffff';

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    backgroundColor: background,
    headingFont: tokens.headingFonts[0] ?? null,
    bodyFont: tokens.bodyFonts[0] ?? null,
    whitespaceLevel: tokens.whitespaceLevel,
    contentDensity: tokens.contentDensity,
    alignmentStyle: tokens.alignmentStyle,
    cornerRadiusStyle: tokens.cornerRadiusStyle,
    shadowStyle: tokens.shadowStyle,
  };
}
