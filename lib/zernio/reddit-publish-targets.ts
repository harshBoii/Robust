import { getZernioClient, isZernioConfigured, zernioApiErrorMessage } from '@/lib/zernio/client';
import { prisma } from '@/lib/prisma';

export type RedditPublishTargetKind = 'profile' | 'subreddit';

export type RedditPublishTarget = {
  kind: RedditPublishTargetKind;
  /** Subreddit name without r/ prefix (e.g. learnprogramming or u_username for profile). */
  name: string;
  label: string;
  title?: string | null;
  over18?: boolean;
};

export type RedditFlairOption = {
  id: string;
  text: string;
};

export function normalizeRedditUsername(handle: string): string {
  return handle.trim().replace(/^u\//i, '').replace(/^@/, '');
}

/** Reddit profile posts use the u_username "subreddit". */
export function profileSubredditName(handle: string): string {
  const user = normalizeRedditUsername(handle);
  if (!user) return '';
  return user.toLowerCase().startsWith('u_') ? user : `u_${user}`;
}

function isProfileSubredditName(name: string, accountHandle: string | null): boolean {
  if (!accountHandle) return false;
  const profileName = profileSubredditName(accountHandle);
  return name.toLowerCase() === profileName.toLowerCase();
}

export async function getRedditIntegration(companyId: string) {
  return prisma.socialIntegration.findUnique({
    where: { companyId_provider: { companyId, provider: 'REDDIT' } },
    select: { zernioAccountId: true, accountHandle: true },
  });
}

export async function fetchRedditPublishTargets(companyId: string): Promise<{
  targets: RedditPublishTarget[];
  defaultSubreddit: string | null;
  accountHandle: string | null;
}> {
  if (!isZernioConfigured()) {
    throw new Error('Zernio is not configured (ZERNIO_API_KEY missing)');
  }

  const integration = await getRedditIntegration(companyId);
  const accountId = integration?.zernioAccountId?.trim();
  if (!integration || !accountId) {
    throw new Error('Reddit not connected — link your account under Profile → Integrations');
  }

  const zernio = getZernioClient();
  const { data, error } = await zernio.connect.getRedditSubreddits({
    path: { accountId },
  });

  if (error) {
    throw new Error(zernioApiErrorMessage(error) || 'Failed to load Reddit subreddits');
  }

  const accountHandle = integration.accountHandle ?? null;
  const defaultSubreddit = data?.defaultSubreddit?.trim() || null;
  const targets: RedditPublishTarget[] = [];
  const seen = new Set<string>();

  const addTarget = (target: RedditPublishTarget) => {
    const key = target.name.toLowerCase();
    if (!target.name || seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  if (accountHandle) {
    const profileName = profileSubredditName(accountHandle);
    if (profileName) {
      addTarget({
        kind: 'profile',
        name: profileName,
        label: `Your profile (u/${normalizeRedditUsername(accountHandle)})`,
      });
    }
  }

  for (const sub of data?.subreddits ?? []) {
    const name = sub.name?.trim();
    if (!name) continue;
    const kind: RedditPublishTargetKind = isProfileSubredditName(name, accountHandle)
      ? 'profile'
      : 'subreddit';
    const label =
      kind === 'profile' && accountHandle
        ? `Your profile (u/${normalizeRedditUsername(accountHandle)})`
        : sub.title?.trim()
          ? `r/${name} — ${sub.title}`
          : `r/${name}`;
    addTarget({
      kind,
      name,
      label,
      title: sub.title ?? null,
      over18: sub.over18,
    });
  }

  targets.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'profile' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return { targets, defaultSubreddit, accountHandle };
}

export async function fetchRedditFlairs(
  companyId: string,
  subreddit: string,
): Promise<RedditFlairOption[]> {
  if (!isZernioConfigured()) {
    throw new Error('Zernio is not configured (ZERNIO_API_KEY missing)');
  }

  const integration = await getRedditIntegration(companyId);
  const accountId = integration?.zernioAccountId?.trim();
  if (!accountId) {
    throw new Error('Reddit not connected');
  }

  const zernio = getZernioClient();
  const { data, error } = await zernio.connect.getRedditFlairs({
    path: { accountId },
    query: { subreddit },
  });

  if (error) {
    throw new Error(zernioApiErrorMessage(error) || 'Failed to load subreddit flairs');
  }

  return (data?.flairs ?? [])
    .filter((f): f is { id: string; text: string } => Boolean(f.id && f.text))
    .map((f) => ({ id: f.id!, text: f.text! }));
}
