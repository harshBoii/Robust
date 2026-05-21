import 'server-only';

import type { WidgetChoiceOption } from '@/lib/chats/classify-widget-choice';
import type { ImageGenActionType } from './types';
import type { ImageGenState } from './types';
import {
  BACKGROUND_CATALOG,
  findBackground,
  findModel,
  findPose,
  MODEL_CATALOG,
  POSE_CATALOG,
} from './catalog';

const UPLOAD_OPTION: WidgetChoiceOption = {
  optionId: '__upload__',
  label: 'Upload your own',
  description: 'User provides a custom image file via upload',
};

export function imageGenStepDescription(step: ImageGenState['step']): string {
  switch (step) {
    case 'modelSelect':
      return 'Choose a photoshoot model';
    case 'backgroundSelect':
      return 'Choose a background scene';
    case 'poseSelect':
      return 'Choose a pose reference';
    case 'imageSource':
      return 'Choose product image source';
    case 'productSource':
      return 'Choose product image source for on-model photoshoot';
    case 'variantImageSource':
      return 'Choose base image source for variants';
    default:
      return step;
  }
}

export function optionsForImageGenStep(ig: ImageGenState): WidgetChoiceOption[] | null {
  switch (ig.step) {
    case 'modelSelect':
      return [
        ...MODEL_CATALOG.map((m) => ({
          optionId: m.id,
          label: m.label,
          description: `${m.category} model`,
        })),
        UPLOAD_OPTION,
      ];
    case 'backgroundSelect':
      return [
        ...BACKGROUND_CATALOG.map((b) => ({ optionId: b.id, label: b.label })),
        { ...UPLOAD_OPTION, label: 'Upload your own background' },
      ];
    case 'poseSelect':
      return [
        ...POSE_CATALOG.map((p) => ({ optionId: p.id, label: p.label })),
        { ...UPLOAD_OPTION, label: 'Upload your own pose reference' },
      ];
    case 'imageSource':
    case 'productSource':
      return [
        { optionId: 'shopify', label: 'Shopify product' },
        { optionId: 'custom', label: 'Upload product image' },
      ];
    case 'variantImageSource':
      return [
        { optionId: 'existing', label: 'Existing ad with image' },
        { optionId: 'attachment', label: 'Upload image' },
      ];
    default:
      return null;
  }
}

export type ImageGenChoiceDispatch =
  | { kind: 'action'; action: ImageGenActionType; payload: Record<string, unknown> }
  | { kind: 'upload_hint'; role: 'model' | 'background' | 'pose' };

export function dispatchForImageGenChoice(
  step: ImageGenState['step'],
  optionId: string,
): ImageGenChoiceDispatch | null {
  if (optionId === '__upload__') {
    if (step === 'modelSelect') return { kind: 'upload_hint', role: 'model' };
    if (step === 'backgroundSelect') return { kind: 'upload_hint', role: 'background' };
    if (step === 'poseSelect') return { kind: 'upload_hint', role: 'pose' };
    return null;
  }

  switch (step) {
    case 'modelSelect': {
      const m = findModel(optionId);
      if (!m) return null;
      return {
        kind: 'action',
        action: 'imageGen.modelSelected',
        payload: { modelId: m.id, label: m.label },
      };
    }
    case 'backgroundSelect': {
      const b = findBackground(optionId);
      if (!b) return null;
      return {
        kind: 'action',
        action: 'imageGen.backgroundSelected',
        payload: { backgroundId: b.id, label: b.label },
      };
    }
    case 'poseSelect': {
      const p = findPose(optionId);
      if (!p) return null;
      return {
        kind: 'action',
        action: 'imageGen.poseSelected',
        payload: { poseId: p.id, label: p.label },
      };
    }
    case 'imageSource':
    case 'productSource':
      if (optionId === 'shopify') {
        return {
          kind: 'action',
          action: 'imageGen.source',
          payload: { source: 'shopify' },
        };
      }
      if (optionId === 'custom') {
        return {
          kind: 'action',
          action: 'imageGen.source',
          payload: { source: 'custom' },
        };
      }
      return null;
    case 'variantImageSource':
      if (optionId === 'existing' || optionId === 'attachment') {
        return {
          kind: 'action',
          action: 'imageGen.variantSource',
          payload: { source: optionId },
        };
      }
      return null;
    default:
      return null;
  }
}
