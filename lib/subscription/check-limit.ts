import 'server-only';

/** Subscription / quota enforcement — wire when billing limits are enabled. */
export async function requireLimit(_companyId: string, _kind: string): Promise<void> {
  void _companyId;
  void _kind;
}
