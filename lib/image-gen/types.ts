import type { BrandDnaStructured } from './brand-dna-llm-types';

export type ImageGenSubpath = 'productAd' | 'variantGen' | 'productOnModel' | 'templates';

export type ImageGenStep =
  | 'routing'
  | 'imageSource'
  | 'shopifyPick'
  | 'customUpload'
  | 'artistSettings'
  | 'productSource'
  | 'collectFields'
  | 'templateUpload'
  | 'templateNotes'
  | 'generateBase'
  | 'reviewBase'
  | 'chooseNext'
  | 'generateTemplate'
  | 'reviewTemplate'
  | 'variantImageSource'
  | 'existingAdPick'
  | 'generateIdeas'
  | 'reviewIdeas'
  | 'generateVariants'
  | 'modelSelect'
  | 'backgroundSelect'
  | 'poseSelect'
  | 'generateOnModel'
  | 'reviewOnModel'
  | 'rivalInspirationAsk'
  | 'rivalBrandPick'
  | 'done';

export type ImageGenVariantStatus = 'pending' | 'done' | 'failed';

export type ImageGenVariant = {
  ideaLabel: string;
  prompt: string;
  assetId?: string;
  imageUrl?: string;
  status?: ImageGenVariantStatus;
  error?: string;
};

export type GeneratedAssetRef = {
  assetId: string;
  label?: string;
  subpath: string;
  imageUrl?: string;
};

export type ImageGenState = {
  subpath: ImageGenSubpath;
  step: ImageGenStep;
  productImageAssetId?: string;
  productImageUrl?: string;
  shopifyProductId?: string;
  productDescription?: string;
  brandTone?: string;
  copyCount?: number;
  aspectRatio?: string;
  /** Mr Adicasso / Mr Crafta / Tintin / Mr Adasta */
  imageArtistId?: string;
  imageQuality?: 'low' | 'medium' | 'high';
  collectorTurns?: number;
  baseGeneratedAssetId?: string;
  baseGeneratedImageUrl?: string;
  baseAccepted?: boolean;
  imageSource?: 'existing' | 'attachment' | 'carriedOver';
  variants?: ImageGenVariant[];
  carryOverFromSubpath1?: boolean;
  selectedModelId?: string;
  selectedBackgroundId?: string;
  selectedPoseId?: string;
  customModelAssetId?: string;
  customModelImageUrl?: string;
  customBackgroundAssetId?: string;
  customBackgroundImageUrl?: string;
  customPoseAssetId?: string;
  customPoseImageUrl?: string;
  onModelGeneratedAssetId?: string;
  onModelGeneratedImageUrl?: string;
  generatedAssets?: GeneratedAssetRef[];
  agentMemory?: string;
  rivalInspirationEnabled?: boolean;
  /** null = mix top rivals */
  rivalBrandName?: string | null;
  rivalIntelligenceBrief?: string;
  /** Set when Brand DNA was loaded from BrandEntity at hydrate time */
  brandDnaApplied?: boolean;
  brandDnaStructured?: BrandDnaStructured;
  brandDnaPromptBlock?: string;
  rejectFeedback?: string;
  /** Templates subpath */
  templateId?: string;
  templateCollectedFields?: Record<string, unknown>;
  templateAssetIds?: string[];
  templateOutputs?: Array<{
    label: string;
    assetId?: string;
    imageUrl?: string;
    status: 'pending' | 'done' | 'failed';
    error?: string;
  }>;
};

export type ImageGenActionType =
  | 'imageGen.source'
  | 'imageGen.shopifySelected'
  | 'imageGen.uploaded'
  | 'imageGen.artistSettings'
  | 'imageGen.variantSource'
  | 'imageGen.existingAdSelected'
  | 'imageGen.baseAccepted'
  | 'imageGen.baseRejected'
  | 'imageGen.nextStepChosen'
  | 'imageGen.ideasAccepted'
  | 'imageGen.ideasChanged'
  | 'imageGen.variantRegenerate'
  | 'imageGen.modelSelected'
  | 'imageGen.backgroundSelected'
  | 'imageGen.poseSelected'
  | 'imageGen.onModelAccepted'
  | 'imageGen.onModelRejected'
  | 'imageGen.pushToAds'
  | 'imageGen.templateRegenerate'
  | 'imageGen.rivalInspirationChosen'
  | 'imageGen.rivalBrandChosen';

export const IMAGE_GEN_ACTIONS: ImageGenActionType[] = [
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
  'imageGen.templateRegenerate',
  'imageGen.rivalInspirationChosen',
  'imageGen.rivalBrandChosen',
];

export type ImageGenWidgetType =
  | 'imageGenSourceChoice'
  | 'shopifyProductPicker'
  | 'imageGenUpload'
  | 'imageGenArtistSettings'
  | 'imageGenGenerating'
  | 'imageGenSingleResult'
  | 'imageGenVariantSource'
  | 'imageGenExistingAdPicker'
  | 'imageGenIdeaReview'
  | 'imageGenVariantGrid'
  | 'imageGenModelGallery'
  | 'imageGenBackgroundGallery'
  | 'imageGenPoseGallery'
  | 'imageGenPushToAds'
  | 'imageGenNextStep'
  | 'imageGenTemplateGrid'
  | 'imageGenRivalInspirationChoice'
  | 'imageGenRivalBrandPicker';
