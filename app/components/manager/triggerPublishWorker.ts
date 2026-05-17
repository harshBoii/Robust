export type ProcessedPublishJob = {
  id: string;
  status: string;
  error?: string;
};

export type PublishWorkerResult = {
  processed: ProcessedPublishJob[];
};

export function formatPublishWorkerErrors(processed: ProcessedPublishJob[]): string | null {
  const failures = processed.filter(
    (p) => p.status === 'FAILED' || (p.error && p.status !== 'PUBLISHED'),
  );
  if (failures.length === 0) return null;
  return failures.map((p) => `${p.id.slice(0, 8)}…: ${p.error ?? p.status}`).join('\n');
}

export async function triggerPublishWorker(limit = 10): Promise<PublishWorkerResult> {
  const res = await fetch(`/api/internal/worker/publish-jobs?limit=${limit}`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = (await res.json()) as PublishWorkerResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to process publish queue');
  }
  return { processed: data.processed ?? [] };
}
