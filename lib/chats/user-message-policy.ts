import type { DbChatMessage } from './repository';

/**
 * Widget/selection actions that should not add a second user bubble when the user
 * just sent a free-text message (e.g. typed a product name, then picked a match).
 */
/** Widget actions: client already shows an optimistic user bubble via dispatchAction. */
export const VIDEO_GEN_WIDGET_ACTIONS_SKIP_SERVER_USER = new Set([
  'videoGen.subpathChosen',
  'videoGen.offeringSelected',
  'videoGen.adTypeSelected',
  'videoGen.trendSubmitted',
  'videoGen.scriptApproved',
  'videoGen.adSelected',
  'videoGen.retryIntel',
]);

export const ACTIONS_SKIP_USER_BUBBLE_AFTER_TYPED = new Set([
  'imageGen.shopifySelected',
  'imageGen.existingAdSelected',
  'imageGen.modelSelected',
  'imageGen.backgroundSelected',
  'imageGen.poseSelected',
  'imageGen.nextStepChosen',
  'imageGen.artistSettings',
  'campaign.selected',
  'adset.selected',
  'media.galleryPicked',
]);

function isUserRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === 'USER';
}

/** Video-gen widget clicks already add an optimistic user bubble on the client. */
export function shouldSkipVideoGenWidgetUserBubble(action: string): boolean {
  return VIDEO_GEN_WIDGET_ACTIONS_SKIP_SERVER_USER.has(action);
}

/** Skip persisting an action user line when the latest row is already the user's typed message. */
export function shouldSkipActionUserBubble(
  messages: { role: string }[] | DbChatMessage[] | undefined,
  action: string,
): boolean {
  if (shouldSkipVideoGenWidgetUserBubble(action)) return true;
  if (!ACTIONS_SKIP_USER_BUBBLE_AFTER_TYPED.has(action)) return false;
  const msgs = messages ?? [];
  if (!msgs.length) return false;
  return isUserRole(msgs[msgs.length - 1]?.role);
}
