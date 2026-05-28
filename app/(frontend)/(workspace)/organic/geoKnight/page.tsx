import { getSession } from '@/lib/auth/session';
import { loadGeoKnightTopicViews } from '@/lib/geo/geoknight/loadGeoKnightTopicViews';
import GeoKnightClient from './client';

export default async function GeoKnightPage() {
  const session = await getSession();
  const companyId = session?.companyId ?? null;

  if (!companyId) {
    return (
      <div className="w-full min-h-[60vh] px-6 pb-6 pt-2">
        <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)] p-6 text-sm text-muted-foreground">
          Sign in as a company user to view GeoKnight.
        </div>
      </div>
    );
  }

  const { companyName, topicViews, rivals } = await loadGeoKnightTopicViews(companyId);

  return (
    <GeoKnightClient topics={topicViews} companyName={companyName} rivals={rivals} />
  );
}
