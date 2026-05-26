import 'server-only';

import { heygenFetchJson } from './api';

export type StartVideoAgentInput = {
  prompt: string;
  callbackUrl: string;
  callbackId: string;
};

export async function startVideoAgent(input: StartVideoAgentInput): Promise<unknown> {
  return heygenFetchJson('/v3/video-agents', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      callback_url: input.callbackUrl,
      callback_id: input.callbackId,
    }),
  });
}

export async function getVideoAgentSession(sessionId: string): Promise<unknown> {
  return heygenFetchJson(`/v3/video-agents/${encodeURIComponent(sessionId)}`);
}

export async function getVideo(videoId: string): Promise<unknown> {
  return heygenFetchJson(`/v3/videos/${encodeURIComponent(videoId)}`);
}
