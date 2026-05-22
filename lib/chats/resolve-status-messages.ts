import type { ImageGenStep } from '@/lib/image-gen/types';
import type { ChatWorkflowStep, WorkflowState } from '@/lib/chats/types';

/** Rotating status lines while the agent auto-fixes Meta / preset errors (Path A). */
export const CHAT_FIXING_STATUS_MESSAGES = [
  'Fixing the idea…',
  'Your own ad plumber on duty…',
  'Patching preset wires…',
  'Untangling Meta validation knots…',
  'Convincing the pixel to show up…',
  'Re-aligning budgets and goals…',
  'On the case — one field at a time…',
  'MacGyvering your ad set…',
  'Running the error repair playbook…',
  'Almost patched — hang tight…',
] as const;

export type ChatStatusContext = {
  busyTone: 'thinking' | 'fixing';
  currentStep: string;
  workflowState: WorkflowState;
};

const IMAGE_GEN_GENERATING_STEPS = new Set<ImageGenStep>([
  'generateBase',
  'generateIdeas',
  'generateVariants',
  'generateOnModel',
  'generateTemplate',
]);

/** Top-level Path A — posting Meta ads. */
const ADS_INTENT: readonly string[] = [
  'Figuring out your ad goal…',
  'Routing you to the right workflow…',
  'Reading between the lines of your brief…',
  'Almost ready to pick a path…',
];

const ADS_MEDIA: readonly string[] = [
  'Scanning your creatives…',
  'Organizing uploads and gallery picks…',
  'Tagging assets for ad sets…',
  'Checking formats and dimensions…',
  'Pairing visuals with your campaign…',
];

const ADS_CAMPAIGN: readonly string[] = [
  'Drafting your campaign…',
  'Sharpening your targeting…',
  "Negotiating with Meta's API…",
  'Sprinkling conversion magic…',
  'Assembling budget atoms…',
  'Polishing preset fields…',
];

const ADS_ADSET: readonly string[] = [
  'Shaping your ad set…',
  'Tuning optimization goals…',
  'Aligning audiences and placements…',
  'Cross-checking bid strategy…',
  'Almost there — hang tight…',
];

const ADS_CREATIVE: readonly string[] = [
  'Writing copy with AI…',
  'Brewing headline ideas…',
  'Teaching robots about ROAS…',
  'Warming up the creative studio…',
  'Becoming the Picasso of ad sets (a newbie Picasso, ofc XD)…',
  'Consulting the algorithm oracle…',
];

const ADS_PUBLISH: readonly string[] = [
  'Preparing your launch checklist…',
  'Double-checking ad previews…',
  'Queueing publish steps…',
  'Final safety pass before go-live…',
];

const ADS_DEFAULT: readonly string[] = [
  'Working on your ads…',
  'One moment…',
  'Almost there — hang tight…',
];

const IMAGE_GEN_FIXING: readonly string[] = [
  'Adjusting your image settings…',
  'Retrying the render pipeline…',
  'Smoothing out a generation hiccup…',
  'Re-syncing your product assets…',
  'On it — your creative plumber is here…',
];

/** Subpath 1 — single product ad image. */
const SP1_COLLECT: readonly string[] = [
  'Gathering your product story…',
  'Noting brand tone and format…',
  'Almost ready to pick a source image…',
];

const SP1_SETUP: readonly string[] = [
  'Opening your product catalog…',
  'Setting up artist & quality…',
  'Locking in reference visuals…',
];

const SP1_GENERATING: readonly string[] = [
  'Rendering your product hero shot…',
  'Painting pixels for your ad frame…',
  'Lighting the product like a studio shoot…',
  'Composing the final creative…',
  'Almost ready to preview…',
];

const SP1_REVIEW: readonly string[] = [
  'Pulling up your generated ad…',
  'Checking composition and copy space…',
];

/** Subpath 2 — ad variants. */
const SP2_SETUP: readonly string[] = [
  'Finding your base creative…',
  'Loading existing ads from the account…',
];

const SP2_IDEAS: readonly string[] = [
  'Brainstorming variant angles…',
  'Drafting A/B hooks and layouts…',
  'Labeling ideas for your review…',
];

const SP2_GENERATING: readonly string[] = [
  'Batching variant frames…',
  'Rendering your ad variations…',
  'Spinning up parallel creatives…',
  'Applying each variant prompt…',
  'Almost done with the set…',
];

const SP2_REVIEW: readonly string[] = [
  'Laying out variants for review…',
  'Packaging previews…',
];

/** Subpath 3 — product on model. */
const SP3_SETUP: readonly string[] = [
  'Choosing product source…',
  'Building your shot list…',
  'Matching model, background & pose…',
];

const SP3_GENERATING: readonly string[] = [
  'Compositing model + product…',
  'Running the on-model photoshoot…',
  'Styling the scene and lighting…',
  'Rendering your lookbook frame…',
  'Almost ready to preview…',
];

const SP3_REVIEW: readonly string[] = [
  'Reviewing your on-model shot…',
];

const IMAGE_GEN_ROUTING: readonly string[] = [
  'Picking your creative path…',
  'Sorting product ad vs variants vs on-model…',
  'Almost there…',
];

