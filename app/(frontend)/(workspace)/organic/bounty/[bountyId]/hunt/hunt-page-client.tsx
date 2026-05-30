"use client";

import { useState, type ReactNode } from "react";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { HuntContentExplorer } from "@/app/components/geo/bounty/hunt-content-explorer";
import { ArticleActions } from "./articleActions";

type HuntPageClientProps = {
  bountyId: string;
  query: string;
  hasBlog: boolean;
  blogTitle?: string | null;
  blogChildren?: ReactNode;
};

export function HuntPageClient({
  bountyId,
  query,
  hasBlog,
  blogTitle,
  blogChildren,
}: HuntPageClientProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<BountySpreadPlatform>("WEBSITE_BLOG");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div className="pt-4 sm:pt-5">
        <ArticleActions
          bountyId={bountyId}
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          onPublished={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <div className="py-8 sm:py-10">
        <HuntContentExplorer
          key={refreshKey}
          bountyId={bountyId}
          query={query}
          hasBlog={hasBlog}
          blogTitle={blogTitle}
          activeTab={selectedPlatform}
          onTabChange={setSelectedPlatform}
          blogChildren={blogChildren}
        />
      </div>
    </>
  );
}
