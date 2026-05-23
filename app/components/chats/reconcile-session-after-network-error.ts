import type { SerializedMessage, WorkflowState } from '@/lib/chats/types';

/** Subset returned by GET /api/chats/:id — matches ChatSessionData. */
export type ReconciledChatSession = {
  id: string;
  title: string;
  status: string;
  currentStep: string;
  workflowState: WorkflowState;
  bulkUploadId: string | null;
  campaignId: string | null;
  messages: SerializedMessage[];
};

/** Poll interval while recovering from a dropped POST (no extra UI). */
export const RECONCILE_POLL_MS = 3000;
/** Stop polling after this many milliseconds. */
export const RECONCILE_MAX_MS = 15000;

const IMAGE_RESULT_WIDGETS = new Set([
  'imageGenSingleResult',
  'imageGenTemplateGrid',
  'imageGenVariantGrid',
]);

export type ReconcileSnapshot = {
  messageCount: number;
  currentStep?: string;
  imageGenStep?: string;
  generatedAssetCount: number;
  templateOutputCount: number;
};

export function captureReconcileSnapshot(
  session: ReconciledChatSession | null,
  messages: SerializedMessage[],
): ReconcileSnapshot {
  const ig = session?.workflowState?.imageGen;
  return {
    messageCount: messages.length,
    currentStep: session?.currentStep,
    imageGenStep: ig?.step,
    generatedAssetCount: ig?.generatedAssets?.length ?? 0,
    templateOutputCount: ig?.templateOutputs?.length ?? 0,
  };
}

export function sessionProgressedSince(
  snapshot: ReconcileSnapshot,
  session: ReconciledChatSession,
): boolean {
  const msgs = session.messages ?? [];
  const ig = session.workflowState?.imageGen;

  if (msgs.length > snapshot.messageCount) return true;

  if (
    snapshot.currentStep !== undefined &&
    session.currentStep !== snapshot.currentStep
  ) {
    return true;
  }

  if (snapshot.imageGenStep !== undefined && ig?.step !== snapshot.imageGenStep) {
    return true;
  }

  if ((ig?.generatedAssets?.length ?? 0) > snapshot.generatedAssetCount) return true;
  if ((ig?.templateOutputs?.length ?? 0) > snapshot.templateOutputCount) return true;

  const tail = msgs.slice(snapshot.messageCount);
  if (
    tail.some(
      (m) => m.role === 'assistant' && IMAGE_RESULT_WIDGETS.has(m.widgetType ?? ''),
    )
  ) {
    return true;
  }

  return false;
}

export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  if (error.name === 'TypeError' && message.includes('fetch')) return true;
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed')
  );
}

/** Quietly poll GET session after a dropped POST; no extra loading UI. */
export async function reconcileSessionAfterNetworkError(
  sessionId: string,
  snapshot: ReconcileSnapshot,
): Promise<ReconciledChatSession | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= RECONCILE_MAX_MS) {
    try {
      const res = await fetch(`/api/chats/${sessionId}`, { credentials: 'include' });
      const data = (await res.json()) as { session?: ReconciledChatSession; error?: string };
      if (res.ok && data.session && sessionProgressedSince(snapshot, data.session)) {
        return data.session;
      }
    } catch {
      // Ignore transient poll failures.
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed + RECONCILE_POLL_MS > RECONCILE_MAX_MS) break;
    await new Promise((r) => setTimeout(r, RECONCILE_POLL_MS));
  }

  return null;
}
