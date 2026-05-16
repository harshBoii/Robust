export type MetaErrorPayload = {
  title?: string;
  message: string;
  code?: number;
  subcode?: number;
  type?: string;
};

export class MetaApiError extends Error {
  readonly meta: MetaErrorPayload;

  constructor(meta: MetaErrorPayload, cause?: string) {
    super(meta.message);
    this.name = 'MetaApiError';
    this.meta = meta;
  }
}

type MetaGraphErrorShape = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
};

export function metaErrorFromGraph(error: MetaGraphErrorShape | undefined, fallbackStatus: number): MetaApiError {
  const message =
    error?.error_user_msg?.trim() ||
    error?.error_user_title?.trim() ||
    error?.message?.trim() ||
    `Meta API error (${fallbackStatus})`;

  return new MetaApiError({
    title: error?.error_user_title,
    message,
    code: error?.code,
    subcode: error?.error_subcode,
    type: error?.type,
  });
}

export function apiErrorFromUnknown(err: unknown): { status: number; error: string; metaError?: MetaErrorPayload } {
  if (err instanceof MetaApiError) {
    return {
      status: 400,
      error: err.meta.message,
      metaError: err.meta,
    };
  }
  if (err instanceof Error) {
    return { status: 500, error: err.message };
  }
  return { status: 500, error: 'Request failed' };
}
