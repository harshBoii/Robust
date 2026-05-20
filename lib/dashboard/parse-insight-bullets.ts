/** Turn Miss Robusta markdown reply into plain bullet strings for the home insight card. */
export function parseInsightBullets(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets: string[] = [];

  for (const line of lines) {
    const listMatch = line.match(/^[-*•]\s+(.+)$/) ?? line.match(/^\d+\.\s+(.+)$/);
    if (listMatch) {
      bullets.push(stripMarkdown(listMatch[1]));
      continue;
    }
    if (line.startsWith('>')) {
      bullets.push(stripMarkdown(line.replace(/^>\s*/, '')));
    }
  }

  if (bullets.length === 0 && text.trim()) {
    const chunks = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => stripMarkdown(s.trim()))
      .filter((s) => s.length > 20);
    return chunks.slice(0, 4);
  }

  return bullets.slice(0, 5);
}

function stripMarkdown(s: string): string {
  return s.replace(/^#+\s*/, '').trim();
}
