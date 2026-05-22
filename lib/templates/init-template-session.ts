import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  appendChatMessages,
  createChatSession,
  getChatSession,
  updateChatSession,
} from '@/lib/chats/repository';
import { serializeMessage } from '@/lib/chats/serialize';
import type { SerializedMessage } from '@/lib/chats/types';
import { initialImageGenState, mergeImageGenIntoWorkflow } from '@/lib/image-gen/state';

import { getTemplateById } from './catalog';

const IMAGE_GEN_STEP = 'imageGen';

function buildIntroMessage(name: string, capabilityBlurb: string): string {
  return [
    `Hi — you're using **${name}**.`,
    '',
    capabilityBlurb,
    '',
    '**What I need:** your image (required).',
    '**Optional:** any extra details in chat after you upload — background color, mood, crop focus, etc.',
    '',
    'Upload your image below to get started.',
  ].join('\n');
}

export async function initTemplateSession(input: {
  companyId: string;
  createdByUserId?: string | null;
  templateId: string;
}): Promise<{ sessionId: string; messages: SerializedMessage[] }> {
  const def = getTemplateById(input.templateId);
  if (!def) throw new Error(`Unknown template: ${input.templateId}`);

  const created = await createChatSession({
    companyId: input.companyId,
    createdByUserId: input.createdByUserId,
    title: def.name,
  });

  let ig = initialImageGenState('templates');
  ig.templateId = def.id;
  ig.step = 'templateUpload';

  const workflowState = mergeImageGenIntoWorkflow({}, ig);
  await updateChatSession(created.id, input.companyId, {
    pathType: 'IMAGE_GEN',
    currentStep: IMAGE_GEN_STEP,
    workflowState,
  });

  const welcomeId = created.messages?.[0]?.id;
  if (welcomeId) {
    await prisma.adChatMessage.delete({ where: { id: welcomeId } });
  }

  const introRows = await appendChatMessages(created.id, [
    {
      role: 'ASSISTANT',
      content: buildIntroMessage(def.name, def.capabilityBlurb),
      widgetType: 'imageGenUpload',
      widgetPayload: { mode: 'template', templateId: def.id },
    },
  ]);

  const updated = await getChatSession(created.id, input.companyId);
  const messages = (updated?.messages ?? []).map(serializeMessage);
  const intro = serializeMessage(introRows[0]);
  if (!messages.some((m) => m.id === intro.id)) {
    messages.push(intro);
  }

  return { sessionId: created.id, messages };
}
