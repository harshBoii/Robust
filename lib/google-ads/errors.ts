export type GoogleAdsErrorPayload = {
  title?: string;
  message: string;
  code?: string;
  details?: unknown;
};

export class GoogleAdsApiError extends Error {
  readonly gads: GoogleAdsErrorPayload;

  constructor(gads: GoogleAdsErrorPayload, cause?: unknown) {
    super(gads.message);
    this.name = 'GoogleAdsApiError';
    this.gads = gads;
    if (cause instanceof Error) this.cause = cause;
  }
}

export function googleAdsErrorFromUnknown(err: unknown): {
  status: number;
  error: string;
  gadsError?: GoogleAdsErrorPayload;
} {
  if (err instanceof GoogleAdsApiError) {
    return { status: 400, error: err.gads.message, gadsError: err.gads };
  }
  if (err instanceof Error) {
    return { status: 500, error: err.message };
  }
  return { status: 500, error: 'Request failed' };
}

/** Shape an error thrown by google-ads-api into our standard error. */
export function googleAdsErrorFromRaw(err: unknown): GoogleAdsApiError {
  if (err instanceof GoogleAdsApiError) return err;

  // google-ads-api throws objects with a `errors` array
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // gRPC / REST error shape
    const errors = obj['errors'] as Array<Record<string, unknown>> | undefined;
    if (errors?.length) {
      const first = errors[0];
      const msg =
        (first['message'] as string | undefined) ||
        (first['errorCode'] as string | undefined) ||
        'Google Ads API error';
      return new GoogleAdsApiError({ message: msg, details: errors }, err);
    }
    if (typeof obj['message'] === 'string') {
      return new GoogleAdsApiError({ message: obj['message'] }, err);
    }
  }

  return new GoogleAdsApiError({ message: String(err) }, err);
}
