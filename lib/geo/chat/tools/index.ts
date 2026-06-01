import 'server-only';

import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { loadOrganicHomeData } from '@/lib/organic/home/loadOrganicHomeData';
import { loadGeoKnightTopicViews } from '@/lib/geo/geoknight/loadGeoKnightTopicViews';
import { loadBountyWorkspaceData } from '@/lib/geo/bounty/loadBountyWorkspaceData';
import { loadBountyPagesData } from '@/lib/geo/bounty/loadBountyPagesData';
import { runGetCitedForCompany } from '@/lib/geo/bounty/runGetCitedForCompany';
import { getPublishTargetsForBounty } from '@/lib/geo/bounty/getPublishTargets';
import { publishBountyContent } from '@/lib/geo/bounty/publish';
import { parseSpreadPlatforms } from '@/lib/geo/bounty/spread-platforms';
import { fetchRedditPublishTargets } from '@/lib/zernio/reddit-publish-targets';

import type { GeoToolCall } from '../geo-agent-schema';
import type { GeoChatState, GeoToolContext, GeoToolResult } from '../types';
import {
  summarizeBounty,
  summarizeBountyPages,
  summarizeDashboard,
  summarizeGeoKnight,
} from './summarize';

export async function executeGeoTool(
  call: GeoToolCall,
  ctx: GeoToolContext,
): Promise<{ result: GeoToolResult; statePatch: Partial<GeoChatState> }> {
  const args = call.args ?? {};
  let statePatch: Partial<GeoChatState> = { lastToolSummary: call.name };

  try {
    switch (call.name) {
      case 'geo.fetch_dashboard': {
        const data = await loadOrganicHomeData(ctx.companyId);
        return {
          result: { ok: true, data: summarizeDashboard(data) },
          statePatch,
        };
      }

      case 'geo.fetch_geoknight': {
        const data = await loadGeoKnightTopicViews(ctx.companyId);
        const topicId = typeof args.topicId === 'string' ? args.topicId : undefined;
        const difficulty = typeof args.difficulty === 'string' ? args.difficulty : undefined;
        const limit = typeof args.limit === 'number' ? args.limit : undefined;
        return {
          result: {
            ok: true,
            data: summarizeGeoKnight(data, { topicId, difficulty, limit }),
          },
          statePatch,
        };
      }

      case 'geo.fetch_bounty': {
        const data = await loadBountyWorkspaceData(ctx.companyId);
        return {
          result: { ok: true, data: summarizeBounty(data) },
          statePatch,
        };
      }

      case 'geo.fetch_bounty_pages': {
        const bounties = await loadBountyPagesData(ctx.companyId);
        return {
          result: { ok: true, data: summarizeBountyPages(bounties) },
          statePatch,
        };
      }

      case 'geo.get_cited': {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) {
          return {
            result: { ok: false, error: 'query is required' },
            statePatch,
          };
        }
        const platforms = parseSpreadPlatforms(args.platforms);
        if (platforms.length === 0) {
          return {
            result: { ok: false, error: 'At least one platform is required' },
            statePatch,
          };
        }
        const promptId =
          typeof args.promptId === 'string' && args.promptId.trim() ? args.promptId.trim() : null;
        const out = await runGetCitedForCompany({
          companyId: ctx.companyId,
          query,
          platforms,
          promptId,
        });
        statePatch = { ...statePatch, lastBountyId: out.bountyId };
        return {
          result: { ok: out.success, data: out },
          statePatch,
        };
      }

      case 'geo.get_publish_targets': {
        const bountyId =
          typeof args.bountyId === 'string'
            ? args.bountyId
            : ctx.geo.lastBountyId ?? ctx.geo.pendingPublish?.bountyId;
        if (!bountyId) {
          return { result: { ok: false, error: 'bountyId is required' }, statePatch };
        }
        const data = await getPublishTargetsForBounty(ctx.companyId, bountyId);
        if (!data) {
          return { result: { ok: false, error: 'Bounty not found' }, statePatch };
        }
        return { result: { ok: true, data }, statePatch: { ...statePatch, lastBountyId: bountyId } };
      }

      case 'geo.fetch_reddit_targets': {
        try {
          const data = await fetchRedditPublishTargets(ctx.companyId);
          return {
            result: {
              ok: true,
              data: {
                targets: data.targets.map((t) => ({
                  kind: t.kind,
                  name: t.name,
                  label: t.label,
                  over18: t.over18 ?? false,
                })),
                defaultSubreddit: data.defaultSubreddit,
                accountHandle: data.accountHandle,
                note: 'User must select a community via the in-chat Reddit picker before publish.',
              },
            },
            statePatch,
          };
        } catch (err) {
          return {
            result: {
              ok: false,
              error: err instanceof Error ? err.message : 'Failed to load Reddit targets',
            },
            statePatch,
          };
        }
      }

      case 'geo.publish_content': {
        if (!ctx.geo.pendingPublish?.confirmed) {
          return {
            result: {
              ok: false,
              error:
                'Publish not confirmed. Ask the user to confirm before calling geo.publish_content.',
            },
            statePatch,
          };
        }

        const bountyId =
          typeof args.bountyId === 'string'
            ? args.bountyId
            : ctx.geo.pendingPublish.bountyId;
        const approveAll = args.approveAll === true || ctx.geo.pendingPublish.approveAll === true;

        if (approveAll) {
          const contents = await prisma.bountyContent.findMany({
            where: {
              bountyId,
              companyId: ctx.companyId,
              status: { in: ['DRAFT', 'APPROVED', 'FAILED'] },
            },
            select: { id: true, platform: true, status: true },
          });

          const results: Array<Record<string, unknown>> = [];
          for (const content of contents) {
            if (content.status === 'PUBLISHED') continue;
            try {
              const result = await publishBountyContent({
                companyId: ctx.companyId,
                bountyId,
                platform: content.platform,
                contentId: content.id,
                reddit:
                  content.platform === 'REDDIT'
                    ? resolveRedditOpts(args, ctx.geo)
                    : undefined,
              });
              results.push({ platform: content.platform, success: true, ...result });
            } catch (err) {
              results.push({
                platform: content.platform,
                success: false,
                error: err instanceof Error ? err.message : 'Publish failed',
              });
            }
          }

          const blogPlatform = ctx.geo.pendingPublish.platforms?.includes('WEBSITE_BLOG');
          if (blogPlatform) {
            try {
              const result = await publishBountyContent({
                companyId: ctx.companyId,
                bountyId,
                platform: 'WEBSITE_BLOG',
              });
              results.push({ platform: 'WEBSITE_BLOG', success: true, ...result });
            } catch (err) {
              results.push({
                platform: 'WEBSITE_BLOG',
                success: false,
                error: err instanceof Error ? err.message : 'Publish failed',
              });
            }
          }

          statePatch = {
            ...statePatch,
            pendingPublish: undefined,
            lastBountyId: bountyId,
          };
          return {
            result: {
              ok: results.some((r) => r.success === true),
              data: { results },
            },
            statePatch,
          };
        }

        const platform =
          typeof args.platform === 'string'
            ? (args.platform as BountySpreadPlatform)
            : ctx.geo.pendingPublish.platforms?.[0];
        if (!platform) {
          return { result: { ok: false, error: 'platform is required' }, statePatch };
        }

        const valid = parseSpreadPlatforms([platform]);
        const resolved = valid[0];
        if (!resolved) {
          return { result: { ok: false, error: 'Invalid platform' }, statePatch };
        }

        if (resolved === 'REDDIT') {
          const sub =
            (typeof args.redditSubreddit === 'string' ? args.redditSubreddit.trim() : '') ||
            ctx.geo.pendingPublish?.redditSubreddit?.trim() ||
            '';
          if (!sub) {
            return {
              result: {
                ok: false,
                error:
                  'Reddit subreddit not selected. Show redditTargetPicker in chat and wait for the user to pick a community.',
              },
              statePatch,
            };
          }
        }

        const contentId =
          typeof args.contentId === 'string'
            ? args.contentId
            : ctx.geo.pendingPublish.contentId;

        const result = await publishBountyContent({
          companyId: ctx.companyId,
          bountyId,
          platform: resolved,
          contentId,
          reddit: resolved === 'REDDIT' ? resolveRedditOpts(args, ctx.geo) : undefined,
        });

        statePatch = {
          ...statePatch,
          pendingPublish: undefined,
          lastBountyId: bountyId,
        };
        return { result: { ok: true, data: result }, statePatch };
      }

      default:
        return { result: { ok: false, error: `Unknown tool: ${call.name}` }, statePatch };
    }
  } catch (err) {
    return {
      result: {
        ok: false,
        error: err instanceof Error ? err.message : 'Tool execution failed',
      },
      statePatch,
    };
  }
}

function resolveRedditOpts(
  args: Record<string, unknown>,
  geo: GeoChatState,
): { subreddit: string; flairId?: string } | undefined {
  const sub =
    (typeof args.redditSubreddit === 'string' ? args.redditSubreddit.trim() : '') ||
    geo.pendingPublish?.redditSubreddit?.trim() ||
    '';
  if (!sub) return undefined;
  const flair =
    (typeof args.redditFlairId === 'string' ? args.redditFlairId.trim() : '') ||
    geo.pendingPublish?.redditFlairId ||
    undefined;
  return { subreddit: sub, flairId: flair };
}
