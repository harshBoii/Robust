/**
 * Waits for asset status SSE stream until all assets are READY or ERROR.
 */
export async function waitForAssetsReady(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return;
  const res = await fetch(`/api/assets/status?ids=${encodeURIComponent(assetIds.join(','))}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Asset status stream failed (${res.status})`);
  if (!res.body) throw new Error('Asset status stream missing body');

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';

    for (const p of parts) {
      const line = p.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6)) as { done?: boolean };
      if (payload.done) return;
    }
  }
}
