import 'server-only';

/** Log raw microservice JSON for debugging (server logs only). */
export function logMicroserviceResponse(label: string, payload: unknown): void {
  try {
    const text = JSON.stringify(payload, null, 2);
    const max = 12_000;
    console.log(
      `[microservice:${label}]`,
      text.length > max ? `${text.slice(0, max)}… [truncated]` : text,
    );
  } catch {
    console.log(`[microservice:${label}]`, payload);
  }
}
