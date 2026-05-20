'use client';

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'ad'; value: string }
  | { kind: 'signal'; value: 'WINNER' | 'UNDERPERFORMER' | 'FATIGUE' }
  | { kind: 'money'; value: string }
  | { kind: 'pct'; value: string }
  | { kind: 'bold'; value: string };

const SEGMENT_RE =
  /(\*\*[^*]+\*\*)|("(?:[^"]+)")|\b(WINNER|UNDERPERFORMER|FATIGUE)\b|(₹[\d,]+(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?%)/g;

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SEGMENT_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, index) });
    }

    const [full, bold, quoted, signal, money, pct] = match;
    if (bold) {
      segments.push({ kind: 'bold', value: bold.slice(2, -2) });
    } else if (quoted) {
      segments.push({ kind: 'ad', value: quoted.slice(1, -1) });
    } else if (signal) {
      segments.push({ kind: 'signal', value: signal as 'WINNER' | 'UNDERPERFORMER' | 'FATIGUE' });
    } else if (money) {
      segments.push({ kind: 'money', value: money });
    } else if (pct) {
      segments.push({ kind: 'pct', value: pct });
    } else {
      segments.push({ kind: 'text', value: full });
    }

    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ kind: 'text', value: text }];
}

const signalStyles: Record<'WINNER' | 'UNDERPERFORMER' | 'FATIGUE', string> = {
  WINNER: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  UNDERPERFORMER: 'bg-red-500/15 text-red-600 dark:text-red-400',
  FATIGUE: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

function SignalBadge({ value }: { value: 'WINNER' | 'UNDERPERFORMER' | 'FATIGUE' }) {
  return (
    <span
      className={`mx-0.5 inline-flex rounded px-1 py-px font-ui text-[9px] font-bold uppercase tracking-wide ${signalStyles[value]}`}
    >
      {value.replace('_', ' ')}
    </span>
  );
}

export default function FormattedInsightText({ text }: { text: string }) {
  const segments = parseSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case 'ad':
            return (
              <span key={i} className="font-semibold text-violet-700 dark:text-violet-300">
                &ldquo;{seg.value}&rdquo;
              </span>
            );
          case 'bold':
            return (
              <span key={i} className="font-semibold text-foreground">
                {seg.value}
              </span>
            );
          case 'signal':
            return <SignalBadge key={i} value={seg.value} />;
          case 'money':
            return (
              <span key={i} className="font-medium tabular-nums text-foreground">
                {seg.value}
              </span>
            );
          case 'pct':
            return (
              <span key={i} className="font-medium tabular-nums text-violet-600 dark:text-violet-400">
                {seg.value}
              </span>
            );
          default:
            return <span key={i}>{seg.value}</span>;
        }
      })}
    </>
  );
}
