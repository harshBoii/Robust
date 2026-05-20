import 'server-only';

export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  return null;
}

export function getRequestUserAgent(request: Request): string | null {
  const ua = request.headers.get('user-agent')?.trim();
  return ua ? ua.slice(0, 500) : null;
}
