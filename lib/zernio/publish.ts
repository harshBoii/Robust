import type { SocialProvider } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getZernioClient, zernioApiErrorMessage } from '@/lib/zernio/client';
import { toZernioPlatform } from '@/lib/zernio/platforms';
import type { PublishResult } from '@/lib/geo/bounty/publish/types';

function formatSocialContent(title: string | null | undefined, body: string, provider: SocialProvider): string {
  const trimmedBody = body.trim();
  const trimmedTitle = title?.trim();

  if (provider === 'LINKEDIN' && trimmedTitle) {
    return `${trimmedTitle}\n\n${trimmedBody}`.trim();
  }

  return trimmedBody;
}

export async function publishViaZernio(opts: {
  companyId: string;
  provider: SocialProvider;
  contentBody: string;
  title?: string | null;
  reddit?: { subreddit: string; flairId?: string };
}): Promise<PublishResult> {
  const integration = await prisma.socialIntegration.findUnique({
    where: {
      companyId_provider: { companyId: opts.companyId, provider: opts.provider },
    },
    select: { zernioAccountId: true },
  });

  if (!integration?.zernioAccountId?.trim()) {
    throw new Error(`${opts.provider} not connected — link your account under Profile → Integrations`);
  }

  const zernio = getZernioClient();
  const platform = toZernioPlatform(opts.provider);
  const content = formatSocialContent(opts.title, opts.contentBody, opts.provider);

  const platformSpecificData =
    opts.provider === 'REDDIT' && opts.reddit?.subreddit
      ? {
          subreddit: opts.reddit.subreddit,
          ...(opts.title?.trim() ? { title: opts.title.trim() } : {}),
          ...(opts.reddit.flairId ? { flairId: opts.reddit.flairId } : {}),
        }
      : undefined;

  const { data, error } = await zernio.posts.createPost({
    body: {
      content,
      ...(opts.provider === 'REDDIT' && opts.title?.trim() ? { title: opts.title.trim() } : {}),
      publishNow: true,
      platforms: [
        {
          platform,
          accountId: integration.zernioAccountId,
          ...(platformSpecificData ? { platformSpecificData } : {}),
        },
      ],
    },
  });

  if (error) {
    throw new Error(zernioApiErrorMessage(error) || `${opts.provider} publish failed`);
  }

  const post = data?.post;
  const platformResult = post?.platforms?.find(
    (p: { platform?: string; platformPostUrl?: string | null; platformPostId?: string | null }) =>
      p.platform === platform,
  );
  const publishedUrl =
    platformResult?.platformPostUrl ??
    post?.platformPostUrl ??
    null;
  const externalPostId =
    platformResult?.platformPostId ??
    post?._id ??
    null;

  return {
    publishedUrl: publishedUrl ?? null,
    externalPostId: externalPostId != null ? String(externalPostId) : null,
  };
}
