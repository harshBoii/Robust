import type { WorkflowState } from '@/lib/chats/types';

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
  return {
    subpath,
    step: 'routing',
    collectorTurns: 0,
    generatedAssets: [],
  };
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
