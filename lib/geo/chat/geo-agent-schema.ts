import { z } from 'zod';

import { ALL_SPREAD_PLATFORMS } from '@/lib/geo/bounty/spread-platforms';

export const GEO_TOOL_NAMES = [
  'geo.fetch_dashboard',
  'geo.fetch_geoknight',
  'geo.fetch_bounty',
  'geo.fetch_bounty_pages',
  'geo.get_cited',
  'geo.get_publish_targets',
  'geo.fetch_reddit_targets',
  'geo.publish_content',
] as const;

export type GeoToolName = (typeof GEO_TOOL_NAMES)[number];

const bountyPlatformSchema = z.enum(
  ALL_SPREAD_PLATFORMS as [string, ...string[]],
);

export const geoToolCallSchema = z.object({
  name: z.enum(GEO_TOOL_NAMES),
  args: z.record(z.unknown()).optional().default({}),
});

export type GeoToolCall = z.infer<typeof geoToolCallSchema>;

export const geoPendingPublishSchema = z.object({
  bountyId: z.string().min(1),
  platforms: z.array(bountyPlatformSchema).optional(),
  contentId: z.string().optional(),
  approveAll: z.boolean().optional(),
  redditSubreddit: z.string().optional(),
  redditFlairId: z.string().optional(),
  confirmed: z.boolean().optional(),
});

export const geoRedditTargetPickerSchema = z.object({
  bountyId: z.string().min(1),
});

export const geoAgentTurnSchema = z.object({
  status: z.enum(['tool', 'reply']),
  toolCalls: z.array(geoToolCallSchema).max(3).optional(),
  reply: z.string().max(12000).optional(),
  memory: z.string().max(4000).optional(),
  pendingPublish: geoPendingPublishSchema.optional(),
  /** Inline subreddit picker in chat (user must choose before Reddit publish). */
  redditTargetPicker: geoRedditTargetPickerSchema.optional(),
  /** Short follow-up chips shown under the composer (3–4 items when status is reply). */
  suggestions: z.array(z.string().min(1).max(120)).min(1).max(4).optional(),
});

const MAX_GEO_SUGGESTIONS = 4;

export function normalizeGeoSuggestions(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    if (!s || out.includes(s)) continue;
    out.push(s.slice(0, 120));
    if (out.length >= MAX_GEO_SUGGESTIONS) break;
  }
  return out.length ? out : undefined;
}

export type GeoAgentTurn = z.infer<typeof geoAgentTurnSchema>;

export function normalizeGeoAgentTurn(raw: unknown): GeoAgentTurn {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'reply',
      reply: 'I had trouble processing that. Could you rephrase your GEO question?',
    };
  }

  const o = raw as Record<string, unknown>;
  const parsed = geoAgentTurnSchema.safeParse(raw);
  if (parsed.success) {
    const turn = parsed.data;
    const suggestions =
      turn.suggestions ?? normalizeGeoSuggestions((o as { suggestions?: unknown }).suggestions);
    if (turn.status === 'reply' && !turn.reply?.trim()) {
      return {
        ...turn,
        suggestions,
        reply: 'Let me know what you would like to explore in your organic visibility strategy.',
      };
    }
    return suggestions ? { ...turn, suggestions } : turn;
  }

  const reply =
    typeof o.reply === 'string' && o.reply.trim()
      ? o.reply.trim()
      : 'How can I help with your GEO and organic growth strategy today?';

  const toolCalls = Array.isArray(o.toolCalls)
    ? o.toolCalls
        .map((tc) => geoToolCallSchema.safeParse(tc))
        .filter((r) => r.success)
        .map((r) => r.data!)
        .slice(0, 3)
    : undefined;

  if (toolCalls?.length) {
    return { status: 'tool', toolCalls, memory: typeof o.memory === 'string' ? o.memory : undefined };
  }

  return {
    status: 'reply',
    reply,
    memory: typeof o.memory === 'string' ? o.memory : undefined,
    pendingPublish: geoPendingPublishSchema.safeParse(o.pendingPublish).success
      ? geoPendingPublishSchema.parse(o.pendingPublish)
      : undefined,
    redditTargetPicker: geoRedditTargetPickerSchema.safeParse(o.redditTargetPicker).success
      ? geoRedditTargetPickerSchema.parse(o.redditTargetPicker)
      : undefined,
    suggestions: normalizeGeoSuggestions(o.suggestions),
  };
}
