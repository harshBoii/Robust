import 'server-only';

import {
  handleUserFacingLlmError,
  sanitizeUserFacingLlmError,
} from '@/lib/assistant/user-facing-llm-error';
import { prisma } from '@/lib/prisma';
import {
  appendChatMessages,
  getChatSession,
  updateChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { loadGroupsForBulk } from '@/lib/chats/load-groups';
import { shouldSkipActionUserBubble } from '@/lib/chats/user-message-policy';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type { OrchestratorResult, SerializedMessage, WorkflowState } from '@/lib/chats/types';

import {
  buildImageEditPrompt,
  buildProductAdBasePrompt,
  buildProductOnModelPrompt,
} from './base-prompts';
import { resolveLastGeneratedImageUrl } from './resolve-last-generated-image';
import { batchGenerateVariants } from './batch-generate';
import {
  classifyPostResultNext,
  POST_RESULT_NEXT_OPTIONS,
  type PostResultNextRoute,
} from './classify-post-result-next';
import { tryHandleImageGenEmptyPickerTurn } from '@/lib/chats/handle-empty-picker-turn';
import { tryHandleImageGenWidgetChoiceTurn } from '@/lib/chats/handle-widget-choice-turn';
import { classifyImageGenSubpath } from './classify-subpath';
import { isCollectionComplete, runCollectorTurn } from './collect-fields-agent';
import { ensureBrandDnaOnState, hydrateFromCompany } from './load-brand-dna';
import { appendLogoRef, resolveCompanyLogoUrl } from './resolve-company-logo';
import { runTemplateNotesTurn } from './template-collector-agent';
import {
  runTemplateGenerate,
  runTemplateRegenerateSlot,
  TEMPLATE_POST_RESULT_OPTIONS,
} from './template-generate';
import { getTemplateById } from '@/lib/templates/catalog';
import { getCatalogForWidget } from './catalog';
import { resolveOnModelReferenceUrls } from './resolve-on-model-refs';
import {
  DEFAULT_IMAGE_ARTIST_ID,
  DEFAULT_IMAGE_QUALITY,
  findImageArtist,
  IMAGE_ARTISTS,
  IMAGE_QUALITY_OPTIONS,
} from './image-artists';
import { generateImage } from './generate-image';
import { importProductImageFromUrl } from './import-product-image';
import { appendGeneratedAsset, initialImageGenState, mergeImageGenIntoWorkflow, parseImageGenState } from './state';
import { storeGeneratedImage } from './store-generated';
import type {
  ImageGenActionType,
  ImageGenState,
  ImageGenStep,
  ImageGenSubpath,
  ImageGenWidgetType,
} from './types';
import {
  applyLastGeneratedAsProductImage,
  applyLastGeneratedForVariantGen,
} from './carry-over-image';
import { resolveAssetImageUrl } from './resolve-asset-image-url';
import { handleIdeaReviewTurn } from './handle-idea-review-turn';
import { buildIdeaReviewWidgetPayload } from './idea-review-widget-payload';
import { generateVariantPrompts, regenerateVariantPrompts } from './variant-prompts';
import {
  handleRivalBrandChosen,
  handleRivalInspirationChosen,
  parseRivalInspirationYesNo,
  promptRivalInspirationIfAvailable,
} from '@/lib/rival-analysis/rival-inspiration-chat';
import { listRivalsWithCompletedSummaries } from '@/lib/rival-analysis/fetch-summary-for-chat';

const IMAGE_GEN_STEP = 'imageGen';

function artistSettingsWidgetPayload(ig: ImageGenState) {
  return {
    artists: IMAGE_ARTISTS,
    qualities: IMAGE_QUALITY_OPTIONS,
    selectedArtistId: ig.imageArtistId,
    selectedQuality: ig.imageQuality,
  };
}

function generatingLabel(ig: ImageGenState): string {
  const artist = findImageArtist(ig.imageArtistId);
  const q = ig.imageQuality ?? DEFAULT_IMAGE_QUALITY;
  return `Generating with ${artist.name} · ${q} quality…`;
}

function buildCollectFieldsMessage(ig: ImageGenState): string {
  const artist = findImageArtist(ig.imageArtistId);
  const prefix = `${artist.name} · ${ig.imageQuality} quality.`;
  const missing: string[] = [];
  if (!ig.productDescription?.trim()) missing.push('product description');
  if (!ig.brandTone?.trim()) missing.push('brand tone');
  if (typeof ig.copyCount !== 'number' || ig.copyCount < 1) {
    missing.push('how many copies you want');
  }

  if (!missing.length) {
    return `${prefix} Share any final details, or say go when ready.`;
  }

  if (ig.brandDnaApplied && ig.brandTone?.trim() && missing.length === 1 && missing[0] === 'how many copies you want') {
    return `${prefix} Brand tone loaded from your DNA profile. How many copies do you want?`;
  }

  if (ig.brandDnaApplied && ig.brandTone?.trim() && !missing.includes('brand tone')) {
    const withoutTone = missing.filter((m) => m !== 'brand tone');
    if (withoutTone.length) {
      return `${prefix} Brand tone loaded from your DNA profile. Share ${withoutTone.join(' and ')}.`;
    }
  }

  return `${prefix} Share ${missing.join(', ')}.`;
}

function imageRivalCallbacks(
  session: DbChatSession,
  ig: ImageGenState,
  newMessages: SerializedMessage[],
  workflowState: WorkflowState,
  autoRoute?: { result: OrchestratorResult | null },
) {
  return {
    widgetPrefix: 'imageGen' as const,
    setStep: (step: 'rivalInspirationAsk' | 'rivalBrandPick') => {
      ig.step = step as ImageGenStep;
    },
    appendAssistant: (content: string, widgetType?: string | null, widgetPayload?: unknown) =>
      assistantMsg(session.id, content, widgetType as ImageGenWidgetType | undefined, widgetPayload),
    onContinue: async () => {
      const result = await enterCollectFieldsOrGenerate(session, workflowState, ig, newMessages);
      if (result && autoRoute) autoRoute.result = result;
    },
    setRivalInspirationEnabled: (enabled: boolean) => {
      ig.rivalInspirationEnabled = enabled;
    },
    setRivalBrandName: (name: string | null) => {
      ig.rivalBrandName = name;
    },
    setRivalIntelligenceBrief: (brief: string | undefined) => {
      ig.rivalIntelligenceBrief = brief;
    },
  };
}

async function promptImageCollectFields(
  session: DbChatSession,
  ig: ImageGenState,
  newMessages: SerializedMessage[],
): Promise<void> {
  ig.step = 'collectFields';
  newMessages.push(
    await assistantMsg(session.id, buildCollectFieldsMessage(ig)),
  );
}

async function enterCollectFieldsOrGenerate(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  newMessages: SerializedMessage[],
): Promise<OrchestratorResult | null> {
  const patch = await hydrateFromCompany(session.companyId, ig);
  Object.assign(ig, patch);

  if (isCollectionComplete(ig)) {
    newMessages.push(
      await assistantMsg(session.id, 'Using your Brand DNA profile — generating…'),
    );
    if (ig.subpath === 'productAd') {
      return runGenerateBase(session, workflowState, ig, newMessages);
    }
    if (ig.subpath === 'variantGen') {
      return runGenerateIdeas(session, workflowState, ig, newMessages);
    }
  }

  await promptImageCollectFields(session, ig, newMessages);
  return null;
}

async function beginRivalInspirationOrCollectFields(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  newMessages: SerializedMessage[],
): Promise<OrchestratorResult | null> {
  const autoRoute = { result: null as OrchestratorResult | null };
  await promptRivalInspirationIfAvailable(
    session,
    imageRivalCallbacks(session, ig, newMessages, workflowState, autoRoute),
  );
  return autoRoute.result;
}

async function promptArtistSettings(
  session: DbChatSession,
  ig: ImageGenState,
  newMessages: SerializedMessage[],
): Promise<ImageGenState> {
  ig.step = 'artistSettings';
  newMessages.push(
    await assistantMsg(
      session.id,
      'Pick your image artist and quality. Mr Adicasso is the best in the game; Mr Crafta is a solid budget option; Tintin is the cheaper pick; Mr Adasta uses Seedream 4.5 for stylized transforms.',
      'imageGenArtistSettings',
      artistSettingsWidgetPayload(ig),
    ),
  );
  return ig;
}

async function assistantMsg(
  sessionId: string,
  content: string,
  widgetType?: ImageGenWidgetType | null,
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

async function userMsg(
  sessionId: string,
  content: string,
  opts?: { widgetType?: string | null; widgetPayload?: unknown },
): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [
    {
      role: 'USER',
      content,
      widgetType: opts?.widgetType ?? null,
      widgetPayload: opts?.widgetPayload,
    },
  ]);
  return serializeMessage(row);
}

