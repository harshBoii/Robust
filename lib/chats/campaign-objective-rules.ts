import { AD_TYPE_LABELS, CAMPAIGN_OBJECTIVE_OPTIONS } from '@/lib/assistant/constants';

export type CampaignObjectiveOption = (typeof CAMPAIGN_OBJECTIVE_OPTIONS)[number];

export type CampaignObjectiveUiOption = {
  value: CampaignObjectiveOption;
  label: string;
  description: string;
  disabled: boolean;
  disabledReason?: string;
};

const NO_PIXEL_TOOLTIP_SALES =
  'Requires a Meta Pixel for conversion tracking. Add a pixel in Meta Events Manager or connect one above.';
const NO_PIXEL_TOOLTIP_LEADS =
  'Website lead forms require a Meta Pixel. Add a pixel first, or choose Traffic, Engagement, or Awareness.';

/** Objectives that need a pixel for typical website conversion / lead setups. */
export function campaignObjectiveRequiresPixel(objective: string): boolean {
  return objective === 'OUTCOME_SALES' || objective === 'OUTCOME_LEADS';
}

export function isCampaignObjectiveAllowed(
  objective: string,
  hasPixel: boolean,
): boolean {
  if (hasPixel) return CAMPAIGN_OBJECTIVE_OPTIONS.includes(objective as CampaignObjectiveOption);
  return !campaignObjectiveRequiresPixel(objective);
}

export function buildCampaignObjectiveOptions(hasPixel: boolean): CampaignObjectiveUiOption[] {
  return CAMPAIGN_OBJECTIVE_OPTIONS.map((value) => {
    const label = AD_TYPE_LABELS[value] ?? value;
    let description = value.replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase();
    let disabled = false;
    let disabledReason: string | undefined;

    if (!hasPixel) {
      if (value === 'OUTCOME_SALES') {
        disabled = true;
        disabledReason = NO_PIXEL_TOOLTIP_SALES;
        description = 'Conversions on your website (pixel required)';
      } else if (value === 'OUTCOME_LEADS') {
        disabled = true;
        disabledReason = NO_PIXEL_TOOLTIP_LEADS;
        description = 'Website lead forms (pixel required)';
      } else if (value === 'OUTCOME_TRAFFIC') {
        description = 'Landing page views or link clicks — no pixel required';
      } else if (value === 'OUTCOME_ENGAGEMENT') {
        description = 'Post engagement, video views — no pixel required';
      } else if (value === 'OUTCOME_AWARENESS') {
        description = 'Reach and impressions — no pixel required';
      } else if (value === 'OUTCOME_APP_PROMOTION') {
        description = 'App installs — no website pixel required';
      }
    }

    return { value, label, description, disabled, disabledReason };
  });
}

export const TRAFFIC_GOAL_OPTIONS = [
  {
    value: 'LINK_CLICKS' as const,
    label: 'Link clicks',
    hint: 'Optimize for clicks to your site',
  },
  {
    value: 'LANDING_PAGE_VIEWS' as const,
    label: 'Landing page views',
    hint: 'Optimize for people who load your landing page',
  },
];
