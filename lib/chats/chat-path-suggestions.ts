/**
 * Composer chips for new chats (landing + intent step).
 * Phrasing aligns with top-level classifier paths: ADS | IMAGE_GEN | VIDEO_GEN | GEO.
 */
export const CHATS_INTENT_SUGGESTIONS: readonly string[] = [
  // ADS — Meta campaigns, creatives, publish
  'Post an ad to Meta',
  'Launch a new Meta campaign',
  "Festive campaign for tier-2 Cities in India",
  // ADS — Google Ads
  'Launch a Google Search campaign',
  'Post a Display ad to Google',
  'Create a Performance Max campaign',
  // IMAGE_GEN — product / variant / on-model visuals
  'Create product ad images',
  'Generate ad image variants',
  'Product on model photoshoot',
  // VIDEO_GEN — scripts, HeyGen, UGC / replicate
  'Create a UGC-style video ad',
  'Generate a video ad with HeyGen',
  'Replicate a winning video ad',
  // GEO — organic visibility, bounties, get cited
  "What's my share of voice?",
  'Get cited for a high-value prompt',
  'Share Content on X/Twitter/LinkedIn and website',
];