async function resolveUploadImageUrl(
  companyId: string,
  assetId: string,
  imageUrl?: string,
): Promise<string | undefined> {
  const url = await resolveAssetImageUrl(companyId, assetId, imageUrl);
  return url ?? undefined;
}

async function attachmentUserMsg(
  sessionId: string,
  companyId: string,
  payload: Record<string, unknown>,
  displayText?: string | null,
): Promise<SerializedMessage | null> {
  const assetId = typeof payload.assetId === 'string' ? payload.assetId : undefined;
  let imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined;
  if (assetId) {
    imageUrl = await resolveUploadImageUrl(companyId, assetId, imageUrl);
  }
  const fileName =
    typeof payload.fileName === 'string' && payload.fileName.trim()
      ? payload.fileName.trim()
      : displayText?.trim() || 'Uploaded image';
  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType : undefined;
  if (!assetId && !imageUrl) return null;
  const text =
    displayText?.trim() && displayText.trim() !== fileName ? displayText.trim() : '';
  return userMsg(sessionId, text, {
    widgetType: 'chatAttachments',
    widgetPayload: {
      items: [{ assetId, fileName, imageUrl, mimeType }],
    },
  });
}

async function resolveProductImageUrl(
  companyId: string,
  ig: ImageGenState,
): Promise<string | null> {
  if (!ig.productImageAssetId && !ig.productImageUrl) return null;
  if (ig.productImageAssetId) {
    return resolveAssetImageUrl(companyId, ig.productImageAssetId, ig.productImageUrl);
  }
  return ig.productImageUrl ?? null;
}

function packageResult(
  session: DbChatSession,
  workflowState: WorkflowState,
  newMessages: SerializedMessage[],
): OrchestratorResult {
  const serialized = serializeSession({ ...session, workflowState });
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: IMAGE_GEN_STEP as OrchestratorResult['session']['currentStep'],
      workflowState,
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
  pathType: 'IMAGE_GEN' = 'IMAGE_GEN',
) {
  await updateChatSession(session.id, session.companyId, {
    currentStep: IMAGE_GEN_STEP,
    workflowState,
    pathType,
  });
}

function getIg(workflowState: WorkflowState): ImageGenState {
  const ig = parseImageGenState(workflowState);
  if (!ig) throw new Error('Image gen state missing');
  return ig;
}

