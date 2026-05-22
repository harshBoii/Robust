import type { WorkflowState } from '@/lib/chats/types';

import { DEFAULT_IMAGE_ARTIST_ID, DEFAULT_IMAGE_QUALITY } from './image-artists';

import type { ImageGenState, ImageGenSubpath } from './types';

export function parseImageGenState(workflowState: WorkflowState): ImageGenState | null {
  const raw = workflowState.imageGen;
  if (!raw || typeof raw !== 'object') return null;
  return raw as ImageGenState;
}

export function mergeImageGenIntoWorkflow(
  workflowState: WorkflowState,
  imageGen: ImageGenState,
): WorkflowState {
  return { ...workflowState, imageGen };
}

export function initialImageGenState(subpath: ImageGenSubpath): ImageGenState {
  const base: ImageGenState = {
    subpath,
    step: subpath === 'templates' ? 'templateUpload' : 'routing',
    collectorTurns: 0,
    imageArtistId: DEFAULT_IMAGE_ARTIST_ID,
    imageQuality: DEFAULT_IMAGE_QUALITY,
    generatedAssets: [],
  };
  if (subpath === 'templates') {
    base.templateCollectedFields = {};
    base.templateAssetIds = [];
  }
  return base;
}

export function appendGeneratedAsset(
  state: ImageGenState,
  ref: { assetId: string; label?: string; imageUrl?: string },
): ImageGenState {
  const generatedAssets = [...(state.generatedAssets ?? [])];
  generatedAssets.push({
    assetId: ref.assetId,
    label: ref.label,
    imageUrl: ref.imageUrl,
    subpath: state.subpath,
  });
  return { ...state, generatedAssets };
}
