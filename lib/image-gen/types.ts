export type ImageGenSubpath = 'productAd' | 'variantGen' | 'productOnModel';

export type ImageGenStep =
  | 'routing'
  | 'imageSource'
  | 'shopifyPick'
  | 'customUpload'
  | 'productSource'
  | 'collectFields'
  | 'generateBase'
  | 'reviewBase'
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
  onModelGeneratedAssetId?: string;
  onModelGeneratedImageUrl?: string;
  generatedAssets?: GeneratedAssetRef[];
  agentMemory?: string;
  rejectFeedback?: string;
};

export type ImageGenActionType =
  | 'imageGen.source'
  | 'imageGen.shopifySelected'
  | 'imageGen.uploaded'
  | 'imageGen.variantSource'
  | 'imageGen.existingAdSelected'
  | 'imageGen.baseAccepted'
  | 'imageGen.baseRejected'
  | 'imageGen.ideasAccepted'
  | 'imageGen.ideasChanged'
  | 'imageGen.variantRegenerate'
  | 'imageGen.modelSelected'
  | 'imageGen.backgroundSelected'
  | 'imageGen.poseSelected'
  | 'imageGen.onModelAccepted'
  | 'imageGen.onModelRejected'
  | 'imageGen.pushToAds';

export const IMAGE_GEN_ACTIONS: ImageGenActionType[] = [
  'imageGen.source',
  'imageGen.shopifySelected',
  'imageGen.uploaded',
  'imageGen.variantSource',
  'imageGen.existingAdSelected',
  'imageGen.baseAccepted',
  'imageGen.baseRejected',
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

export type ImageGenWidgetType =
  | 'imageGenSourceChoice'
  | 'shopifyProductPicker'
  | 'imageGenUpload'
  | 'imageGenGenerating'
  | 'imageGenSingleResult'
  | 'imageGenVariantSource'
  | 'imageGenExistingAdPicker'
  | 'imageGenIdeaReview'
  | 'imageGenVariantGrid'
  | 'imageGenModelGallery'
  | 'imageGenBackgroundGallery'
  | 'imageGenPoseGallery'
  | 'imageGenPushToAds';
