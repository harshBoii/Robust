import { prisma } from '@/lib/prisma';
import {
  buildRelatedArticlesAppend,
  minimalMarkdownToHtml,
} from '@/lib/geo/bounty/markdownToHtmlForPublish';

/**
 * Pillar interlinking, shared by the Shopify and WordPress publishers.
 *
 * When a new page joins an existing topic cluster, the topic's oldest page (the pillar)
 * gets a "Related reading" link appended. The markdown is the source of truth and is
 * written back to `AeoPage.description`, so the two providers must not diverge here —
 * hence one implementation parameterized by how the remote body gets updated.
 */

export type PillarTarget = {
  /** AeoPage id of the pillar. */
  id: string;
  /** Provider-side identifier; null when the pillar was never published there. */
  externalId: string | null | undefined;
  /** Current markdown body of the pillar. */
  markdown: string;
};

export type PillarInterlinkOptions = {
  pillar: PillarTarget;
  /** AeoPage id of the article being published now. */
  currentAeoPageId: string;
  newArticleTitle: string;
  /** Absolute URL of the newly published article. */
  newArticleUrl: string | null | undefined;
  /** Push the regenerated HTML body back to the provider. */
  updateRemoteBody: (externalId: string, html: string) => Promise<void>;
  /** Prefix for warning logs, e.g. "[geo/approve-wordpress]". */
  logPrefix: string;
};

/**
 * Append a link to the new article onto the pillar page, remotely and locally.
 *
 * No-ops when the pillar was never published, when the new article has no URL, or when
 * the pillar *is* the article being published. Never throws: a failed interlink must not
 * fail the publish that already succeeded.
 */
export async function appendNewArticleLinkToPillar(
  opts: PillarInterlinkOptions,
): Promise<{ updated: boolean; reason?: string }> {
  const externalId = opts.pillar.externalId;
  const url = opts.newArticleUrl?.trim();

  if (!externalId) return { updated: false, reason: 'pillar not published' };
  if (!url) return { updated: false, reason: 'new article has no URL' };
  if (opts.pillar.id === opts.currentAeoPageId) {
    return { updated: false, reason: 'article is the pillar' };
  }

  const updatedMarkdown = buildRelatedArticlesAppend(opts.pillar.markdown, {
    title: opts.newArticleTitle,
    url,
  });

  try {
    await opts.updateRemoteBody(externalId, minimalMarkdownToHtml(updatedMarkdown));
  } catch (e) {
    console.warn(`${opts.logPrefix} pillar update failed`, e);
    return { updated: false, reason: 'remote update failed' };
  }

  await prisma.aeoPage.update({
    where: { id: opts.pillar.id },
    data: { description: updatedMarkdown },
  });

  return { updated: true };
}
