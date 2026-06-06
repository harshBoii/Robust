import 'server-only';

import { prisma } from '@/lib/prisma';
import { enqueueGoogleBulkPublish } from '@/lib/google-ads/process-publish-jobs';
import {
  appendChatMessages,
  updateChatSession,
  type DbChatSession,
} from './repository';
import { parseWorkflowState, serializeMessage, serializeSession } from './serialize';
import type {
  ChatActionType,
  ChatWorkflowStep,
  OrchestratorResult,
  SerializedMessage,
  WidgetType,
  WorkflowState,
} from './types';

async function assistantMsg(
  sessionId: string,
  content: string,
  widgetType?: WidgetType | null,
  widgetPayload?: unknown,
): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [
    {
      role: 'ASSISTANT',
      content,
      widgetType: widgetType ?? null,
      widgetPayload,
    },
  ]);
  return serializeMessage(row);
}

async function persistSession(
  session: DbChatSession,
  step: ChatWorkflowStep,
  state: WorkflowState,
  extra?: { campaignId?: string | null },
) {
  await updateChatSession(session.id, session.companyId, {
    currentStep: step,
    workflowState: state,
    ...extra,
  });
}

function packageResult(
  session: DbChatSession,
  nextStep: ChatWorkflowStep,
  nextState: WorkflowState,
  newMessages: SerializedMessage[],
): OrchestratorResult {
  const serialized = serializeSession(session);
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: nextStep,
      workflowState: nextState,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
  };
}

