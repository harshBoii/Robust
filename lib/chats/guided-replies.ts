import 'server-only';

import type { AgentActionableStep } from './agent-steps';
import type { WorkflowState } from './types';

function groupCount(state: WorkflowState): number {
  return state.groups?.filter((g) => g.included !== false).length ?? state.groups?.length ?? 0;
}

function memorySnippet(state: WorkflowState): string {
  const parts: string[] = [];
  if (state.intentNotes) parts.push(state.intentNotes);
  if (state.agentMemory) parts.push(state.agentMemory);
  if (state.tone) parts.push(`${state.tone} tone`);
  return parts.length ? ` (${parts.join(' · ')})` : '';
}

/** Default guiding copy when the model reply is missing or too thin. */
export function buildGuidedReply(
  nextStep: AgentActionableStep,
  state: WorkflowState,
  opts?: { userText?: string },
): string {
  const n = groupCount(state);
  const mem = memorySnippet(state);

  switch (nextStep) {
    case 'choose_media':
      if (n > 0) {
        return `You have **${n}** creative group${n === 1 ? '' : 's'} ready. Next we'll connect them to a Meta campaign and ad set${mem}. Use the options below to add more creatives if needed, or continue once you're happy with the set.`;
      }
      return `Let's get your Mother's Day / tier-2 India campaign started${mem}. **Step 1 is creatives** — upload images and videos, pick from your gallery, or bulk-upload. Once we have assets, we'll draft your **campaign** (budget, objective) and **ad set** (Tamil Nadu / tier-2 targeting). Choose how you'd like to add creatives below.`;

    case 'setup_campaign':
      return n > 0
        ? `Your **${n} creative group${n === 1 ? '' : 's'}** are in. **Step 2 is the campaign** on Meta — use an existing campaign or create a new one${mem}. Pick an option below; after that we'll set up the ad set and ad copy.`
        : `Next we'll set up your **Meta campaign**${mem}. Tell me below if you want an **existing campaign** or a **new** one.`;

    case 'confirm_pixel':
      return `Before we draft the campaign, we need to know if you have a **Meta Pixel** (required for Sales and website Leads). Traffic, Engagement, and Awareness can run without one. Answer below, then we'll pick your objective and budget.`;

    case 'pick_objective':
      return `Choose a **campaign objective** below (Traffic, Sales, Leads, etc.)${mem}. I'll use it when we draft your campaign preset — budget and schedule come right after.`;

    case 'create_preset':
      return `I'll draft your **campaign and ad set** presets from what you've told me${mem} — objective, budget, and tier-2 / Tamil Nadu targeting where we have enough detail. Review the draft card below and tell me what to change, or say when you're ready for creatives.`;

    case 'review_preset':
      return `Here's your **campaign preset** draft${mem}. Check objective, budget, and names below. When it looks right, use **Approve** only if you want to create it on Meta now — otherwise ask for edits.`;

    case 'choose_adset':
      return `Campaign is set. **Step 3 is the ad set** — attach an existing ad set or create a new one with targeting and budget${mem}. Choose below.`;

    case 'create_adset_preset':
      return `Describe your **ad set** — daily budget, schedule, and audience (e.g. tier-2 cities, Tamil Nadu)${mem}. I'll align it with your campaign and show a draft to review.`;

    case 'review_adset':
      return `Review your **ad set preset** below — targeting, budget, and optimization${mem}. Approve on Meta only when you're sure; otherwise ask for changes.`;

    case 'choose_creative_mode':
      return n > 0
        ? `**Step 4 — ad copy** for your **${n} group${n === 1 ? '' : 's'}**. Use **AI** to analyze videos/images and write headlines and primary text, or **CSV** if you already have copy. Pick one option below.`
        : `How should we fill in **ad copy** for each creative group? Choose AI or CSV below.`;

    case 'analyze_ads':
      return n > 0
        ? `Generating **AI ad copy** for **${n} creative group${n === 1 ? '' : 's'}** now. This can take a minute per video — you'll get a preview when it's done.`
        : `Starting AI copy generation. Hang tight while we analyze your creatives.`;

    case 'preview_ads':
      return `Here's your **ad preview**${mem}. Check headlines, text, and links for each group. Approve to move to publish, or tell me what to change.`;

    case 'publish':
      return `Looks good to publish. Choose **post now** or **schedule** below, and we'll queue your ads to Meta.`;

    default:
      return `Here's what to do next — use the card below to continue${mem}.`;
  }
}

const GENERIC_REPLY_PATTERNS = [
  /^what would you like to do next/i,
  /^use the options below/i,
  /^here's what to do next$/i,
];

export function enrichAgentReply(
  reply: string,
  nextStep: AgentActionableStep,
  state: WorkflowState,
): string {
  const trimmed = reply.trim();
  const tooShort = trimmed.length < 100;
  const generic = GENERIC_REPLY_PATTERNS.some((p) => p.test(trimmed));

  if (!tooShort && !generic) return trimmed;

  const guided = buildGuidedReply(nextStep, state);
  if (generic || trimmed.length < 40) return guided;
  return `${trimmed}\n\n${guided}`;
}
