import 'server-only';

/** Shared prompt rule: keep vendor/model details out of user-visible assistant text. */
export const LLM_USER_REPLY_PRIVACY_RULES = `User-facing privacy:
- Never mention OpenAI, Anthropic, Claude, ChatGPT, GPT, DALL·E, Gemini, or any other model vendor or model name.
- Never quote API errors, HTTP status codes, request IDs, or support URLs in replies shown to the user.
- Refer generically to generation, the image service, or AI when needed.`;

function containsProviderLeak(message: string): boolean {
  return /\b(openai|anthropic|claude|chatgpt|gpt-|dall-?e|gemini|llama)\b/i.test(message);
}

function looksLikeVendorApiError(message: string): boolean {
  return (
    containsProviderLeak(message) ||
    /req_[a-z0-9]+/i.test(message) ||
    /help\.openai\.com/i.test(message) ||
    /https?:\/\//i.test(message) ||
    /\b(401|403|500|502|503|504)\b/.test(message)
  );
}

export function logLlmOperationError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${context}]`, error.message, error);
    return;
  }
  console.error(`[${context}]`, error);
}

export function sanitizeUserFacingLlmError(raw: string | undefined | null): string {
  const message = (raw ?? '').trim();
  if (!message) return 'Something went wrong. Please try again.';

  const lower = message.toLowerCase();

  if (
    lower.includes('server had an error') ||
    lower.includes('internal server error') ||
    lower.includes('service unavailable') ||
    lower.includes('bad gateway') ||
    /\b500\b/.test(message) ||
    /\b502\b/.test(message) ||
    /\b503\b/.test(message) ||
    /\b504\b/.test(message)
  ) {
    return 'The image service is temporarily unavailable. Please try again in a moment.';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests') || /\b429\b/.test(message)) {
    return 'Too many requests right now. Please wait a moment and try again.';
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Generation took too long. Please try again.';
  }

  if (
    lower.includes('content policy') ||
    lower.includes('safety system') ||
    lower.includes('moderation') ||
    lower.includes('violat')
  ) {
    return 'We could not generate this image from the current prompt or references. Try adjusting your notes.';
  }

  if (lower.includes('could not load reference image')) {
    return 'We could not load one of your reference images. Try re-uploading a JPEG or PNG.';
  }

  if (lower.includes('returned no data') || lower.includes('returned no image')) {
    return 'No image was returned. Please try again.';
  }

  if (looksLikeVendorApiError(message) || message.length > 120) {
    return 'Something went wrong while generating your image. Please try again.';
  }

  return message;
}

export function handleUserFacingLlmError(context: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  logLlmOperationError(context, error);
  return sanitizeUserFacingLlmError(raw);
}
