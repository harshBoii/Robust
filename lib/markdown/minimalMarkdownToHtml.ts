function applyInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function minimalMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  const htmlLines: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      const level = Math.min(6, heading[1].length);
      htmlLines.push(`<h${level}>${applyInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    const listItem = /^[-*]\s+(.*)$/.exec(line);
    if (listItem) {
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      htmlLines.push(`<li>${applyInline(listItem[1])}</li>`);
      continue;
    }

    if (!line.trim()) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (inList) {
      htmlLines.push('</ul>');
      inList = false;
    }
    htmlLines.push(`<p>${applyInline(line)}</p>`);
  }

  if (inList) htmlLines.push('</ul>');
  return htmlLines.join('\n');
}