async function startSubpath(
  session: DbChatSession,
  workflowState: WorkflowState,
  subpath: ImageGenSubpath,
  firstUserText: string,
): Promise<OrchestratorResult> {
  let ig = initialImageGenState(subpath);
  ig.agentMemory = firstUserText.slice(0, 500);

  const newMessages: SerializedMessage[] = [];

  if (subpath === 'productAd') {
    ig.step = 'imageSource';
    newMessages.push(
      await assistantMsg(
        session.id,
        "Let's create your product ad. Where should the product image come from?",
        'imageGenSourceChoice',
      ),
    );
  } else if (subpath === 'variantGen') {
    ig.step = 'variantImageSource';
    newMessages.push(
      await assistantMsg(
        session.id,
        'Ad copy variant generator — pick your base image source.',
        'imageGenVariantSource',
      ),
    );
  } else {
    ig.step = 'productSource';
    newMessages.push(
      await assistantMsg(
        session.id,
        'Product on model — choose your product source first.',
        'imageGenSourceChoice',
        { mode: 'productOnModel' },
      ),
    );
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

export async function initImageGenFromFirstMessage(
  session: DbChatSession,
  workflowState: WorkflowState,
  userText: string,
): Promise<OrchestratorResult> {
  const subpath = await classifyImageGenSubpath(userText);
  return startSubpath(session, workflowState, subpath, userText);
}

export async function handleImageGenMessage(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const workflowState = parseWorkflowState(session.workflowState);
  let ig = getIg(workflowState);

  const emptyPickerResult = await tryHandleImageGenEmptyPickerTurn(sessionId, companyId, text);
  if (emptyPickerResult) return emptyPickerResult;

  const widgetChoiceResult = await tryHandleImageGenWidgetChoiceTurn(sessionId, companyId, text);
  if (widgetChoiceResult) return widgetChoiceResult;

  const newMessages: SerializedMessage[] = [];
  newMessages.push(await userMsg(sessionId, text));

  const messageHistory = (session.messages ?? [])
    .filter((m) => m.content)
    .map((m) => ({
      role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content!,
    }));

  if (ig.subpath === 'templates' && ig.step === 'templateUpload') {
    if (!ig.productImageAssetId) {
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Please upload your image using **+** or the upload button below.',
          'imageGenUpload',
          { mode: 'template', templateId: ig.templateId },
        ),
      );
    } else {
      ig.step = 'templateNotes';
      const result = await runTemplateNotesTurn({
        state: ig,
        userText: text,
        history: messageHistory,
      });
      ig = { ...ig, ...result.state, step: 'templateNotes' };
      newMessages.push(await assistantMsg(sessionId, result.reply));
      if (result.readyToGenerate) {
        return runTemplateGenerateFlow(session, workflowState, ig, newMessages);
      }
    }
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
    await persist(session, nextWorkflow);
    const updated = await getChatSession(sessionId, companyId);
    return packageResult(updated!, nextWorkflow, newMessages);
  }

  if (ig.subpath === 'templates' && ig.step === 'templateNotes') {
    const result = await runTemplateNotesTurn({
      state: ig,
      userText: text,
      history: messageHistory,
    });
    ig = { ...ig, ...result.state, step: 'templateNotes' };
    newMessages.push(await assistantMsg(sessionId, result.reply));
    if (result.readyToGenerate) {
      return runTemplateGenerateFlow(session, workflowState, ig, newMessages);
    }
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
    await persist(session, nextWorkflow);
    const updated = await getChatSession(sessionId, companyId);
    return packageResult(updated!, nextWorkflow, newMessages);
  }

  if (ig.step === 'rivalInspirationAsk') {
    const yesNo = parseRivalInspirationYesNo(text);
    if (yesNo === null) {
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Please choose **Yes** or **No** using the buttons below.',
          'imageGenRivalInspirationChoice',
        ),
      );
    } else {
      const autoRoute = { result: null as OrchestratorResult | null };
      await handleRivalInspirationChosen(
        session,
        yesNo,
        imageRivalCallbacks(session, ig, newMessages, workflowState, autoRoute),
      );
      if (autoRoute.result) return autoRoute.result;
    }
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
    await persist(session, nextWorkflow);
    const updated = await getChatSession(sessionId, companyId);
    return packageResult(updated!, nextWorkflow, newMessages);
  }

  if (ig.step === 'rivalBrandPick') {
    const available = await listRivalsWithCompletedSummaries(companyId);
    const lower = text.trim().toLowerCase();
    const isMix = /\b(mix|top rivals?|all rivals?|any|no preference)\b/i.test(text);
    const match = available.find((r) => r.brandName.toLowerCase() === lower);

    const autoRoute = { result: null as OrchestratorResult | null };
    if (isMix) {
      await handleRivalBrandChosen(
        session,
        null,
        imageRivalCallbacks(session, ig, newMessages, workflowState, autoRoute),
      );
    } else if (match) {
      await handleRivalBrandChosen(
        session,
        match.brandName,
        imageRivalCallbacks(session, ig, newMessages, workflowState, autoRoute),
      );
    } else {
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Pick a rival from the list below, choose **Mix of top rivals**, or type the exact brand name.',
          'imageGenRivalBrandPicker',
          { rivals: available.map((r) => ({ id: r.id, brandName: r.brandName })) },
        ),
      );
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      const updated = await getChatSession(sessionId, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }
    if (autoRoute.result) return autoRoute.result;
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
    await persist(session, nextWorkflow);
    const updated = await getChatSession(sessionId, companyId);
    return packageResult(updated!, nextWorkflow, newMessages);
  }

  if (ig.step === 'collectFields') {
    const result = await runCollectorTurn({ state: ig, userText: text, history: messageHistory });
    ig = { ...ig, ...result.state };
    newMessages.push(await assistantMsg(sessionId, result.reply));

    if (result.complete) {
      if (ig.subpath === 'productAd') {
        return runGenerateBase(session, workflowState, ig, newMessages);
      }
      if (ig.subpath === 'variantGen') {
        return runGenerateIdeas(session, workflowState, ig, newMessages);
      }
    } else {
      ig.step = 'collectFields';
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      const updated = await getChatSession(sessionId, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }
  }

  if (
    ig.subpath === 'templates' &&
    (ig.step === 'reviewTemplate' || ig.step === 'chooseNext')
  ) {
    const fields = {
      ...(ig.templateCollectedFields ?? {}),
      additionalRequest: text,
      changeRequest: text,
    };
    const carried = applyLastGeneratedAsProductImage({
      ...ig,
      templateCollectedFields: fields,
      rejectFeedback: text,
    });
    if (!carried) {
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Generate an image first, then describe what to change.',
        ),
      );
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      const updated = await getChatSession(sessionId, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, carried);
    await persist(session, nextWorkflow);
    return runTemplateGenerateFlow(session, nextWorkflow, carried, newMessages);
  }

  if (ig.subpath === 'variantGen' && ig.step === 'reviewIdeas') {
    return handleIdeaReviewTurn(session, companyId, workflowState, ig, text, newMessages, {
      resolveProductImageUrl,
      assistantMsg: (sessionId, content, widgetType, widgetPayload) =>
        assistantMsg(
          sessionId,
          content,
          widgetType as Parameters<typeof assistantMsg>[2],
          widgetPayload,
        ),
      runGenerateVariants,
      persist,
      getChatSession,
      packageResult,
    });
  }

  if (ig.step === 'chooseNext' || ig.step === 'reviewBase' || ig.step === 'reviewOnModel') {
    const route = await classifyPostResultNext({ userText: text });
    return routePostResultNext(
      session,
      companyId,
      workflowState,
      ig,
      route,
      newMessages,
      text,
    );
  }

  if (ig.subpath === 'variantGen' && ig.step === 'generateVariants') {
    const idx = resolveVariantIndexFromText(text, ig);
    if (idx >= 0) {
      return runRegenerateVariant(session, workflowState, ig, idx, newMessages);
    }
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(sessionId, companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

function resolveVariantIndexFromText(text: string, ig: ImageGenState): number {
  const variants = ig.variants ?? [];
  const lower = text.toLowerCase();
  const numMatch = lower.match(/variant\s*#?\s*(\d+)|\b(\d+)\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1] ?? numMatch[2], 10);
    if (n >= 1 && n <= variants.length) return n - 1;
  }
  const byLabel = variants.findIndex((v) => lower.includes(v.ideaLabel.toLowerCase()));
  return byLabel;
}

async function runGenerateBase(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  priorMessages: SerializedMessage[],
): Promise<OrchestratorResult> {
  const newMessages = [...priorMessages];
  ig.step = 'generateBase';
  let nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  newMessages.push(await assistantMsg(session.id, generatingLabel(ig), 'imageGenGenerating'));

  try {
    const editFeedback = ig.rejectFeedback?.trim();
    const refUrl = editFeedback
      ? await resolveLastGeneratedImageUrl(session.companyId, ig)
      : await resolveProductImageUrl(session.companyId, ig);
    if (!refUrl) {
      throw new Error(editFeedback ? 'No generated image to edit.' : 'Product image is missing');
    }

    const logoUrl = editFeedback ? null : await resolveCompanyLogoUrl(session.companyId);
    const refUrls = appendLogoRef([refUrl], logoUrl);
    const prompt = buildProductAdBasePrompt(ig, editFeedback, Boolean(logoUrl));
    const gen = await generateImage({
      prompt,
      referenceImageUrls: refUrls,
      aspectRatio: ig.aspectRatio,
      imageArtistId: ig.imageArtistId,
      quality: ig.imageQuality,
    });
    const stored = await storeGeneratedImage({
      companyId: session.companyId,
      sessionId: session.id,
      imageBase64: gen.imageBase64,
      title: 'Product ad',
      label: 'Base ad',
    });

    ig = appendGeneratedAsset(
      {
        ...ig,
        step: 'chooseNext',
        baseGeneratedAssetId: stored.assetId,
        baseGeneratedImageUrl: stored.imageUrl,
        rejectFeedback: undefined,
      },
      { assetId: stored.assetId, label: 'Base ad', imageUrl: stored.imageUrl },
    );

    const artist = findImageArtist(ig.imageArtistId);
    newMessages.push(
      await assistantMsg(session.id, "Here's your product ad.", 'imageGenSingleResult', {
        assetId: stored.assetId,
        imageUrl: stored.imageUrl,
        mode: 'productAd',
        artistName: artist.name,
        imageQuality: ig.imageQuality,
      }),
    );
    newMessages.push(
      await assistantMsg(
        session.id,
        'What would you like to do next? Pick an option or describe it in your own words.',
        'imageGenNextStep',
        { options: POST_RESULT_NEXT_OPTIONS, context: 'productAd' },
      ),
    );
  } catch (e) {
    workflowState.lastOperationError = handleUserFacingLlmError('image-gen/generate-base', e);
    ig.step = 'collectFields';
    newMessages.push(
      await assistantMsg(
        session.id,
        'Generation failed. You can adjust your brief and try again.',
      ),
    );
  }

  nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

async function runTemplateGenerateFlow(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  priorMessages: SerializedMessage[],
): Promise<OrchestratorResult> {
  const newMessages = [...priorMessages];
  ig = await ensureBrandDnaOnState(session.companyId, ig);
  const def = ig.templateId ? getTemplateById(ig.templateId) : undefined;
  ig.step = 'generateTemplate';
  let nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  newMessages.push(await assistantMsg(session.id, generatingLabel(ig), 'imageGenGenerating'));

  try {
    const { ig: nextIg, succeeded } = await runTemplateGenerate({
      companyId: session.companyId,
      sessionId: session.id,
      ig,
    });
    ig = nextIg;
    const out = ig.templateOutputs?.[0];

    if (!succeeded || !out?.assetId) {
      const detail =
        out?.error?.trim() ||
        sanitizeUserFacingLlmError('The model returned no image.');
      workflowState.lastOperationError = detail;
      ig.step = 'templateNotes';
      newMessages.push(
        await assistantMsg(
          session.id,
          "Generation didn't complete. Adjust your notes and try again — JPEG or PNG uploads work best.",
        ),
      );
    } else {
      const artist = findImageArtist(ig.imageArtistId);
      const imageUrl =
        out.imageUrl ??
        (await resolveAssetImageUrl(session.companyId, out.assetId)) ??
        undefined;

      newMessages.push(
        await assistantMsg(session.id, "Here's your image.", 'imageGenSingleResult', {
          assetId: out.assetId,
          imageUrl,
          mode: 'template',
          artistName: artist.name,
          imageQuality: ig.imageQuality,
          templateName: def?.name,
        }),
      );

      ig.step = 'chooseNext';
      newMessages.push(
        await assistantMsg(
          session.id,
          'What would you like to do next?',
          'imageGenNextStep',
          { options: TEMPLATE_POST_RESULT_OPTIONS, context: 'template' },
        ),
      );
    }
  } catch (e) {
    workflowState.lastOperationError = handleUserFacingLlmError('image-gen/template-generate-flow', e);
    ig.step = 'templateNotes';
    newMessages.push(
      await assistantMsg(
        session.id,
        'Generation failed. Adjust your notes or try again.',
      ),
    );
  }

  nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

async function runGenerateIdeas(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  priorMessages: SerializedMessage[],
): Promise<OrchestratorResult> {
  const newMessages = [...priorMessages];
  ig.step = 'generateIdeas';

  try {
    const refUrl = await resolveProductImageUrl(session.companyId, ig);
    if (!refUrl) throw new Error('Product image is missing');

    const variants = await generateVariantPrompts({
      state: ig,
      productImageUrl: refUrl,
    });
    ig = { ...ig, variants, step: 'reviewIdeas' };
    newMessages.push(
      await assistantMsg(
        session.id,
        `Here are ${variants.length} creative ideas. Each prompt is listed below — say "accept all" to generate, or e.g. "change prompt 1 to …" in chat.`,
        'imageGenIdeaReview',
        buildIdeaReviewWidgetPayload(variants),
      ),
    );
  } catch (e) {
    workflowState.lastOperationError = handleUserFacingLlmError('image-gen/generate-ideas', e);
    ig.step = 'collectFields';
    newMessages.push(await assistantMsg(session.id, 'Could not generate ideas. Please try again.'));
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

async function runGenerateVariants(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  priorMessages: SerializedMessage[] = [],
): Promise<OrchestratorResult> {
  const newMessages = [...priorMessages];
  ig.step = 'generateVariants';
  let nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  newMessages.push(
    await assistantMsg(session.id, 'Generating all variants in parallel…', 'imageGenVariantGrid', {
      loading: true,
      variants: ig.variants?.map((v) => ({ ideaLabel: v.ideaLabel, status: 'pending' })),
    }),
  );

  try {
    const refUrl = await resolveProductImageUrl(session.companyId, ig);
    if (!refUrl) throw new Error('Product image missing');
    const logoUrl = await resolveCompanyLogoUrl(session.companyId);

    const batch = await batchGenerateVariants({
      companyId: session.companyId,
      sessionId: session.id,
      referenceImageUrl: refUrl,
      logoUrl,
      aspectRatio: ig.aspectRatio,
      imageArtistId: ig.imageArtistId,
      imageQuality: ig.imageQuality,
      variants: ig.variants ?? [],
    });

    ig = { ...ig, variants: batch.variants };
    for (const v of batch.variants) {
      if (v.assetId && v.status === 'done') {
        ig = appendGeneratedAsset(ig, {
          assetId: v.assetId,
          label: v.ideaLabel,
          imageUrl: v.imageUrl,
        });
      }
    }

    newMessages.push(
      await assistantMsg(
        session.id,
        `Done — ${batch.succeeded} succeeded${batch.failed ? `, ${batch.failed} failed` : ''}. Select images to post as ads or ask to regenerate a variant.`,
        'imageGenVariantGrid',
        {
          loading: false,
          variants: batch.variants,
        },
      ),
    );
    ig.step = 'chooseNext';
    newMessages.push(
      await assistantMsg(
        session.id,
        'What would you like to do next?',
        'imageGenNextStep',
        { options: POST_RESULT_NEXT_OPTIONS, context: 'variants' },
      ),
    );
  } catch (e) {
    workflowState.lastOperationError = handleUserFacingLlmError('image-gen/batch-generate', e);
  }

  nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

async function runRegenerateVariant(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  index: number,
  priorMessages: SerializedMessage[],
): Promise<OrchestratorResult> {
  const newMessages = [...priorMessages];
  const refUrl = await resolveProductImageUrl(session.companyId, ig);
  if (!refUrl) throw new Error('Product image missing');
  const logoUrl = await resolveCompanyLogoUrl(session.companyId);

  const variants = [...(ig.variants ?? [])];
  variants[index] = { ...variants[index], status: 'pending' };

  const batch = await batchGenerateVariants({
    companyId: session.companyId,
    sessionId: session.id,
    referenceImageUrl: refUrl,
    logoUrl,
    aspectRatio: ig.aspectRatio,
    imageArtistId: ig.imageArtistId,
    imageQuality: ig.imageQuality,
    variants,
    indices: [index],
  });

  ig = { ...ig, variants: batch.variants };
  newMessages.push(
    await assistantMsg(session.id, 'Regenerated variant.', 'imageGenVariantGrid', {
      loading: false,
      variants: batch.variants,
    }),
  );

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

async function runProductOnModelGenerate(
  session: DbChatSession,
  workflowState: WorkflowState,
  ig: ImageGenState,
  priorMessages: SerializedMessage[] = [],
): Promise<OrchestratorResult> {
  const newMessages = [...priorMessages];
  ig = await ensureBrandDnaOnState(session.companyId, ig);

  newMessages.push(await assistantMsg(session.id, generatingLabel(ig), 'imageGenGenerating'));

  try {
    const editFeedback = ig.rejectFeedback?.trim();
    let gen: Awaited<ReturnType<typeof generateImage>>;
    let storedLabel = 'Product on model';

    if (editFeedback) {
      const refUrl = await resolveLastGeneratedImageUrl(session.companyId, ig);
      if (!refUrl) throw new Error('No generated image to edit.');

      const prompt = buildImageEditPrompt(editFeedback);
      gen = await generateImage({
        prompt,
        referenceImageUrl: refUrl,
        aspectRatio: ig.aspectRatio,
        imageArtistId: ig.imageArtistId,
        quality: ig.imageQuality,
      });
    } else {
      const refUrl = await resolveProductImageUrl(session.companyId, ig);
      if (!refUrl) throw new Error('Product image missing');

      const { urls, refs } = await resolveOnModelReferenceUrls(session.companyId, refUrl, ig);
      storedLabel = `${refs.model.label} · ${refs.pose.label}`;

      const logoUrl = await resolveCompanyLogoUrl(session.companyId);
      const refUrls = appendLogoRef(urls, logoUrl);

      const prompt = buildProductOnModelPrompt(
        ig,
        {
          modelLabel: refs.model.label,
          backgroundLabel: refs.background.label,
          poseLabel: refs.pose.label,
          modelSource: refs.model.source,
          backgroundSource: refs.background.source,
          poseSource: refs.pose.source,
        },
        undefined,
        Boolean(logoUrl),
      );
      gen = await generateImage({
        prompt,
        referenceImageUrls: refUrls,
        aspectRatio: ig.aspectRatio,
        imageArtistId: ig.imageArtistId,
        quality: ig.imageQuality,
      });
    }
    const stored = await storeGeneratedImage({
      companyId: session.companyId,
      sessionId: session.id,
      imageBase64: gen.imageBase64,
      title: 'Product on model',
      label: storedLabel,
    });

    ig = appendGeneratedAsset(
      {
        ...ig,
        step: 'reviewOnModel',
        onModelGeneratedAssetId: stored.assetId,
        onModelGeneratedImageUrl: stored.imageUrl,
        rejectFeedback: undefined,
      },
      { assetId: stored.assetId, label: 'Product on model', imageUrl: stored.imageUrl },
    );

    const artist = findImageArtist(ig.imageArtistId);
    newMessages.push(
      await assistantMsg(session.id, "Here's your product-on-model image.", 'imageGenSingleResult', {
        assetId: stored.assetId,
        imageUrl: stored.imageUrl,
        mode: 'productOnModel',
        artistName: artist.name,
        imageQuality: ig.imageQuality,
      }),
    );
    ig.step = 'chooseNext';
    newMessages.push(
      await assistantMsg(
        session.id,
        'What would you like to do next?',
        'imageGenNextStep',
        { options: POST_RESULT_NEXT_OPTIONS, context: 'onModel' },
      ),
    );
  } catch (e) {
    workflowState.lastOperationError = handleUserFacingLlmError('image-gen/generate-on-model', e);
    ig.step = 'poseSelect';
    newMessages.push(await assistantMsg(session.id, 'Generation failed — try another pose or background.'));
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

async function executePushToAds(
  sessionId: string,
  companyId: string,
  workflowState: WorkflowState,
  assetIds: string[],
  newMessages: SerializedMessage[],
): Promise<OrchestratorResult> {
  if (!assetIds.length) throw new Error('No images selected');

  const bulk = await prisma.bulkUpload.create({
    data: {
      companyId,
      name: `Chat generated · ${new Date().toLocaleString()}`,
      status: 'READY',
    },
  });

  await prisma.asset.updateMany({
    where: { id: { in: assetIds }, companyId },
    data: { bulkUploadId: bulk.id },
  });

  const { groups } = await loadGroupsForBulk(bulk.id, companyId, { runContentAnalyze: true });

  const adsState: WorkflowState = {
    bulkUploadId: bulk.id,
    assetIds,
    groups,
    agentNextStep: 'setup_campaign',
  };
  const nextWorkflow = { ...workflowState };
  delete nextWorkflow.imageGen;

  await updateChatSession(sessionId, companyId, {
    pathType: 'ADS',
    currentStep: 'campaignChoice',
    workflowState: adsState,
    bulkUploadId: bulk.id,
  });

  const [campaignRow] = await appendChatMessages(sessionId, [
    {
      role: 'ASSISTANT',
      content: "Your generated images are in — let's set up the campaign.",
      widgetType: 'campaignChoice',
    },
  ]);
  newMessages.push(serializeMessage(campaignRow));

  const updated = await getChatSession(sessionId, companyId);
  const serialized = serializeSession(updated!);
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: 'campaignChoice',
      workflowState: adsState,
      bulkUploadId: bulk.id,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
  };
}

async function routePostResultNext(
  session: DbChatSession,
  companyId: string,
  workflowState: WorkflowState,
  ig: ImageGenState,
  route: PostResultNextRoute,
  newMessages: SerializedMessage[],
  userFeedback?: string,
): Promise<OrchestratorResult> {
  switch (route) {
    case 'variants': {
      const carried = applyLastGeneratedForVariantGen(ig);
      if (!carried) {
        newMessages.push(
          await assistantMsg(
            session.id,
            'Generate an image first, then you can build variants from it.',
          ),
        );
        const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
        await persist(session, nextWorkflow);
        const updated = await getChatSession(session.id, companyId);
        return packageResult(updated!, nextWorkflow, newMessages);
      }
      ig = carried;
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      newMessages.push(
        await assistantMsg(session.id, 'Using your last generated image as the base for variants.'),
      );
      if (ig.productDescription && ig.brandTone && ig.copyCount) {
        return runGenerateIdeas(session, nextWorkflow, ig, newMessages);
      }
      newMessages.push(
        await assistantMsg(
          session.id,
          'How many copies do you want (1–8), and any tone tweaks?',
        ),
      );
      const updated = await getChatSession(session.id, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }

    case 'regenerate': {
      let nextIg = ig;
      if (userFeedback?.trim()) {
        nextIg = {
          ...nextIg,
          rejectFeedback: userFeedback,
          templateCollectedFields: {
            ...(nextIg.templateCollectedFields ?? {}),
            ...(nextIg.subpath === 'templates'
              ? { changeRequest: userFeedback, additionalRequest: userFeedback }
              : {}),
          },
        };
      }

      const carried = applyLastGeneratedAsProductImage(nextIg);
      if (!carried) {
        newMessages.push(
          await assistantMsg(
            session.id,
            'Generate an image first, then describe what to change.',
          ),
        );
        const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
        await persist(session, nextWorkflow);
        const updated = await getChatSession(session.id, companyId);
        return packageResult(updated!, nextWorkflow, newMessages);
      }
      nextIg = carried;

      if (nextIg.subpath === 'templates') {
        return runTemplateGenerateFlow(session, workflowState, nextIg, newMessages);
      }
      if (nextIg.subpath === 'productOnModel') {
        return runProductOnModelGenerate(session, workflowState, nextIg, newMessages);
      }

      nextIg = { ...nextIg, step: 'collectFields' };
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, nextIg);
      if (userFeedback?.trim()) {
        await persist(session, nextWorkflow);
        return runGenerateBase(session, nextWorkflow, nextIg, newMessages);
      }
      await persist(session, nextWorkflow);
      newMessages.push(
        await assistantMsg(
          session.id,
          'Tell me what to change — tone, layout, or any details for the new version.',
        ),
      );
      const updated = await getChatSession(session.id, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }

    case 'productOnModel': {
      ig = {
        ...ig,
        subpath: 'productOnModel',
        step: 'modelSelect',
        selectedModelId: undefined,
        selectedBackgroundId: undefined,
        selectedPoseId: undefined,
        customModelAssetId: undefined,
        customModelImageUrl: undefined,
        customBackgroundAssetId: undefined,
        customBackgroundImageUrl: undefined,
        customPoseAssetId: undefined,
        customPoseImageUrl: undefined,
      };
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      newMessages.push(
        await assistantMsg(session.id, 'Choose a model for your product.', 'imageGenModelGallery', {
          ...getCatalogForWidget(),
        }),
      );
      const updated = await getChatSession(session.id, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }

    case 'newProductAd': {
      const preservedAssets = ig.generatedAssets ?? [];
      ig = {
        ...initialImageGenState('productAd'),
        generatedAssets: preservedAssets,
        agentMemory: ig.agentMemory,
        step: 'imageSource',
      };
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      newMessages.push(
        await assistantMsg(
          session.id,
          "Starting a new product ad. Where should the product image come from?",
          'imageGenSourceChoice',
        ),
      );
      const updated = await getChatSession(session.id, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }

    case 'postToAds': {
      const assetIds =
        ig.generatedAssets?.map((g) => g.assetId) ??
        (ig.baseGeneratedAssetId ? [ig.baseGeneratedAssetId] : []);
      return executePushToAds(session.id, companyId, workflowState, assetIds, newMessages);
    }

    default:
      break;
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

export async function handleImageGenAction(
  sessionId: string,
  companyId: string,
  action: ImageGenActionType,
  payload: Record<string, unknown>,
  userMessage?: string | null,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const workflowState = parseWorkflowState(session.workflowState);
  let ig = getIg(workflowState);
  const newMessages: SerializedMessage[] = [];

  const displayText = userMessage?.trim();
  const skipGenericUserBubble =
    action === 'imageGen.uploaded' && Boolean(payload.assetId);
  if (displayText && !skipGenericUserBubble && !shouldSkipActionUserBubble(session.messages, action)) {
    newMessages.push(await userMsg(sessionId, displayText));
  }

  switch (action) {
    case 'imageGen.source': {
      const source = String(payload.source ?? '');
      if (source === 'shopify') {
        ig.step = 'shopifyPick';
        newMessages.push(
          await assistantMsg(session.id, 'Pick a product from your Shopify catalog.', 'shopifyProductPicker'),
        );
      } else {
        ig.step = ig.subpath === 'productOnModel' ? 'customUpload' : 'customUpload';
        newMessages.push(
          await assistantMsg(session.id, 'Upload your product image.', 'imageGenUpload'),
        );
      }
      break;
    }

    case 'imageGen.shopifySelected': {
      const productId = String(payload.productId ?? '');
      const product = await prisma.shopifyProduct.findFirst({
        where: { id: productId, companyId },
      });
      if (!product?.featuredImageUrl) {
        newMessages.push(await assistantMsg(session.id, 'That product has no image. Pick another or upload custom.'));
        break;
      }
      ig.shopifyProductId = productId;
      ig.productDescription = product.description?.slice(0, 2000) ?? product.title;
      try {
        const imported = await importProductImageFromUrl({
          companyId,
          sessionId,
          imageUrl: product.featuredImageUrl,
          title: product.title,
        });
        ig.productImageAssetId = imported.assetId;
        ig.productImageUrl = imported.imageUrl;
      } catch {
        ig.productImageUrl = product.featuredImageUrl;
      }

      newMessages.push(
        await assistantMsg(session.id, `Got **${product.title}**.`, undefined),
      );
      ig = await promptArtistSettings(session, ig, newMessages);
      break;
    }

    case 'imageGen.artistSettings': {
      const artistId = String(payload.artistId ?? ig.imageArtistId ?? DEFAULT_IMAGE_ARTIST_ID);
      const quality = String(payload.quality ?? ig.imageQuality ?? DEFAULT_IMAGE_QUALITY);
      ig.imageArtistId = artistId;
      ig.imageQuality =
        quality === 'low' || quality === 'medium' || quality === 'high'
          ? quality
          : DEFAULT_IMAGE_QUALITY;

      if (ig.subpath === 'productOnModel') {
        const patch = await hydrateFromCompany(companyId, ig);
        ig = { ...ig, ...patch };
        ig.step = 'modelSelect';
        newMessages.push(
          await assistantMsg(session.id, 'Choose a photoshoot model.', 'imageGenModelGallery', {
            ...getCatalogForWidget(),
          }),
        );
      } else if (ig.subpath === 'templates') {
        const patch = await hydrateFromCompany(companyId, ig);
        ig = { ...ig, ...patch };
      } else {
        const autoResult = await beginRivalInspirationOrCollectFields(
          session,
          workflowState,
          ig,
          newMessages,
        );
        if (autoResult) return autoResult;
      }
      break;
    }

    case 'imageGen.rivalInspirationChosen': {
      const enabled = Boolean(payload.enabled);
      const autoRoute = { result: null as OrchestratorResult | null };
      await handleRivalInspirationChosen(
        session,
        enabled,
        imageRivalCallbacks(session, ig, newMessages, workflowState, autoRoute),
      );
      if (autoRoute.result) return autoRoute.result;
      break;
    }

    case 'imageGen.rivalBrandChosen': {
      const brandName =
        payload.brandName === null || payload.brandName === undefined
          ? null
          : String(payload.brandName);
      const autoRoute = { result: null as OrchestratorResult | null };
      await handleRivalBrandChosen(
        session,
        brandName,
        imageRivalCallbacks(session, ig, newMessages, workflowState, autoRoute),
      );
      if (autoRoute.result) return autoRoute.result;
      break;
    }

    case 'imageGen.uploaded': {
      const assetId = String(payload.assetId ?? '');
      const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined;
      const role = typeof payload.role === 'string' ? payload.role : 'product';

      if (!shouldSkipActionUserBubble(session.messages, action)) {
        const attachMsg = await attachmentUserMsg(sessionId, companyId, payload, displayText);
        if (attachMsg) newMessages.push(attachMsg);
        else if (displayText) newMessages.push(await userMsg(sessionId, displayText));
      }

      if (role === 'model') {
        ig.customModelAssetId = assetId;
        if (imageUrl) ig.customModelImageUrl = imageUrl;
        ig.selectedModelId = undefined;
        ig.step = 'backgroundSelect';
        newMessages.push(await assistantMsg(session.id, 'Custom model saved — pick a background.', 'imageGenBackgroundGallery', {
          backgrounds: getCatalogForWidget().backgrounds,
        }));
        break;
      }
      if (role === 'background') {
        ig.customBackgroundAssetId = assetId;
        if (imageUrl) ig.customBackgroundImageUrl = imageUrl;
        ig.selectedBackgroundId = undefined;
        ig.step = 'poseSelect';
        newMessages.push(await assistantMsg(session.id, 'Custom background saved — pick a pose.', 'imageGenPoseGallery', {
          poses: getCatalogForWidget().poses,
        }));
        break;
      }
      if (role === 'pose') {
        ig.customPoseAssetId = assetId;
        if (imageUrl) ig.customPoseImageUrl = imageUrl;
        ig.selectedPoseId = undefined;
        return runProductOnModelGenerate(session, workflowState, ig, newMessages);
      }

      if (ig.subpath === 'templates') {
        const fileName = typeof payload.fileName === 'string' ? payload.fileName : undefined;
        ig.productImageAssetId = assetId;
        if (imageUrl) ig.productImageUrl = imageUrl;
        if (!ig.productDescription && fileName) {
          ig.productDescription = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        }
        ig.step = 'templateNotes';

        const history = (session.messages ?? [])
          .filter((m) => m.content)
          .map((m) => ({
            role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content!,
          }));
        const notes = await runTemplateNotesTurn({
          state: ig,
          userText: '',
          history,
          afterUpload: true,
        });
        ig = { ...ig, ...notes.state, step: 'templateNotes' };
        newMessages.push(await assistantMsg(session.id, notes.reply));
        break;
      }

      ig.productImageAssetId = assetId;
      if (imageUrl) ig.productImageUrl = imageUrl;
      if (!ig.productDescription && typeof payload.description === 'string') {
        ig.productDescription = payload.description;
      }

      newMessages.push(await assistantMsg(session.id, 'Image received.', undefined));
      ig = await promptArtistSettings(session, ig, newMessages);
      break;
    }

    case 'imageGen.variantSource': {
      const source = String(payload.source ?? '');
      if (source === 'existing') {
        ig.step = 'existingAdPick';
        ig.imageSource = 'existing';
        newMessages.push(
          await assistantMsg(session.id, 'Pick an existing ad with an image.', 'imageGenExistingAdPicker'),
        );
      } else if (source === 'attachment') {
        ig.step = 'customUpload';
        ig.imageSource = 'attachment';
        newMessages.push(await assistantMsg(session.id, 'Upload your base image.', 'imageGenUpload'));
      }
      break;
    }

    case 'imageGen.existingAdSelected': {
      const creativeId = String(payload.creativeId ?? '');
      const creative = await prisma.metaCreative.findFirst({
        where: { id: creativeId, metaIntegration: { companyId } },
        include: { asset: true },
      });
      if (!creative) break;
      ig.productImageAssetId = creative.assetId ?? undefined;
      ig.productImageUrl =
        creative.thumbnailUrl ?? creative.imageUrl ?? creative.asset?.thumbnailUrl ?? undefined;
      newMessages.push(await assistantMsg(session.id, 'Using that ad image.', undefined));
      ig = await promptArtistSettings(session, ig, newMessages);
      break;
    }

    case 'imageGen.nextStepChosen': {
      const choiceId = typeof payload.choiceId === 'string' ? payload.choiceId : null;
      const label = typeof payload.label === 'string' ? payload.label : choiceId ?? '';
      const route = await classifyPostResultNext({
        userText: displayText ?? label,
        choiceId,
      });
      return routePostResultNext(
        session,
        companyId,
        workflowState,
        ig,
        route,
        newMessages,
        displayText ?? undefined,
      );
    }

    case 'imageGen.baseAccepted': {
      return routePostResultNext(
        session,
        companyId,
        workflowState,
        { ...ig, baseAccepted: true },
        'variants',
        newMessages,
      );
    }

    case 'imageGen.baseRejected': {
      return routePostResultNext(
        session,
        companyId,
        workflowState,
        ig,
        'regenerate',
        newMessages,
        typeof payload.feedback === 'string' ? payload.feedback : displayText ?? undefined,
      );
    }

    case 'imageGen.ideasAccepted': {
      return runGenerateVariants(session, workflowState, ig, newMessages);
    }

    case 'imageGen.ideasChanged': {
      const changes = Array.isArray(payload.changes)
        ? (payload.changes as Array<{ index: number; description: string }>)
        : [];
      const refUrl = await resolveProductImageUrl(companyId, ig);
      if (!refUrl) throw new Error('Product image missing');
      const variants = await regenerateVariantPrompts({
        state: ig,
        productImageUrl: refUrl,
        changes,
      });
      ig = { ...ig, variants, step: 'reviewIdeas' };
      newMessages.push(
        await assistantMsg(session.id, 'Updated ideas — review below.', 'imageGenIdeaReview', {
          ...buildIdeaReviewWidgetPayload(variants),
        }),
      );
      break;
    }

    case 'imageGen.variantRegenerate': {
      const index = Number(payload.index ?? -1);
      if (index < 0) break;
      return runRegenerateVariant(session, workflowState, ig, index, newMessages);
    }

    case 'imageGen.modelSelected': {
      ig.selectedModelId = String(payload.modelId ?? '');
      ig.customModelAssetId = undefined;
      ig.customModelImageUrl = undefined;
      ig.step = 'backgroundSelect';
      newMessages.push(
        await assistantMsg(session.id, 'Pick a background.', 'imageGenBackgroundGallery', {
          backgrounds: getCatalogForWidget().backgrounds,
        }),
      );
      break;
    }

    case 'imageGen.backgroundSelected': {
      ig.selectedBackgroundId = String(payload.backgroundId ?? '');
      ig.customBackgroundAssetId = undefined;
      ig.customBackgroundImageUrl = undefined;
      ig.step = 'poseSelect';
      newMessages.push(
        await assistantMsg(session.id, 'Pick a pose.', 'imageGenPoseGallery', {
          poses: getCatalogForWidget().poses,
        }),
      );
      break;
    }

    case 'imageGen.poseSelected': {
      ig.selectedPoseId = String(payload.poseId ?? '');
      ig.customPoseAssetId = undefined;
      ig.customPoseImageUrl = undefined;
      return runProductOnModelGenerate(session, workflowState, ig, newMessages);
    }

    case 'imageGen.onModelAccepted': {
      ig.step = 'chooseNext';
      newMessages.push(
        await assistantMsg(
          session.id,
          'What would you like to do next?',
          'imageGenNextStep',
          { options: POST_RESULT_NEXT_OPTIONS, context: 'onModel' },
        ),
      );
      break;
    }

    case 'imageGen.onModelRejected': {
      ig.step = 'collectFields';
      ig.rejectFeedback = typeof payload.feedback === 'string' ? payload.feedback : undefined;
      newMessages.push(await assistantMsg(session.id, 'Tell me what to change and we can regenerate.'));
      break;
    }

    case 'imageGen.pushToAds': {
      const assetIds = Array.isArray(payload.assetIds)
        ? (payload.assetIds as string[])
        : (ig.generatedAssets?.map((g) => g.assetId) ?? []);
      if (!assetIds.length) break;
      return executePushToAds(sessionId, companyId, workflowState, assetIds, newMessages);
    }

    case 'imageGen.templateRegenerate': {
      const index = Number(payload.index ?? -1);
      if (index < 0 || ig.subpath !== 'templates') break;
      ig = await runTemplateRegenerateSlot({
        companyId,
        sessionId,
        ig,
        index,
      });
      const artist = findImageArtist(ig.imageArtistId);
      newMessages.push(
        await assistantMsg(session.id, 'Regenerated output.', 'imageGenTemplateGrid', {
          outputs: ig.templateOutputs,
          artistName: artist.name,
          imageQuality: ig.imageQuality,
        }),
      );
      break;
    }

    default:
      break;
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(sessionId, companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}
