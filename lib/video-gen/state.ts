import type { WorkflowState } from '@/lib/chats/types';

import type { VideoGenState, VideoGenSubpath } from './types';

export function parseVideoGenState(workflowState: WorkflowState): VideoGenState | null {
  const vg = workflowState.videoGen;
  if (!vg || typeof vg !== 'object') return null;
  if (!vg.subpath || !vg.step) return null;
  return vg as VideoGenState;
}

export function initialVideoGenState(subpath: VideoGenSubpath): VideoGenState {
  if (subpath === 'learnAndBuild') {
    return { subpath, step: 'fetchTopAds' };
  }
  if (subpath === 'replicate') {
    return { subpath, step: 'adLibraryPick' };
  }
  return { subpath, step: 'routing' };
}

export function mergeVideoGenIntoWorkflow(
  workflowState: WorkflowState,
  videoGen: VideoGenState,
): WorkflowState {
  return { ...workflowState, videoGen };
}

/** Remove secrets before sending workflowState to the browser. */
export function sanitizeVideoGenForClient(
  videoGen: VideoGenState | undefined,
): VideoGenState | undefined {
  if (!videoGen) return undefined;
  const { directorPrompt: _d, ...rest } = videoGen;
  return rest;
}

export function sanitizeWorkflowStateForClient(state: WorkflowState): WorkflowState {
  if (!state.videoGen) return state;
  return {
    ...state,
    videoGen: sanitizeVideoGenForClient(state.videoGen),
  };
}
