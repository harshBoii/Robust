import 'server-only';

import { getIntelligenceResultsForAssets } from '@/lib/asset-intelligence/intelligence-results';
import { startHeygenFromChat } from '@/lib/heygen/start-from-chat';
import { syncHeygenJob } from '@/lib/heygen/sync-job';
import { prisma } from '@/lib/prisma';
import {
  appendChatMessages,
  getChatSession,
  updateChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { shouldSkipActionUserBubble } from '@/lib/chats/user-message-policy';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type { OrchestratorResult, SerializedMessage, WorkflowState } from '@/lib/chats/types';

import { classifyChangeIntent, intentCategory, intentDuration } from './classify-change-intent';
import { classifyDuration } from './classify-duration';
import { classifyVideoGenSubpath } from './classify-subpath';
import { generateVideoScript } from './generate-script';
import { applyOfferingToContext, loadCompanyContext } from './load-company-context';
import {
  runSingleAssetIntelligence,
  runTopAdsIntelligencePipeline,
} from './run-top-ads-intelligence';
import {
  initialVideoGenState,
  mergeVideoGenIntoWorkflow,
  parseVideoGenState,
  sanitizeWorkflowStateForClient,
} from './state';
import type {
  VideoGenActionType,
  VideoGenAdCategory,
  VideoGenState,
  VideoGenSubpath,
  VideoGenWidgetType,
} from './types';
import { VIDEO_GEN_AD_CATEGORIES } from './types';

const VIDEO_GEN_STEP = 'videoGen';

function getVg(state: WorkflowState): VideoGenState {
  return (
    parseVideoGenState(state) ??
    initialVideoGenState('mrAdicasso')
  );
}

async function assistantMsg(
  sessionId: string,
  content: string,
  widgetType?: VideoGenWidgetType | null,
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

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

function packageResult(
  session: DbChatSession,
  workflowState: WorkflowState,
  newMessages: SerializedMessage[],
): OrchestratorResult {
  const safeState = sanitizeWorkflowStateForClient(workflowState);
  const serialized = serializeSession({ ...session, workflowState: safeState });
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: VIDEO_GEN_STEP as OrchestratorResult['session']['currentStep'],
      workflowState: safeState,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
    operationError: workflowState.lastOperationError ?? null,
  };
}

async function persist(
  session: DbChatSession,
  workflowState: WorkflowState,
): Promise<DbChatSession> {
  await updateChatSession(session.id, session.companyId, {
    currentStep: VIDEO_GEN_STEP,
    pathType: 'VIDEO_GEN',
    workflowState,
  });
  return { ...session, workflowState, currentStep: VIDEO_GEN_STEP };
}

async function runScriptGeneration(
  session: DbChatSession,
  vg: VideoGenState,
  newMessages: SerializedMessage[],
  opts?: { changeFeedback?: string },
): Promise<VideoGenState> {
  vg.step = 'generatingScript';
  vg.lastError = null;
  newMessages.push(
    await assistantMsg(
      session.id,
      'Writing your ad script…',
      'videoGenGenerating',
      { step: 'generatingScript' },
    ),
  );

  try {
    let intelligenceBrief = vg.intelligenceBrief ?? null;
    if (vg.subpath === 'replicate' && vg.replicateAssetId && !intelligenceBrief) {
      const rows = await getIntelligenceResultsForAssets(session.companyId, [
        vg.replicateAssetId,
      ]);
      const intel = rows[0]?.intelligence;
      if (intel) {
        intelligenceBrief = JSON.stringify(intel, null, 2);
        vg.intelligenceBrief = intelligenceBrief;
      }
    }

    const generated = await generateVideoScript({
      companyContext: vg.companyContext,
      intelligenceBrief,
      replicateMode: vg.subpath === 'replicate',
      adCategory: vg.adCategory,
      trendTopic: vg.trendTopic,
      durationBucket: vg.durationBucket,
      changeFeedback: opts?.changeFeedback,
    });

    vg.adScript = generated.adScript;
    vg.directorPrompt = generated.directorPrompt;
    vg.step = 'reviewScript';

    newMessages.push(
      await assistantMsg(
        session.id,
        `Here's your ad script:\n\n${generated.adScript}\n\nReview it below. When you're happy, approve to start video generation.`,
        'videoGenScriptReview',
        { adScript: generated.adScript },
      ),
    );
  } catch (e) {
    vg.lastError = e instanceof Error ? e.message : 'Script generation failed';
    newMessages.push(
      await assistantMsg(
        session.id,
        `I couldn't generate the script: ${vg.lastError}. Try again or describe what you'd like differently.`,
      ),
    );
    vg.step = vg.subpath === 'mrAdicasso' ? 'durationInput' : 'reviewScript';
  }

  return vg;
}

async function beginMrAdicasso(
  session: DbChatSession,
  vg: VideoGenState,
  newMessages: SerializedMessage[],
): Promise<VideoGenState> {
  vg.companyContext = await loadCompanyContext(session.companyId);
  const offerings = vg.companyContext.offerings;

  if (offerings.length > 1) {
    vg.step = 'offeringPick';
    newMessages.push(
      await assistantMsg(
        session.id,
        'Mr. Adicasso is ready. Which offering should this video ad promote?',
        'videoGenOfferingPicker',
        { offerings },
      ),
    );
    return vg;
  }

  if (offerings.length === 1) {
    vg.offeringId = offerings[0].id;
    vg.companyContext = applyOfferingToContext(vg.companyContext, offerings[0].id);
  }

  vg.step = 'adTypePick';
  newMessages.push(
    await assistantMsg(
      session.id,
      'What type of video ad would you like to create?',
      'videoGenAdTypePicker',
      { categories: VIDEO_GEN_AD_CATEGORIES },
    ),
  );
  return vg;
}

async function beginLearnAndBuild(
  session: DbChatSession,
  vg: VideoGenState,
  newMessages: SerializedMessage[],
): Promise<VideoGenState> {
  vg.step = 'analyzingAds';
  newMessages.push(
    await assistantMsg(
      session.id,
      'Fetching your top 3 performing video ads and analyzing what makes them work…',
      'videoGenAnalyzing',
      { phase: 'topAds' },
    ),
  );

  try {
    const result = await runTopAdsIntelligencePipeline(session.companyId);
    vg.topAssetIds = result.assetIds;
    vg.intelligenceBrief = result.intelligenceBrief;
    return runScriptGeneration(session, vg, newMessages);
  } catch (e) {
    vg.lastError = e instanceof Error ? e.message : 'Analysis failed';
    newMessages.push(
      await assistantMsg(
        session.id,
        `${vg.lastError} You can retry from Profile → Analyze ads or pick another path.`,
        'videoGenSubpathChoice',
        {
          subpaths: [
            { id: 'mrAdicasso', label: 'Mr. Adicasso', description: 'AI-driven masterpiece from scratch' },
            { id: 'learnAndBuild', label: 'Learn and Build', description: 'From your top performers' },
            { id: 'replicate', label: 'Replicate an Ad', description: 'Match an existing ad' },
          ],
        },
      ),
    );
    vg.step = 'routing';
    return vg;
  }
}

async function loadReplicateLibrary(companyId: string) {
  return prisma.asset.findMany({
    where: { companyId, assetType: 'VIDEO' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      playbackUrl: true,
      intelligenceStatus: true,
      status: true,
    },
  });
}

export async function initVideoGenFromFirstMessage(
  session: DbChatSession,
  workflowState: WorkflowState,
  userText: string,
): Promise<OrchestratorResult> {
  const newMessages: SerializedMessage[] = [];
  if (userText.trim()) {
    newMessages.push(await userMsg(session.id, userText.trim()));
  }

  const hinted = await classifyVideoGenSubpath(userText);
  const vague =
    !/learn|build|replicat|adicasso|picasso|top perform|existing ad/i.test(userText);

  if (!vague) {
    return startSubpath(session, workflowState, hinted, undefined);
  }

  const vg: VideoGenState = {
    subpath: hinted,
    step: 'routing',
  };

  newMessages.push(
    await assistantMsg(
      session.id,
      'Video Ad Generation — pick how you want to create your ad:',
      'videoGenSubpathChoice',
      {
        subpaths: [
          {
            id: 'mrAdicasso',
            label: 'Mr. Adicasso',
            description: 'AI-driven masterpiece from brand context',
          },
          {
            id: 'learnAndBuild',
            label: 'Learn and Build',
            description: 'Learn from your top 3 performing ads',
          },
          {
            id: 'replicate',
            label: 'Replicate an Ad',
            description: 'Match an existing ad’s creative DNA',
          },
        ],
      },
    ),
  );

  const nextState = mergeVideoGenIntoWorkflow(workflowState, vg);
  const updated = await persist(session, nextState);
  return packageResult(updated, nextState, newMessages);
}

export async function startSubpath(
  session: DbChatSession,
  workflowState: WorkflowState,
  subpath: VideoGenSubpath,
  userText?: string,
): Promise<OrchestratorResult> {
  const newMessages: SerializedMessage[] = [];
  if (userText?.trim()) {
    newMessages.push(await userMsg(session.id, userText.trim()));
  }

  let vg = initialVideoGenState(subpath);
  vg.step = 'routing';

  const labels: Record<VideoGenSubpath, string> = {
    mrAdicasso: 'Mr. Adicasso — the Picasso of the ad gen world',
    learnAndBuild: 'Learn and Build — from your top performers',
    replicate: 'Replicate an Ad — match an existing creative',
  };

  newMessages.push(
    await assistantMsg(session.id, `Video Ad Generation · ${labels[subpath]}`),
  );

  if (subpath === 'mrAdicasso') {
    vg = await beginMrAdicasso(session, vg, newMessages);
  } else if (subpath === 'learnAndBuild') {
    vg = await beginLearnAndBuild(session, vg, newMessages);
  } else {
    vg.step = 'adLibraryPick';
    const assets = await loadReplicateLibrary(session.companyId);
    newMessages.push(
      await assistantMsg(
        session.id,
        'Pick a video ad from your library to replicate its creative DNA.',
        'videoGenAdLibraryPicker',
        { assets },
      ),
    );
  }

  const nextState = mergeVideoGenIntoWorkflow(workflowState, vg);
  const updated = await persist(session, nextState);
  return packageResult(updated, nextState, newMessages);
}

function matchOfferingByText(
  vg: VideoGenState,
  text: string,
): string | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  for (const o of vg.companyContext?.offerings ?? []) {
    if (o.name.toLowerCase() === q || o.name.toLowerCase().includes(q) || q.includes(o.name.toLowerCase())) {
      return o.id;
    }
  }
  return null;
}

