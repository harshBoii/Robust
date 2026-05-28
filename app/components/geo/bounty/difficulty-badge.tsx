"use client";

type DifficultyBadgeProps = {
  difficulty: string;
};

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const d = (difficulty ?? "").toLowerCase();

  if (d === "easy") {
    return (
      <span className="inline-flex items-center rounded border border-[var(--success)]/30 bg-[var(--success)]/15 px-2.5 py-1 text-xs font-medium text-[var(--success)]">
        Low Gap
      </span>
    );
  }

  if (d === "hard") {
    return (
      <span className="inline-flex items-center rounded border border-destructive/30 bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
        High Gap
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-2.5 py-1 text-xs font-medium text-[var(--warning)]">
      High Gap
    </span>
  );
}
