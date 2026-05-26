import { isHeygenFailedStatus, isHeygenTerminalStatus } from './extractors';

export function progressMessageForStatus(
  status: string | null | undefined,
  opts?: { hasVideoId?: boolean },
): string {
  if (!status) {
    return opts?.hasVideoId
      ? 'Video assigned, checking render status…'
      : 'Waiting for HeyGen to assign a video…';
  }

  const s = status.toLowerCase();

  if (isHeygenFailedStatus(s)) return 'Video generation failed.';
  if (isHeygenTerminalStatus(s)) return 'Finished rendering, delivering to your library…';

  if (!opts?.hasVideoId) {
    return 'Agent session in progress, waiting for video assignment…';
  }

  if (s === 'processing' || s === 'pending' || s === 'queued' || s === 'running') {
    return 'Still rendering your video…';
  }

  if (s === 'waiting' || s === 'delivering') {
    return 'Finished rendering, waiting for delivery…';
  }

  return `Status: ${status}`;
}
