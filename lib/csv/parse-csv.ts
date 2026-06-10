/**
 * Lightweight RFC-4180 CSV parser (quoted fields, commas in values).
 */

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  let field = '';
  let inQuotes = false;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      fields.push(field);
      field = '';
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  fields.push(field);
  return fields;
}

/** Split CSV text into logical lines, respecting quoted newlines. */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      if (current.trim().length > 0) lines.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim().length > 0) lines.push(current);
  return lines;
}

export function parseCsv(text: string): ParsedCsv {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { headers: [], rows: [] };

  const lines = splitCsvLines(trimmed);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseRow(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => parseRow(line));

  return { headers, rows };
}
