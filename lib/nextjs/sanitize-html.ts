/**
 * Allowlist sanitizer for article HTML served to customer sites.
 *
 * Customer sites render `contentHtml` with dangerouslySetInnerHTML, and the source text is
 * LLM-generated, so anything outside a small set of formatting tags is dropped. Tags are
 * rebuilt from scratch (attributes are never copied through), which rules out event
 * handlers, inline styles and `javascript:` URLs by construction.
 */

const ALLOWED_TAGS = new Set([
  'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'blockquote',
  'code', 'pre', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

/** Elements whose *content* must go too, not just the tags. */
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math|form)\b[\s\S]*?(<\/\1\s*>|$)/gi;

const VOID_TAGS = new Set(['br', 'hr']);

function safeHref(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/&amp;/g, '&');
  if (/^https?:\/\//i.test(value) || value.startsWith('/') || value.startsWith('#')) {
    return value.replace(/"/g, '%22');
  }
  return null;
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

export function sanitizeArticleHtml(html: string): string {
  const withoutDangerous = html.replace(DROP_WITH_CONTENT, '').replace(/<!--[\s\S]*?-->/g, '');

  const rebuilt = withoutDangerous.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (_match, closing: string, rawTag: string, attrs: string) => {
      let tag = rawTag.toLowerCase();
      // Article titles are rendered by the page itself; demote body h1s to h2.
      if (tag === 'h1') tag = 'h2';
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (closing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`;
      if (tag === 'a') {
        const href = safeHref(attr(attrs, 'href'));
        if (!href) return '<a>';
        const external = /^https?:\/\//i.test(href);
        return external
          ? `<a href="${href}" rel="noopener noreferrer" target="_blank">`
          : `<a href="${href}">`;
      }
      return `<${tag}>`;
    },
  );

  // Any stray '<' left is not part of an allowed tag — escape it.
  return rebuilt.replace(/<(?!\/?(?:h[234]|p|ul|ol|li|strong|em|b|i|a|blockquote|code|pre|br|hr|table|thead|tbody|tr|th|td)\b)/gi, '&lt;');
}

/** Minimal markdown link support on top of minimalMarkdownToHtml, which leaves `[x](url)` as-is. */
export function linkifyMarkdownLinks(html: string): string {
  return html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, text: string, url: string) => {
    return `<a href="${url.replace(/"/g, '%22')}">${text}</a>`;
  });
}
