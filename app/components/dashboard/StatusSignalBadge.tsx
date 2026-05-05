type StatusSignal = 'WINNER' | 'FATIGUE' | 'UNDERPERFORMER' | null | undefined;

export default function StatusSignalBadge({
  signal,
}: {
  signal: StatusSignal;
}) {
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide';

  if (signal === 'WINNER') {
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-600 dark:text-emerald-300`}>
        Winner
      </span>
    );
  }
  if (signal === 'FATIGUE') {
    return (
      <span className={`${base} bg-muted text-muted-foreground`}>
        Slow
      </span>
    );
  }
  if (signal === 'UNDERPERFORMER') {
    return (
      <span className={`${base} bg-red-500/15 text-red-700 dark:text-red-300`}>
        Underperformer
      </span>
    );
  }

  return (
    <span className={`${base} bg-yellow-500/15 text-yellow-700 dark:text-yellow-300`}>
      None
    </span>
  );
}