function matchAdCategoryByText(text: string): VideoGenAdCategory | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  for (const c of VIDEO_GEN_AD_CATEGORIES) {
    if (c.label.toLowerCase() === q || c.label.toLowerCase().includes(q) || q.includes(c.id.toLowerCase())) {
      return c.id;
    }
  }
  return null;
}

export async function handleVideoGenMessage(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const { tryHandleVideoGenWidgetChoiceTurn } = await import(
    '@/lib/chats/handle-widget-choice-turn'
  );
  const widgetChoiceResult = await tryHandleVideoGenWidgetChoiceTurn(
    sessionId,
    companyId,
    text,
  );
  if (widgetChoiceResult) return widgetChoiceResult;

  const workflowState = parseWorkflowState(session.workflowState);
  let vg = getVg(workflowState);
  const newMessages: SerializedMessage[] = [];
  newMessages.push(await userMsg(sessionId, text));

  if (vg.step === 'offeringPick') {
    const offeringId = matchOfferingByText(vg, text);
    if (offeringId) {
      return handleVideoGenAction(
        sessionId,
        companyId,
        'videoGen.offeringSelected',
        { offeringId },
        text,
      );
    }
    newMessages.push(
      await assistantMsg(
        session.id,
        'Pick an offering from the list above, or type the exact product name.',
        'videoGenOfferingPicker',
        { offerings: vg.companyContext?.offerings ?? [] },
      ),
    );
  } else if (vg.step === 'adTypePick') {
    const category = matchAdCategoryByText(text);
    if (category) {
      return handleVideoGenAction(
        sessionId,
        companyId,
        'videoGen.adTypeSelected',
        { category },
        text,
      );
    }
    newMessages.push(
      await assistantMsg(
        session.id,
        'Pick an ad type from the buttons above, or type one of the format names (e.g. UGC, Pain Point Ad).',
        'videoGenAdTypePicker',
        { categories: VIDEO_GEN_AD_CATEGORIES },
      ),
    );
  } else if (vg.step === 'trendPick') {
    vg.trendTopic = text.trim();
    vg.step = 'durationInput';
    newMessages.push(
      await assistantMsg(
        session.id,
        'How long should this ad be? (e.g. "around 30 seconds" or "keep it short")',
      ),
    );
  } else if (vg.step === 'durationInput') {
    vg.durationBucket = await classifyDuration(text);
    vg = await runScriptGeneration(session, vg, newMessages);
  } else if (vg.step === 'reviewScript') {
    const intent = await classifyChangeIntent(text, {
      adScript: vg.adScript,
      adCategory: vg.adCategory,
      durationBucket: vg.durationBucket,
    });

    if (intent.action === 'clarify' && intent.assistantReply) {
      newMessages.push(await assistantMsg(session.id, intent.assistantReply));
    } else if (intent.action === 'changeCategory') {
      vg.adCategory = intentCategory(intent.newCategory) ?? vg.adCategory;
      vg.step = 'adTypePick';
      newMessages.push(
        await assistantMsg(
          session.id,
          'Pick a new ad type:',
          'videoGenAdTypePicker',
          { categories: VIDEO_GEN_AD_CATEGORIES },
        ),
      );
    } else if (intent.action === 'changeDuration') {
      vg.durationBucket = intentDuration(intent.newDuration) ?? (await classifyDuration(text));
      vg = await runScriptGeneration(session, vg, newMessages, { changeFeedback: text });
    } else if (intent.action === 'regenerate') {
      vg = await runScriptGeneration(session, vg, newMessages, { changeFeedback: text });
    } else {
      vg = await runScriptGeneration(session, vg, newMessages, { changeFeedback: text });
    }
  } else if (vg.step === 'routing') {
    newMessages.push(
      await assistantMsg(
        session.id,
        'Choose how you want to create your video ad:',
        'videoGenSubpathChoice',
        {
          subpaths: [
            { id: 'mrAdicasso', label: 'Mr. Adicasso', description: 'AI masterpiece from scratch' },
            { id: 'learnAndBuild', label: 'Learn and Build', description: 'From top performers' },
            { id: 'replicate', label: 'Replicate an Ad', description: 'Match an existing ad' },
          ],
        },
      ),
    );
  } else if (vg.step === 'adLibraryPick') {
    newMessages.push(
      await assistantMsg(
        session.id,
        'Select a video from the library above, or type part of its title.',
        'videoGenAdLibraryPicker',
        { assets: await loadReplicateLibrary(session.companyId) },
      ),
    );
  } else {
    newMessages.push(
      await assistantMsg(
        session.id,
        'Use the controls above to continue, or describe what you’d like to change.',
      ),
    );
  }

  const nextState = mergeVideoGenIntoWorkflow(workflowState, vg);
  const updated = await persist(session, nextState);
  return packageResult(updated, nextState, newMessages);
}

