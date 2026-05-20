import 'server-only';

import OpenAI from 'openai';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import type { AssistantDashboardContext } from '@/lib/dashboard/assistant-context';
import { parseInsightBullets } from '@/lib/dashboard/parse-insight-bullets';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt(ctx: AssistantDashboardContext): string {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  const adLines = ctx.ads
    .map(
      (a) =>
        `• "${a.name}" | ${a.status ?? '?'} | Spend today: ${fmt(a.spendToday)} | CTR: ${pct(a.ctr)} | CPI: ${a.cpi != null ? fmt(a.cpi) : 'n/a'} | Hook: ${a.hookRate != null ? pct(a.hookRate) : 'n/a'} | Signal: ${a.signal ?? 'none'}`,
    )
    .join('\n');

  return `You are Miss Robusta — a sharp Meta Ads analyst for Robust.

Live account snapshot:
- Total ads: ${ctx.totalAds} (${ctx.activeAds} active)
- Total spend today: ${fmt(ctx.totalSpendToday)}

Top ads by spend today:
${adLines || '(no ads loaded)'}

Signal guide: WINNER = scale candidate; UNDERPERFORMER = pause candidate; FATIGUE = refresh creative; none = early data.

Reply ONLY with 3–4 bullet points (each line starts with "- "). Formatting rules:
- Wrap every ad name in **double asterisks** (e.g. **Maternity Dress**)
- Write signal labels in ALL CAPS: WINNER, UNDERPERFORMER, FATIGUE
- Include spend, CPI, and CTR numbers from the snapshot when relevant
- Start each bullet with a clear action (Scale, Pause, Watch, Refresh)
Be specific with ad names and numbers from the data. No intro, no outro, no headings, no emojis. Never invent metrics not in the snapshot.`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let context: AssistantDashboardContext;
  try {
    const body = (await req.json()) as { context?: AssistantDashboardContext };
    if (!body?.context?.ads) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    context = body.context;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        {
          role: 'user',
          content:
            'Give me a quick insight on my Meta ads performance right now — what should I focus on today?',
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const bullets = parseInsightBullets(raw);

    return NextResponse.json({
      bullets: bullets.length > 0 ? bullets : [raw || 'No insight available yet. Try refreshing your dashboard data.'],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate insight';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
