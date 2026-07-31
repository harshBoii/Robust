import 'server-only';

import { WordPressJsonLdMode } from '@/app/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { syncBountyRevenueForCompany } from '@/lib/geo/radar/bountySync';
import { minimalMarkdownToHtml } from '@/lib/geo/bounty/markdownToHtmlForPublish';
import { appendNewArticleLinkToPillar } from '@/lib/geo/bounty/pillar-interlink';
import { topicChannelSlug } from '@/lib/geo/bounty/topic-slug';
import { ensureFreshProbe } from '@/lib/wordpress/capabilities';
import { requireWordPressContext } from '@/lib/wordpress/config';
import { WordPressApiError } from '@/lib/wordpress/errors';
import { attachJsonLd, buildArticleGraph, serializeGraph } from '@/lib/wordpress/jsonld';
import { createPost, postPermalink, updatePost, type WpPostInput } from '@/lib/wordpress/posts';
import { ensureCategory, ensureTags } from '@/lib/wordpress/taxonomy';
import { verifyPublishedSchema } from '@/lib/wordpress/verify';

const LOG_PREFIX = '[geo/approve-wordpress]';

export type ApproveWordPressResult = {
  postId: number | null;
  canonicalUrl: string | null;
  channelSlug: string;
  schemaMode: WordPressJsonLdMode;
  schemaAttached: boolean;
  schemaVerified: boolean | null;
  warnings: string[];
};

/**
 * Publish a bounty's generated page to the company's connected WordPress site.
 *
 * Structural mirror of `approveBountyToShopify`: resolve site → ensure the topic channel →
 * render body → create the post with schema attached → interlink the pillar → persist and
 * settle revenue. The differences are all in *how* schema is delivered, which is why the
 * mode is resolved by capability probe rather than assumed.
 */
