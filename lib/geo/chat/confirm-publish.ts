/** User explicitly confirmed a pending publish action. */
export function userConfirmedPublish(userText: string): boolean {
  const t = userText.trim().toLowerCase();
  return (
    /^(yes|yep|yeah|confirm|confirmed|go ahead|do it|publish now|please publish|ok publish)/.test(
      t,
    ) ||
    /\b(yes,? )?(publish|go ahead and publish|confirm publish)/.test(t)
  );
}
