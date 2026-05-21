import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { handleChatAction } from '@/lib/chats/orchestrator';
import type { ChatActionType } from '@/lib/chats/types';

export const dynamic = 'force-dynamic';

const ACTIONS: ChatActionType[] = [
  'intent.ack',
  'media.source',
  'media.uploaded',
  'media.analyzed',
  'media.galleryPicked',
  'campaign.choice',
  'pixel.answered',
  'campaign.objectivePicked',
  'campaign.selected',
  'campaign.presetUpdated',
  'campaign.approved',
  'adset.choice',
  'adset.selected',
  'adset.presetUpdated',
  'adset.approved',
  'creative.mode',
  'creative.csvParsed',
  'creative.aiDone',
  'preview.approved',
  'preview.changes',
  'publish.submit',
  'workflow.goBack',
  'imageGen.source',
  'imageGen.shopifySelected',
  'imageGen.uploaded',
  'imageGen.artistSettings',
  'imageGen.variantSource',
  'imageGen.existingAdSelected',
  'imageGen.baseAccepted',
  'imageGen.baseRejected',
  'imageGen.nextStepChosen',
  'imageGen.ideasAccepted',
  'imageGen.ideasChanged',
  'imageGen.variantRegenerate',
  'imageGen.modelSelected',
  'imageGen.backgroundSelected',
  'imageGen.poseSelected',
  'imageGen.onModelAccepted',
  'imageGen.onModelRejected',
  'imageGen.pushToAds',
];

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  let body: { action?: unknown; payload?: unknown; userMessage?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; payload?: unknown; userMessage?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action as ChatActionType;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  const userMessage =
    typeof body.userMessage === 'string' && body.userMessage.trim()
      ? body.userMessage.trim()
      : undefined;

  try {
    const result = await handleChatAction(id, session.companyId, action, payload, userMessage);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[chats/actions]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