export async function handleVideoGenAction(
  sessionId: string,
  companyId: string,
  action: VideoGenActionType,
  payload: Record<string, unknown>,
  userMessage?: string | null,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const workflowState = parseWorkflowState(session.workflowState);
  let vg = getVg(workflowState);
  const newMessages: SerializedMessage[] = [];

  const displayUserText = userMessage?.trim();
  if (displayUserText && !shouldSkipActionUserBubble(session.messages, action)) {
    newMessages.push(await userMsg(sessionId, displayUserText));
  }

  switch (action) {
    case 'videoGen.subpathChosen': {
      const subpath = payload.subpath as VideoGenSubpath;
      return startSubpath(session, workflowState, subpath);
    }

    case 'videoGen.offeringSelected': {
      const offeringId = String(payload.offeringId ?? '');
      vg.offeringId = offeringId;
      if (vg.companyContext) {
        vg.companyContext = applyOfferingToContext(vg.companyContext, offeringId);
      }
      vg.step = 'adTypePick';
      newMessages.push(
        await assistantMsg(
          session.id,
          'What type of video ad would you like to create?',
          'videoGenAdTypePicker',
          { categories: VIDEO_GEN_AD_CATEGORIES },
        ),
      );
      break;
    }

    case 'videoGen.adTypeSelected': {
      vg.adCategory = payload.category as VideoGenAdCategory;
      if (vg.adCategory === 'trendInduced') {
        vg.step = 'trendPick';
        newMessages.push(
          await assistantMsg(
            session.id,
            'Which current trend do you want to build this ad around?',
          ),
        );
      } else {
        vg.step = 'durationInput';
        newMessages.push(
          await assistantMsg(
            session.id,
            'How long should this ad be? (e.g. "around 30 seconds" or "keep it short")',
          ),
        );
      }
      break;
    }

    case 'videoGen.trendSubmitted': {
      vg.trendTopic = String(payload.trend ?? userMessage ?? '').trim();
      vg.step = 'durationInput';
      newMessages.push(
        await assistantMsg(
          session.id,
          'How long should this ad be? (e.g. "around 30 seconds" or "keep it short")',
        ),
      );
      break;
    }

    case 'videoGen.adSelected': {
      const assetId = String(payload.assetId ?? '');
      vg.replicateAssetId = assetId;
      vg.step = 'runningIntel';
      newMessages.push(
        await assistantMsg(
          session.id,
          'Analyzing your selected ad…',
          'videoGenAnalyzing',
          { phase: 'single', assetId },
        ),
      );
      try {
        await runSingleAssetIntelligence(session.companyId, assetId);
        vg = await runScriptGeneration(session, vg, newMessages);
      } catch (e) {
        vg.lastError = e instanceof Error ? e.message : 'Analysis failed';
        newMessages.push(
          await assistantMsg(
            session.id,
            `${vg.lastError}`,
            'videoGenAdLibraryPicker',
            { assets: await loadReplicateLibrary(session.companyId) },
          ),
        );
        vg.step = 'adLibraryPick';
      }
      break;
    }

    case 'videoGen.retryIntel': {
      if (vg.replicateAssetId) {
        vg.step = 'runningIntel';
        try {
          await runSingleAssetIntelligence(session.companyId, vg.replicateAssetId);
          vg = await runScriptGeneration(session, vg, newMessages);
        } catch (e) {
          vg.lastError = e instanceof Error ? e.message : 'Retry failed';
          newMessages.push(await assistantMsg(session.id, vg.lastError));
        }
      }
      break;
    }

    case 'videoGen.scriptChangeRequested': {
      const feedback = String(payload.feedback ?? userMessage ?? '').trim();
      if (feedback) {
        vg = await runScriptGeneration(session, vg, newMessages, { changeFeedback: feedback });
      } else {
        newMessages.push(
          await assistantMsg(session.id, 'Tell me what you’d like changed about the script.'),
        );
      }
      break;
    }

    case 'videoGen.scriptApproved': {
      if (!vg.adScript || !vg.directorPrompt) {
        newMessages.push(
          await assistantMsg(session.id, 'No script ready yet. Generate a script first.'),
        );
        break;
      }

      vg.step = 'heygenGenerating';
      newMessages.push(
        await assistantMsg(
          session.id,
          'Approved. Sending to HeyGen to generate your video…',
          'videoGenHeygenProgress',
          { status: 'starting' },
        ),
      );

      try {
        const { jobId } = await startHeygenFromChat({
          companyId: session.companyId,
          chatSessionId: session.id,
          subpath: vg.subpath,
          adScript: vg.adScript,
          directorPrompt: vg.directorPrompt,
          adCategory: vg.adCategory,
          durationBucket: vg.durationBucket,
        });
        vg.heygenJobId = jobId;
        vg.step = 'heygenPolling';

        const job = await prisma.videoGenerationJob.findUnique({ where: { id: jobId } });
        if (job) {
          const synced = await syncHeygenJob(job);
          if (synced.assetId) {
            vg.generatedAssetId = synced.assetId;
            vg.step = 'done';
            newMessages.push(
              await assistantMsg(
                session.id,
                'Your video is ready and has been added to your library.',
                'videoGenDone',
                { jobId, assetId: synced.assetId },
              ),
            );
          } else {
            newMessages.push(
              await assistantMsg(
                session.id,
                'Video generation is in progress. I’ll update you when it’s ready (this can take a few minutes).',
                'videoGenHeygenProgress',
                { jobId, heygenStatus: synced.heygenStatus, progressMessage: synced.progressMessage },
              ),
            );
          }
        }
      } catch (e) {
        vg.lastError = e instanceof Error ? e.message : 'HeyGen failed';
        newMessages.push(
          await assistantMsg(
            session.id,
            `Video generation failed: ${vg.lastError}. You can edit the script and try again.`,
            'videoGenScriptReview',
            { adScript: vg.adScript },
          ),
        );
        vg.step = 'reviewScript';
      }
      break;
    }

    default:
      break;
  }

  const nextState = mergeVideoGenIntoWorkflow(workflowState, vg);
  const updated = await persist(session, nextState);
  return packageResult(updated, nextState, newMessages);
}
