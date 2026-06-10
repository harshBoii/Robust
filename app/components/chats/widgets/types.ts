export type ChatWidgetDispatch = (
  action: string,
  payload?: Record<string, unknown>,
  userMessage?: string,
) => Promise<void>;