export async function handleGoogleChatAction(input: {
  sessionId: string;
  companyId: string;
  session: DbChatSession;
  action: ChatActionType;
  payload: Record<string, unknown>;
  userMessage?: string | null;
  options?: { silent?: boolean };
  state: WorkflowState;
  newMessages: SerializedMessage[];
  nextStep: ChatWorkflowStep;
  nextState: WorkflowState;
}): Promise<OrchestratorResult> {
  const {
    sessionId,
    companyId,
    session,
    action,
    payload,
    options,
  } = input;

  const newMessages: SerializedMessage[] = [];
  let nextStep = input.nextStep;
  let nextState = { ...input.nextState };

  const silent = options?.silent === true;
  const say = async (
    content: string,
    widgetType?: WidgetType | null,
    widgetPayload?: unknown,
  ) => {
    if (silent) return;
    newMessages.push(await assistantMsg(sessionId, content, widgetType ?? undefined, widgetPayload));
  };

  switch (action) {
    case 'platform.selected': {
      const platform = payload.platform as 'meta' | 'google';
      nextState.platform = platform;
      if (platform === 'google') {
        nextStep = 'googleCampaignType';
        await say(
          "Great — Google Ads it is! Which campaign type would you like to run?",
          'googleCampaignType',
          { campaignTypes: ['SEARCH', 'DISPLAY', 'PERFORMANCE_MAX'] },
        );
      } else {
        nextStep = 'mediaSource';
        nextState.platform = 'meta';
        await say("Let's set up your Meta ad. How would you like to add your creatives?", 'mediaSource');
      }
      break;
    }

    case 'google.campaignTypeSelected': {
      const campaignType = payload.campaignType as string;
      nextState.googleCampaignType = campaignType as WorkflowState['googleCampaignType'];
      nextStep = 'mediaSource';

      const labels: Record<string, string> = {
        SEARCH: 'Search (text ads in Google results)',
        DISPLAY: 'Display (image ads across the web)',
        PERFORMANCE_MAX: 'Performance Max (AI-optimised across all channels)',
      };
      await say(
        `${labels[campaignType] ?? campaignType} selected. Now let's add your creatives — how would you like to upload them?`,
        'mediaSource',
      );
      break;
    }

    case 'google.campaignSelected': {
      const campaignId = typeof payload.campaignId === 'string' ? payload.campaignId : '';
      nextState.googleCampaignId = campaignId;

      if (nextState.googleCampaignType === 'PERFORMANCE_MAX') {
        nextStep = 'googleCreative';
        await say(
          'Campaign selected. Now set up your creative assets — add headlines, descriptions, and a final URL.',
          'googleCreativeForm',
          { campaignType: nextState.googleCampaignType },
        );
      } else {
        nextStep = 'adsetChoice';
        await say(
          'Campaign set. Now pick or create an Ad Group.',
          'adsetChoice',
          { platform: 'google' },
        );
      }
      break;
    }

    case 'google.adGroupSelected': {
      const adGroupId = typeof payload.adGroupId === 'string' ? payload.adGroupId : '';
      nextState.googleAdGroupId = adGroupId;
      nextStep = 'googleCreative';
      await say(
        `Ad group set. Now let's write your ${nextState.googleCampaignType === 'SEARCH' ? 'Responsive Search Ad' : 'Responsive Display Ad'} copy.`,
        'googleCreativeForm',
        { campaignType: nextState.googleCampaignType },
      );
      break;
    }

    case 'google.creativeSubmitted': {
      const headlines = Array.isArray(payload.headlines) ? payload.headlines as string[] : [];
      const descriptions = Array.isArray(payload.descriptions) ? payload.descriptions as string[] : [];
      const finalUrl = typeof payload.finalUrl === 'string' ? payload.finalUrl : '';
      const longHeadline = typeof payload.longHeadline === 'string' ? payload.longHeadline : undefined;
      const businessName = typeof payload.businessName === 'string' ? payload.businessName : undefined;

      // Persist creative to DB
      const integration = await prisma.googleAdsIntegration.findUnique({
        where: { companyId },
        select: { id: true },
      });

      if (integration) {
        const creative = await prisma.googleCreative.create({
          data: {
            googleAdsIntegrationId: integration.id,
            campaignId: nextState.googleCampaignId ?? null,
            adType: nextState.googleCampaignType === 'SEARCH'
              ? 'RESPONSIVE_SEARCH'
              : nextState.googleCampaignType === 'DISPLAY'
                ? 'RESPONSIVE_DISPLAY'
                : 'RESPONSIVE_SEARCH',
            headlines,
            descriptions,
            longHeadline: longHeadline ?? null,
            businessName: businessName ?? null,
            finalUrl: finalUrl || null,
          },
          select: { id: true },
        });
        nextState = { ...nextState, googleCreativeDbId: creative.id } as typeof nextState & { googleCreativeDbId?: string };
      }

      nextStep = 'preview';
      await say(
        'Creative ready — here is your preview. Approve to publish or request changes.',
        'adPreview',
        {
          platform: 'google',
          campaignType: nextState.googleCampaignType,
          headlines,
          descriptions,
          longHeadline,
          businessName,
          finalUrl,
        },
      );
      break;
    }

    case 'google.publish.submit': {
      const scheduledAt = typeof payload.scheduledAt === 'string' ? payload.scheduledAt : null;

      const integration = await prisma.googleAdsIntegration.findUnique({
        where: { companyId },
        select: { id: true },
      });
      if (!integration) {
        await say('Google Ads is not connected. Please connect it in Integration Settings first.');
        break;
      }

      const campaignId = nextState.googleCampaignId;
      if (!campaignId) {
        await say('No campaign selected. Please go back and select a campaign.');
        break;
      }

      const campaign = await prisma.googleCampaign.findUnique({
        where: { id: campaignId },
        select: { campaignType: true },
      });

      const googleCreativeDbId = (nextState as typeof nextState & { googleCreativeDbId?: string }).googleCreativeDbId;

      const jobIds = await enqueueGoogleBulkPublish({
        companyId,
        googleAdsIntegrationId: integration.id,
        campaignId,
        campaignType: campaign?.campaignType ?? nextState.googleCampaignType ?? 'DISPLAY',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        groups: [
          {
            assetIds: nextState.assetIds ?? [],
            adGroupId: nextState.googleAdGroupId,
            googleCreativeDbId,
          },
        ],
      });

      nextState.googlePublishJobIds = jobIds;
      nextStep = 'done';

      // Trigger worker
      void fetch('/api/internal/worker/publish-jobs?platform=google', {
        method: 'POST',
      }).catch(() => null);

      await say(
        `Your Google ${campaign?.campaignType ?? 'ad'} is queued for publishing — ${jobIds.length} job${jobIds.length > 1 ? 's' : ''} created. You can track progress in Ad History.`,
        'publishSchedule',
        { platform: 'google', jobIds },
      );
      break;
    }
  }

  await persistSession(session, nextStep, nextState);

  const updated = await prisma.adChatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return packageResult(
    updated as unknown as DbChatSession ?? session,
    nextStep,
    nextState,
    newMessages,
  );
}
