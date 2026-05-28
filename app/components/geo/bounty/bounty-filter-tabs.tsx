"use client";

export type BountyFilterTab = "all" | "easy" | "medium" | "hard";

type BountyFilterTabsProps = {
  activeTab: BountyFilterTab;
  onTabChange: (tab: BountyFilterTab) => void;
  counts: { all: number; easy: number; medium: number; hard: number };
};

export function BountyFilterTabs({
  activeTab,
  onTabChange,
  counts,
}: BountyFilterTabsProps) {
  const tabs: { id: BountyFilterTab; label: string; count: number }[] = [
    { id: "all", label: "ALL", count: counts.all },
    { id: "easy", label: "EASY", count: counts.easy },
    { id: "medium", label: "MEDIUM", count: counts.medium },
    { id: "hard", label: "HARD", count: counts.hard },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={
              isActive
                ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                : "rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)]"
            }
          >
            {tab.label} {tab.count}
          </button>
        );
      })}
    </div>
  );
}
