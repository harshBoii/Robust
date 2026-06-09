export default function RivalAnalysisLoading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="inline-block h-12 w-12 animate-spin rounded-full border-[3px] border-[var(--clipfox-primary)] border-t-transparent"
          role="status"
          aria-label="Loading rival analysis"
        />
        <p className="text-sm text-muted-foreground">Loading rival analysis…</p>
      </div>
    </div>
  );
}
