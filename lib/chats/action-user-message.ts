import { AD_TYPE_LABELS } from '@/lib/assistant/constants';

/** Human-readable line shown as a user bubble when a widget fires an action. */
export function resolveActionUserMessage(
  action: string,
  payload: Record<string, unknown> = {},
): string | null {
  if (typeof payload.userMessage === 'string' && payload.userMessage.trim()) {
    return payload.userMessage.trim();
  }

  switch (action) {
    case 'intent.ack':
      return typeof payload.text === 'string' ? payload.text.trim() : null;
    case 'media.source': {
      const map: Record<string, string> = {
        upload: 'Upload here',
        gallery: 'From gallery',
        bulk: 'Bulk upload',
      };
      const s = String(payload.source ?? '');
      return map[s] ?? null;
    }
    case 'media.galleryPicked':
      return typeof payload.bulkName === 'string' && payload.bulkName.trim()
        ? payload.bulkName.trim()
        : 'Selected from gallery';
    case 'media.uploaded':
      return typeof payload.label === 'string' && payload.label.trim()
        ? payload.label.trim()
        : 'Uploaded creatives';
    case 'campaign.choice':
      return payload.choice === 'existing' ? 'Use existing campaign' : 'Create new campaign';
    case 'pixel.answered':
      if (payload.hasPixel) {
        return payload.pixelId
          ? `Yes — pixel ${String(payload.pixelId).slice(0, 12)}…`
          : 'Yes, I have a Meta Pixel';
      }
      return 'No pixel yet';
    case 'campaign.objectivePicked': {
      const obj = String(payload.objective ?? '');
      const label =
        AD_TYPE_LABELS[obj as keyof typeof AD_TYPE_LABELS] ?? obj.replace(/^OUTCOME_/, '');
      const goal = payload.trafficOptimizationGoal;
      if (goal === 'LINK_CLICKS') return `${label} — link clicks`;
      if (goal === 'LANDING_PAGE_VIEWS') return `${label} — landing page views`;
      return label || null;
    }
    case 'campaign.selected':
      return typeof payload.campaignName === 'string' && payload.campaignName.trim()
        ? payload.campaignName.trim()
        : null;
    case 'adset.choice':
      return payload.choice === 'existing' ? 'Use existing ad set' : 'Create new ad set';
    case 'adset.selected':
      return typeof payload.adSetName === 'string' && payload.adSetName.trim()
        ? payload.adSetName.trim()
        : null;
    case 'creative.mode':
      return payload.mode === 'csv' ? 'Upload CSV' : 'Write copy with AI';
    case 'campaign.approved':
    case 'adset.approved':
      return 'Approve preset';
    case 'preview.approved':
      return 'Approve ads';
    case 'preview.changes':
      return 'Request changes';
    case 'publish.submit':
      return payload.scheduledAt ? 'Schedule publish' : 'Publish now';
    case 'workflow.goBack':
      return typeof payload.label === 'string'
        ? payload.label.trim()
        : payload.step
          ? 'Go back'
          : 'Go back';
    case 'creative.csvParsed':
      return 'Applied CSV copy';
    case 'imageGen.source':
      return payload.source === 'shopify' ? 'Shopify product' : 'Custom upload';
    case 'imageGen.shopifySelected':
      return typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : 'Selected product';
    case 'imageGen.uploaded': {
      const role = payload.role;
      if (role === 'model') return 'Uploaded custom model';
      if (role === 'background') return 'Uploaded custom background';
      if (role === 'pose') return 'Uploaded custom pose';
      return 'Uploaded product image';
    }
    case 'imageGen.artistSettings': {
      const artist = typeof payload.artistId === 'string' ? payload.artistId : '';
      const q = typeof payload.quality === 'string' ? payload.quality : '';
      return q ? `${artist} · ${q} quality` : 'Artist settings';
    }
    case 'imageGen.variantSource':
      return payload.source === 'existing' ? 'Existing ads' : 'Upload image';
    case 'imageGen.existingAdSelected':
      return 'Selected existing ad';
    case 'imageGen.baseAccepted':
      return 'Accept — create variants';
    case 'imageGen.baseRejected':
      return 'Request changes';
    case 'imageGen.nextStepChosen':
      return typeof payload.label === 'string' ? payload.label : 'Next step';
    case 'imageGen.ideasAccepted':
      return 'Accept all ideas';
    case 'imageGen.ideasChanged':
      return 'Update ideas';
    case 'imageGen.variantRegenerate':
      return 'Regenerate variant';
    case 'imageGen.modelSelected':
    case 'imageGen.backgroundSelected':
    case 'imageGen.poseSelected':
      return typeof payload.label === 'string' ? payload.label : null;
    case 'imageGen.pushToAds':
      return 'Post to ads';
    default:
      return null;
  }
}
