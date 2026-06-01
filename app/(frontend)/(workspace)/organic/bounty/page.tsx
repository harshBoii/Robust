import { getSession } from "@/lib/auth/session";
import { BountyView } from "@/app/components/geo/bounty";
import { loadBountyWorkspaceData } from "@/lib/geo/bounty/loadBountyWorkspaceData";

export default async function BountyPage() {
  const session = await getSession();
  const companyId = session?.companyId ?? null;

  if (!companyId) {
    return (
      <div className="w-full min-h-[60vh] px-6 pb-6 pt-2">
        <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)] p-6 text-sm text-muted-foreground">
          Sign in as a company user to view Bounty.
        </div>
      </div>
    );
  }

  const { niches, summary } = await loadBountyWorkspaceData(companyId);

  return (
    <div className="w-full min-h-[60vh] pb-6 pt-2">
      <BountyView initialNiches={niches} summary={summary} />
    </div>
  );
}
