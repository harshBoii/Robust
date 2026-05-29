export function minimalMarkdownToHtml(markdown: string): string {
  let html = markdown;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^- (.+)$/);
    if (listMatch) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${listMatch[1]}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (line.trim() === '') {
        result.push('</p><p>');
      } else if (/^<[hu]/.test(line)) {
        result.push(line);
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  html = result.join('');
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

/** Appends a markdown block linking to a related article (e.g. new cluster page from pillar). */
// ─── Pillar page related articles append ──────────────────────────────────────

/**
 * Appends a markdown block linking to a related article (e.g. new cluster page from pillar).
 * The markdown link syntax [text](url) is now correctly handled by minimalMarkdownToHtml.
 */
export function buildRelatedArticlesAppend(
  currentMarkdown: string,
  item: { title: string; url: string }
): string {
  const base = currentMarkdown.trimEnd();
  // Escape ] in title so it doesn't break the markdown link syntax.
  const escapedTitle = item.title.replace(/]/g, "\\]");
  const block = `\n\n## Related reading\n\n- [${escapedTitle}](${item.url})\n`;
  return base === "" ? block.trimStart() : base + block;
}
