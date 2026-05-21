import 'server-only';

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

import { buildProductAdBasePrompt, buildProductOnModelPrompt } from './base-prompts';
import { batchGenerateVariants } from './batch-generate';
import {
  classifyPostResultNext,
  POST_RESULT_NEXT_OPTIONS,
  type PostResultNextRoute,
} from './classify-post-result-next';
import { tryHandleImageGenEmptyPickerTurn } from '@/lib/chats/handle-empty-picker-turn';
import { classifyImageGenSubpath } from './classify-subpath';
import { runCollectorTurn } from './collect-fields-agent';
import { findBackground, findModel, findPose, getCatalogForWidget } from './catalog';
import {
  findImageArtist,
  IMAGE_ARTISTS,
  IMAGE_QUALITY_OPTIONS,
} from './image-artists';
import { generateImage } from './generate-image';
import { importProductImageFromUrl } from './import-product-image';
import { appendGeneratedAsset, initialImageGenState, mergeImageGenIntoWorkflow, parseImageGenState } from './state';
import { storeGeneratedImage } from './store-generated';
import type { ImageGenActionType, ImageGenState, ImageGenSubpath, ImageGenWidgetType } from './types';
import { generateVariantPrompts, regenerateVariantPrompts } from './variant-prompts';

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
  const q = ig.imageQuality ?? 'medium';
  return `Generating with ${artist.name} · ${q} quality…`;
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
      'Pick your image artist and quality. Mr Adicasso is the best in the game; Mr Crafta is a solid budget option; Tintin is the cheaper pick.',
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

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function resolveProductImageUrl(
  companyId: string,
  ig: ImageGenState,
): Promise<string | null> {
  if (ig.productImageUrl) return ig.productImageUrl;
  if (!ig.productImageAssetId) return null;
  const asset = await prisma.asset.findFirst({
    where: { id: ig.productImageAssetId, companyId },
    select: { thumbnailUrl: true, r2Key: true, r2Bucket: true },
  });
  return asset?.thumbnailUrl ?? null;
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

  const newMessages: SerializedMessage[] = [];
  newMessages.push(await userMsg(sessionId, text));

  if (ig.step === 'collectFields') {
    const history = (session.messages ?? [])
      .filter((m) => m.content)
      .map((m) => ({
        role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content!,
      }));

    const result = await runCollectorTurn({ state: ig, userText: text, history });
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
    const refUrl = await resolveProductImageUrl(session.companyId, ig);
    if (!refUrl) throw new Error('Product image is missing');

    const prompt = buildProductAdBasePrompt(ig, ig.rejectFeedback);
    const gen = await generateImage({
      prompt,
      referenceImageUrl: refUrl,
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
    workflowState.lastOperationError = e instanceof Error ? e.message : 'Generation failed';
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
        `Here are ${variants.length} creative ideas. Accept all to generate, or tell me which to change.`,
        'imageGenIdeaReview',
        { ideas: variants.map((v) => v.ideaLabel) },
      ),
    );
  } catch (e) {
    workflowState.lastOperationError = e instanceof Error ? e.message : 'Failed to generate ideas';
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
): Promise<OrchestratorResult> {
  const newMessages: SerializedMessage[] = [];
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

    const batch = await batchGenerateVariants({
      companyId: session.companyId,
      sessionId: session.id,
      referenceImageUrl: refUrl,
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
    workflowState.lastOperationError = e instanceof Error ? e.message : 'Batch generation failed';
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

  const variants = [...(ig.variants ?? [])];
  variants[index] = { ...variants[index], status: 'pending' };

  const batch = await batchGenerateVariants({
    companyId: session.companyId,
    sessionId: session.id,
    referenceImageUrl: refUrl,
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
  const model = findModel(ig.selectedModelId ?? '');
  const bg = findBackground(ig.selectedBackgroundId ?? '');
  const pose = findPose(ig.selectedPoseId ?? '');
  if (!model || !bg || !pose) throw new Error('Model, background, or pose not selected');

  newMessages.push(await assistantMsg(session.id, generatingLabel(ig), 'imageGenGenerating'));

  try {
    const refUrl = await resolveProductImageUrl(session.companyId, ig);
    if (!refUrl) throw new Error('Product image missing');

    const prompt = buildProductOnModelPrompt(
      ig,
      { modelLabel: model.label, backgroundLabel: bg.label, poseLabel: pose.label },
      ig.rejectFeedback,
    );
    const gen = await generateImage({
      prompt,
      referenceImageUrl: refUrl,
      aspectRatio: ig.aspectRatio,
      imageArtistId: ig.imageArtistId,
      quality: ig.imageQuality,
    });
    const stored = await storeGeneratedImage({
      companyId: session.companyId,
      sessionId: session.id,
      imageBase64: gen.imageBase64,
      title: 'Product on model',
      label: `${model.label} · ${pose.label}`,
    });

    ig = appendGeneratedAsset(
      {
        ...ig,
        step: 'reviewOnModel',
        onModelGeneratedAssetId: stored.assetId,
        onModelGeneratedImageUrl: stored.imageUrl,
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
    workflowState.lastOperationError = e instanceof Error ? e.message : 'Generation failed';
    ig.step = 'poseSelect';
    newMessages.push(await assistantMsg(session.id, 'Generation failed — try another pose or background.'));
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(session.id, session.companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}

function transitionToVariantGenFromProductAd(
  _workflowState: WorkflowState,
  ig: ImageGenState,
): ImageGenState {
  return {
    ...ig,
    subpath: 'variantGen',
    carryOverFromSubpath1: true,
    imageSource: 'carriedOver',
    step: 'collectFields',
    productImageAssetId: ig.baseGeneratedAssetId ?? ig.productImageAssetId,
    productImageUrl: ig.baseGeneratedImageUrl ?? ig.productImageUrl,
    copyCount: ig.copyCount ?? 4,
  };
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
      ig = transitionToVariantGenFromProductAd(workflowState, ig);
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await persist(session, nextWorkflow);
      if (ig.productDescription && ig.brandTone && ig.copyCount) {
        return runGenerateIdeas(session, nextWorkflow, ig, newMessages);
      }
      newMessages.push(
        await assistantMsg(
          session.id,
          'Building variants from your image. How many copies do you want (1–8), and any tone tweaks?',
        ),
      );
      const updated = await getChatSession(session.id, companyId);
      return packageResult(updated!, nextWorkflow, newMessages);
    }

    case 'regenerate': {
      if (ig.subpath === 'productOnModel') {
        ig.rejectFeedback = userFeedback;
        return runProductOnModelGenerate(session, workflowState, ig, newMessages);
      }
      ig.rejectFeedback = userFeedback;
      ig.step = 'collectFields';
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      if (userFeedback?.trim() && ig.productImageAssetId) {
        await persist(session, nextWorkflow);
        return runGenerateBase(session, nextWorkflow, ig, newMessages);
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
  if (displayText && !shouldSkipActionUserBubble(session.messages, action)) {
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
      const artistId = String(payload.artistId ?? ig.imageArtistId ?? 'crafta');
      const quality = String(payload.quality ?? ig.imageQuality ?? 'medium');
      ig.imageArtistId = artistId;
      ig.imageQuality =
        quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'medium';

      if (ig.subpath === 'productOnModel') {
        ig.step = 'modelSelect';
        newMessages.push(
          await assistantMsg(session.id, 'Choose a photoshoot model.', 'imageGenModelGallery', {
            ...getCatalogForWidget(),
          }),
        );
      } else {
        ig.step = 'collectFields';
        const artist = findImageArtist(ig.imageArtistId);
        newMessages.push(
          await assistantMsg(
            session.id,
            `${artist.name} · ${ig.imageQuality} quality. Share product description, brand tone, and how many copies you want.`,
          ),
        );
      }
      break;
    }

    case 'imageGen.uploaded': {
      const assetId = String(payload.assetId ?? '');
      const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined;
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
      return runGenerateVariants(session, workflowState, ig);
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
          ideas: variants.map((v) => v.ideaLabel),
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

    default:
      break;
  }

  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await persist(session, nextWorkflow);
  const updated = await getChatSession(sessionId, companyId);
  return packageResult(updated!, nextWorkflow, newMessages);
}
