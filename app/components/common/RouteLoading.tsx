/**
 * Shared `loading.tsx` fallback for workspace routes.
 *
 * Having a loading boundary per route lets Next.js switch pages immediately on click
 * (and prefetch the fallback) instead of holding the old page until the server finishes.
 * The spinner fades in after a short delay so fast navigations don't flash it.
 */
export default function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] w-full flex-1 items-center justify-center">
      <span
        role="status"
        aria-label="Loading"
        className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--clipfox-primary)] border-t-transparent opacity-0"
        style={{ animation: 'spin 1s linear infinite, route-loading-in 150ms ease-out 200ms forwards' }}
      />
      <style>{'@keyframes route-loading-in { to { opacity: 1; } }'}</style>
    </div>
  );
}