const IMAGE_GEN_NEXT: readonly string[] = [
  'Planning your next creative step…',
  'Routing to the right subpath…',
];

function parseImageGen(workflowState: WorkflowState) {
  return workflowState.imageGen ?? null;
}

function isImageGenPath(ctx: ChatStatusContext): boolean {
  if (ctx.currentStep === 'imageGen') return true;
  return Boolean(parseImageGen(ctx.workflowState));
}

function imageGenStatusPool(ig: NonNullable<ReturnType<typeof parseImageGen>>): readonly string[] {
  const { subpath, step } = ig;

  if (IMAGE_GEN_GENERATING_STEPS.has(step)) {
    if (subpath === 'variantGen') return SP2_GENERATING;
    if (subpath === 'productOnModel') return SP3_GENERATING;
    return SP1_GENERATING;
  }

  if (step === 'chooseNext') return IMAGE_GEN_NEXT;

  if (subpath === 'productAd') {
    if (step === 'collectFields') return SP1_COLLECT;
    if (
      step === 'imageSource' ||
      step === 'shopifyPick' ||
      step === 'customUpload' ||
      step === 'artistSettings'
    ) {
      return SP1_SETUP;
    }
    if (step === 'reviewBase') return SP1_REVIEW;
  }

  if (subpath === 'variantGen') {
    if (
      step === 'variantImageSource' ||
      step === 'existingAdPick' ||
      step === 'customUpload'
    ) {
      return SP2_SETUP;
    }
    if (step === 'generateIdeas' || step === 'reviewIdeas') return SP2_IDEAS;
    if (step === 'generateVariants') return SP2_GENERATING;
    if (step === 'reviewBase') return SP2_REVIEW;
  }

  if (subpath === 'templates') {
    if (step === 'templateUpload') return SP1_SETUP;
    if (step === 'templateNotes') return SP1_COLLECT;
    if (step === 'reviewTemplate') return SP1_REVIEW;
  }

  if (subpath === 'productOnModel') {
    if (
      step === 'productSource' ||
      step === 'shopifyPick' ||
      step === 'customUpload' ||
      step === 'artistSettings' ||
      step === 'modelSelect' ||
      step === 'backgroundSelect' ||
      step === 'poseSelect'
    ) {
      return SP3_SETUP;
    }
    if (step === 'reviewOnModel') return SP3_REVIEW;
  }

  if (step === 'routing') return IMAGE_GEN_ROUTING;

  return SP1_SETUP;
}

function adsStatusPool(step: ChatWorkflowStep): readonly string[] {
  if (step === 'intent') return ADS_INTENT;
  if (
    step === 'mediaSource' ||
    step === 'mediaUpload' ||
    step === 'mediaPick' ||
    step === 'mediaAnalyze'
  ) {
    return ADS_MEDIA;
  }
  if (
    step === 'campaignChoice' ||
    step === 'pixelSetup' ||
    step === 'campaignObjective' ||
    step === 'campaignSelect' ||
    step === 'campaignPreset' ||
    step === 'campaignApprove'
  ) {
    return ADS_CAMPAIGN;
  }
  if (
    step === 'adsetChoice' ||
    step === 'adsetSelect' ||
    step === 'adsetPreset' ||
    step === 'adsetApprove'
  ) {
    return ADS_ADSET;
  }
  if (step === 'creativeMode' || step === 'creativeBuild' || step === 'creativeCsv') {
    return ADS_CREATIVE;
  }
  if (step === 'preview' || step === 'publishChoice' || step === 'done') {
    return ADS_PUBLISH;
  }
  return ADS_DEFAULT;
}

export function resolveChatStatusMessages(ctx: ChatStatusContext): readonly string[] {
  if (ctx.busyTone === 'fixing') {
    if (isImageGenPath(ctx)) return IMAGE_GEN_FIXING;
    return CHAT_FIXING_STATUS_MESSAGES;
  }

  const ig = parseImageGen(ctx.workflowState);
  if (ctx.currentStep === 'imageGen' || ig) {
    if (ig) return imageGenStatusPool(ig);
    return IMAGE_GEN_ROUTING;
  }

  return adsStatusPool(ctx.currentStep as ChatWorkflowStep);
}

export function resolveChatStatusLabel(ctx: ChatStatusContext): string {
  if (ctx.busyTone === 'fixing') return 'Fixing…';

  const ig = parseImageGen(ctx.workflowState);
  if ((ctx.currentStep === 'imageGen' || ig) && ig && IMAGE_GEN_GENERATING_STEPS.has(ig.step)) {
    return 'Generating…';
  }
  if (ctx.currentStep === 'imageGen' || ig) return 'Creating…';

  const step = ctx.currentStep as ChatWorkflowStep;
  if (
    step === 'mediaAnalyze' ||
    step === 'creativeBuild' ||
    step === 'campaignPreset' ||
    step === 'adsetPreset'
  ) {
    return 'Building…';
  }
  if (step === 'publishChoice' || step === 'preview') return 'Publishing…';

  return 'Thinking…';
}
