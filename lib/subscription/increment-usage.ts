import 'server-only';

/** Usage counters — wire when billing limits are enabled. */
export async function incrementUsage(_companyId: string, _kind: string): Promise<void> {
  void _companyId;
  void _kind;
}
