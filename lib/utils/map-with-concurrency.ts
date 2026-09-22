/**
 * Like `Promise.all(items.map(fn))`, but runs at most `limit` calls at once.
 *
 * Use for bulk DB writes: an unbounded Promise.all grabs every pooled connection and
 * stalls every other request (page loads, session checks) until it finishes.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
