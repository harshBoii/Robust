import 'server-only';

/** Subscription / quota enforcement — wire when billing limits are enabled. */
export async function requireLimit(_companyId: string, _kind: string): Promise<void> {
  void _companyId;
  void _kind;
}

export class SubscriptionLimitError extends Error {
  usage: number;
  constructor(message: string, usage: number) {
    super(message);
    this.name = 'SubscriptionLimitError';
    this.usage = usage;
  }
}
