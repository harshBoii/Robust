/** Self-contained IIFE for page.evaluate — no Node closures. */
export const LANDING_DOM_EXTRACT_JS = `
(() => {
  function parsePx(v) {
    const n = parseFloat(String(v || '0'));
    return Number.isFinite(n) ? n : 0;
  }

  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  const headingFonts = new Set();
  const bodyFonts = new Set();
  document.querySelectorAll('h1,h2,h3').forEach((el) => {
    if (!visible(el)) return;
    const ff = getComputedStyle(el).fontFamily;
    if (ff) headingFonts.add(ff.split(',')[0].replace(/['"]/g, '').trim());
  });
  document.querySelectorAll('p,body').forEach((el) => {
    if (!visible(el)) return;
    const ff = getComputedStyle(el).fontFamily;
    if (ff) bodyFonts.add(ff.split(',')[0].replace(/['"]/g, '').trim());
  });

  const colors = [];
  const bgColors = [];
  const borderColors = [];
  const radii = [];
  let shadowCount = 0;
  let paddingSum = 0;
  let marginSum = 0;
  let sampleCount = 0;
  const alignCounts = { left: 0, center: 0, right: 0, other: 0 };
  let textNodes = 0;
  let mediaNodes = 0;

  const nodes = Array.from(document.querySelectorAll('body *')).slice(0, 300);
  for (const el of nodes) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const color = cs.color;
    const bg = cs.backgroundColor;
    const border = cs.borderColor;
    if (color && color !== 'rgba(0, 0, 0, 0)') colors.push(color);
    if (bg && bg !== 'rgba(0, 0, 0, 0)') bgColors.push(bg);
    if (border && border !== 'rgba(0, 0, 0, 0)') borderColors.push(border);
    radii.push(parsePx(cs.borderRadius));
    if (cs.boxShadow && cs.boxShadow !== 'none') shadowCount++;
    paddingSum += parsePx(cs.paddingTop) + parsePx(cs.paddingBottom);
    marginSum += parsePx(cs.marginTop) + parsePx(cs.marginBottom);
    sampleCount++;
    const ta = cs.textAlign;
    if (ta === 'left' || ta === 'start') alignCounts.left++;
    else if (ta === 'center') alignCounts.center++;
    else if (ta === 'right' || ta === 'end') alignCounts.right++;
    else alignCounts.other++;
    const tag = el.tagName.toLowerCase();
    if (['img','video','svg','picture','canvas'].includes(tag)) mediaNodes++;
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) textNodes++;
  }

  const btn = document.querySelector('button, a[class*="btn"], a[class*="cta"], [role="button"]');
  const btnBg = btn ? getComputedStyle(btn).backgroundColor : null;

  let cornerRadiusStyle = 'Sharp';
  const avgRadius = radii.length ? radii.reduce((a,b)=>a+b,0)/radii.length : 0;
  if (avgRadius >= 8) cornerRadiusStyle = 'Rounded';
  else if (avgRadius >= 2) cornerRadiusStyle = 'Subtle';

  let shadowStyle = 'Flat';
  if (shadowCount > sampleCount * 0.15) shadowStyle = 'Deep';
  else if (shadowCount > 0) shadowStyle = 'Soft';

  const whitespaceRatio = sampleCount ? (paddingSum + marginSum) / sampleCount : 0;
  let whitespaceLevel = 'Medium';
  if (whitespaceRatio > 40) whitespaceLevel = 'High';
  else if (whitespaceRatio < 15) whitespaceLevel = 'Low';

  const total = textNodes + mediaNodes || 1;
  const mediaRatio = mediaNodes / total;
  let contentDensity = 'Medium';
  if (mediaRatio > 0.35 || textNodes > 80) contentDensity = 'High';
  else if (mediaRatio < 0.1 && textNodes < 30) contentDensity = 'Low';

  const alignEntries = Object.entries(alignCounts).sort((a,b)=>b[1]-a[1]);
  let alignmentStyle = 'Mixed';
  if (alignEntries[0] && alignEntries[0][1] > sampleCount * 0.5) {
    const k = alignEntries[0][0];
    if (k === 'left') alignmentStyle = 'Left-aligned';
    else if (k === 'center') alignmentStyle = 'Centered';
    else if (k === 'right') alignmentStyle = 'Right-aligned';
  }

  return {
    headingFonts: [...headingFonts].slice(0, 5),
    bodyFonts: [...bodyFonts].slice(0, 5),
    textColors: [...new Set(colors)].slice(0, 40),
    backgroundColors: [...new Set(bgColors)].slice(0, 40),
    borderColors: [...new Set(borderColors)].slice(0, 20),
    buttonBackground: btnBg,
    cornerRadiusStyle,
    shadowStyle,
    whitespaceLevel,
    contentDensity,
    alignmentStyle,
  };
})()
`;

export type LandingDomTokens = {
  headingFonts: string[];
  bodyFonts: string[];
  textColors: string[];
  backgroundColors: string[];
  borderColors: string[];
  buttonBackground: string | null;
  cornerRadiusStyle: string;
  shadowStyle: string;
  whitespaceLevel: string;
  contentDensity: string;
  alignmentStyle: string;
};