export async function approveBountyToWordPress(opts: {
  companyId: string;
  bountyId: string;
  /** Override the published status; defaults to `publish`. */
  status?: WpPostInput['status'];
}): Promise<ApproveWordPressResult> {
  const warnings: string[] = [];

  const bounty = await prisma.citationBounty.findFirst({
    where: { id: opts.bountyId, companyId: opts.companyId },
    select: {
      id: true,
      query: true,
      pageType: true,
      generationContext: true,
      aeoPage: {
        select: {
          id: true,
          slug: true,
          locale: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          description: true,
          publishedAt: true,
          updatedAt: true,
          summary: true,
          facts: true,
          claims: true,
          faq: true,
          knowledgeGraph: true,
          llm_topic_id: true,
          llm_topic: { select: { name: true } },
          llm_prompt: { select: { topic: true, llmTopic: { select: { name: true } } } },
        },
      },
    },
  });

  if (!bounty || !bounty.aeoPage) {
    throw new Error('Bounty or generated page not found');
  }

  const aeoPage = bounty.aeoPage;
  const ctx = await requireWordPressContext(opts.companyId);

  // Refresh capability detection if the cached probe has aged out. Non-fatal by design:
  // a stale mode still publishes, it just may attach schema less optimally.
  await ensureFreshProbe(ctx);
  const site = await prisma.wordPressSite.findUniqueOrThrow({
    where: { id: ctx.siteId },
    select: { jsonLdMode: true, seoPlugin: true, defaultAuthorId: true },
  });

  const schemaMode = site.jsonLdMode;
  const seoPlugin =
    site.seoPlugin === 'yoast' || site.seoPlugin === 'rankmath' ? site.seoPlugin : null;

  // ── Channel (topic → category) ─────────────────────────────────────────────
  const rawTopicName =
    aeoPage.llm_topic?.name ??
    aeoPage.llm_prompt?.llmTopic?.name ??
    aeoPage.llm_prompt?.topic ??
    '';
  const channelSlug = topicChannelSlug(rawTopicName);

  let categoryId: number | null = null;
  try {
    const ensured = await ensureCategory(ctx, { slug: channelSlug, name: rawTopicName });
    categoryId = ensured.categoryId;
  } catch (e) {
    // Category assignment is desirable, not required — an uncategorized post still ranks.
    console.warn(`${LOG_PREFIX} ensureCategory failed`, e);
    warnings.push(
      `Could not assign the "${channelSlug}" category; the post was published uncategorized.`,
    );
  }

  const tagIds = await ensureTags(ctx, ['geo', 'bounty', channelSlug]).catch(() => []);

  // ── Body + SEO ─────────────────────────────────────────────────────────────
  const title = (aeoPage.seoTitle ?? aeoPage.title ?? bounty.query).trim();
  const html = minimalMarkdownToHtml(aeoPage.description ?? '');
  const seoDescription = (aeoPage.seoDescription ?? '').trim();

  // WordPress assigns the permalink, so the canonical URL is not known until after
  // creation. Build the graph against our best guess, then correct it post-create.
  const provisionalUrl =
    `${ctx.siteUrl.replace(/\/+$/, '')}/${aeoPage.slug}`.replace(/([^:]\/)\/+/g, '$1');

  const buildGraphFor = (canonicalUrl: string) =>
    buildArticleGraph({
      knowledgeGraph: aeoPage.knowledgeGraph,
      canonicalUrl,
      title,
      description: seoDescription,
      publishedAt: aeoPage.publishedAt,
      modifiedAt: aeoPage.updatedAt ?? new Date(),
      authorName: 'Ramappa Ramachandra',
      siteUrl: ctx.siteUrl,
      faq: aeoPage.faq,
    });

  const graph = buildGraphFor(provisionalUrl);
  const graphStr = serializeGraph(graph);
  if (!graphStr.ok) {
    throw new Error(`Invalid JSON-LD payload: ${graphStr.error}`);
  }

  // Mirror of the Shopify `custom.immortel_payload` metafield.
  const immortelPayload = {
    bountyId: bounty.id,
    query: bounty.query,
    pageType: bounty.pageType,
    aeoPage: {
      id: aeoPage.id,
      slug: aeoPage.slug,
      locale: aeoPage.locale,
      title: aeoPage.title,
      seoTitle: aeoPage.seoTitle,
      publishedAt: aeoPage.publishedAt?.toISOString() ?? null,
      summary: aeoPage.summary,
      facts: aeoPage.facts,
      claims: aeoPage.claims,
      faq: aeoPage.faq,
    },
    generationContext: bounty.generationContext,
  };
  const payloadStr = serializeGraph(immortelPayload);

  const attached = attachJsonLd({
    mode: schemaMode,
    graphJson: graphStr.value,
    payloadJson: payloadStr.ok ? payloadStr.value : null,
    content: html,
    seoTitle: aeoPage.seoTitle ?? title,
    seoDescription,
    seoPlugin,
  });
  if (attached.warning) warnings.push(attached.warning);

  // ── Create ─────────────────────────────────────────────────────────────────
  const input: WpPostInput = {
    title,
    content: html,
    slug: aeoPage.slug,
    status: opts.status ?? 'publish',
    ...(seoDescription ? { excerpt: seoDescription } : {}),
    ...(aeoPage.publishedAt ? { dateGmt: aeoPage.publishedAt.toISOString() } : {}),
    ...(categoryId ? { categories: [categoryId] } : {}),
    ...(tagIds.length ? { tags: tagIds } : {}),
    ...(site.defaultAuthorId ? { author: site.defaultAuthorId } : {}),
    ...attached.patch,
  };

  const post = await createPost(ctx, input);
  const permalink = postPermalink(post);

  // ── Correct the canonical URL inside the graph now that WP has assigned one ──
  let schemaVerified: boolean | null = null;
  if (permalink && attached.schemaAttached && permalink !== provisionalUrl) {
    const corrected = serializeGraph(buildGraphFor(permalink));
    if (corrected.ok) {
      const repatch = attachJsonLd({
        mode: schemaMode,
        graphJson: corrected.value,
        payloadJson: payloadStr.ok ? payloadStr.value : null,
        content: html,
        seoTitle: aeoPage.seoTitle ?? title,
        seoDescription,
        seoPlugin,
      });
      await updatePost(ctx, post.id, repatch.patch).catch((e) => {
        console.warn(`${LOG_PREFIX} canonical URL correction failed`, e);
        warnings.push('Published, but the schema canonical URL could not be corrected.');
      });
    }
  }

  // ── Verify schema actually rendered ────────────────────────────────────────
  if (permalink && attached.schemaAttached) {
    const verification = await verifyPublishedSchema(permalink, { marker: permalink });
    schemaVerified = verification.verified;
    if (!verification.verified) {
      const detail = verification.reason ? ` (${verification.reason})` : '';
      warnings.push(
        `Schema was sent but could not be confirmed on the live page${detail}. ` +
          (schemaMode === WordPressJsonLdMode.INLINE
            ? 'WordPress may have stripped the script tag — install the Immortel Schema Bridge plugin.'
            : ''),
      );
      await prisma.wordPressSite
        .update({
          where: { id: ctx.siteId },
          data: { lastError: `Schema verification failed: ${verification.reason ?? 'unknown'}` },
        })
        .catch(() => undefined);
    }
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  await prisma.aeoPage.update({
    where: { id: aeoPage.id },
    data: {
      ...(permalink ? { canonicalUrl: permalink.slice(0, 1000) } : {}),
      wordpressPostId: post.id,
      wordpressSiteId: ctx.siteId,
      ...(aeoPage.publishedAt ? {} : { publishedAt: new Date() }),
    },
  });

  // ── Pillar interlinking ────────────────────────────────────────────────────
  await interlinkPillar({
    companyId: opts.companyId,
    ctx,
    aeoPage: { id: aeoPage.id, topicId: aeoPage.llm_topic_id },
    newArticleTitle: title,
    newArticleUrl: permalink,
  });

  await prisma.citationBounty.update({
    where: { id: opts.bountyId },
    data: { publishedAt: new Date() },
  });
  await syncBountyRevenueForCompany(prisma, opts.companyId);

  return {
    postId: post.id,
    canonicalUrl: permalink,
    channelSlug,
    schemaMode,
    schemaAttached: attached.schemaAttached,
    schemaVerified,
    warnings,
  };
}

/** Find the topic's pillar page and append a link to the newly published article. */
async function interlinkPillar(opts: {
  companyId: string;
  ctx: Awaited<ReturnType<typeof requireWordPressContext>>;
  aeoPage: { id: string; topicId: string | null };
  newArticleTitle: string;
  newArticleUrl: string | null;
}): Promise<void> {
  if (!opts.aeoPage.topicId) return;

  const topicPageCount = await prisma.aeoPage.count({
    where: { companyId: opts.companyId, llm_topic_id: opts.aeoPage.topicId },
  });
  if (topicPageCount <= 1) return;

  const pillar = await prisma.aeoPage.findFirst({
    where: { companyId: opts.companyId, llm_topic_id: opts.aeoPage.topicId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, description: true, wordpressPostId: true },
  });
  if (!pillar) return;

  await appendNewArticleLinkToPillar({
    pillar: {
      id: pillar.id,
      externalId: pillar.wordpressPostId != null ? String(pillar.wordpressPostId) : null,
      markdown: pillar.description ?? '',
    },
    currentAeoPageId: opts.aeoPage.id,
    newArticleTitle: opts.newArticleTitle,
    newArticleUrl: opts.newArticleUrl,
    logPrefix: LOG_PREFIX,
    updateRemoteBody: async (externalId, html) => {
      const postId = Number.parseInt(externalId, 10);
      if (!Number.isFinite(postId)) throw new WordPressApiError('WP_NOT_FOUND');
      await updatePost(opts.ctx, postId, { content: html });
    },
  });
}
