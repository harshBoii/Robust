import 'server-only';

import OpenAI from 'openai';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type AdContext = {
  name: string;
  status: string | null;
  spendToday: number;
  spendTotal: number;
  cpi: number | null;
  ctr: number;
  hookRate: number | null;
  signal: string | null;
};

type RequestBody = {
  messages: ChatMessage[];
  context: {
    ads: AdContext[];
    totalSpendToday: number;
    totalAds: number;
    activeAds: number;
  };
};

function buildSystemPrompt(ctx: RequestBody['context']): string {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  const adLines = ctx.ads
    .slice(0, 8)
    .map(
      (a) =>
        `• "${a.name}" | ${a.status ?? '?'} | Spend today: ${fmt(a.spendToday)} | CTR: ${pct(a.ctr)} | CPI: ${a.cpi != null ? fmt(a.cpi) : 'n/a'} | Hook: ${a.hookRate != null ? pct(a.hookRate) : 'n/a'} | Signal: ${a.signal ?? 'none'}`,
    )
    .join('\n');

  return `You are Miss Robusta — a sharp, confident, and friendly Meta Ads analyst embedded inside a SaaS dashboard called Robust.

Live account snapshot:
- Total ads: ${ctx.totalAds} (${ctx.activeAds} active)
- Total spend today: ${fmt(ctx.totalSpendToday)}

Top ads by today's spend:
${adLines}

Signal guide:
- WINNER → CPI well below target, CTR rising — candidate for budget scaling
- UNDERPERFORMER → CPI above ceiling — pause candidate
- FATIGUE/Slow → hook rate dropping — creative refresh needed
- None → insufficient data yet

Rules of engagement:
- Format your responses using Markdown for better readability:
  - Use **bold** for important numbers and key takeaways
  - Use ## Headers for sections (e.g., ## Top Performers, ## Recommendations)
  - Use bullet lists (- item) for multiple points
  - Use numbered lists (1. item) for step-by-step actions
  - Use > blockquotes for highlighting key insights
- Keep responses concise (2–4 short paragraphs max unless asked for more).
- Be specific — call out ad names, numbers, percentages.
- Use ₹ for currency. Recommend clear next actions.
- If asked something outside Meta Ads, politely redirect.
- Never fabricate numbers not in the context.
- Never use emojis or emoticons — use Markdown only (\`**bold**\`, lists, headings, blockquotes).`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as RequestBody;
  const { messages, context } = body;

  if (!messages?.length || !context) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const stream = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    stream: true,
    messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
