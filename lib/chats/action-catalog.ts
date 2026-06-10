import { STATE_PATCH_ALLOWLIST } from './agent-schema';

/** Text appendix for the ad-agent system prompt listing available actions. */
export function buildActionCatalogText(): string {
  return `
## Available actions

Return actions in \`actions\` array (max 5). Each item: { "action": "<name>", "payload": { ... } }.

### Agent-only actions

**state.patch** — patch workflow metadata only (NOT preset fields).
Allowed payload keys ONLY: ${STATE_PATCH_ALLOWLIST.join(', ')} (use agentMemory for session memory; use plan.memory field when possible).
- tone: string (e.g. festive, professional)
- adType: campaign objective enum (OUTCOME_SALES, OUTCOME_TRAFFIC, …)
- trafficOptimizationGoal: LINK_CLICKS | LANDING_PAGE_VIEWS (traffic without pixel)
- intentNotes: free-form notes for your reasoning

**preset.build** — LLM draft of campaign and/or ad set preset (no Meta create).
Payload: { "target": "campaign" | "adset" | "both", "instruction": "what to set/change" }
- Use "both" to draft campaign then ad set in one turn (executor runs campaign first).
- Do NOT use for vague approval — preview only.

**assistant.message** — no state change (prefer empty actions + reply for FAQs).

### Workflow actions (use when appropriate)

**intent.ack** — avoid; use focusStep + widget instead.

**media.source** — { "source": "upload" | "gallery" | "bulk" } (prefer plan.widget mediaSource)
**media.uploaded** / **media.galleryPicked** — after upload (usually widget-driven).

**campaign.choice** — { "choice": "existing" | "new" }
**pixel.answered** — { "hasPixel": boolean, "pixelId"?: string }
**campaign.objectivePicked** — { "objective": "OUTCOME_…", "trafficOptimizationGoal"?: "LINK_CLICKS"|"LANDING_PAGE_VIEWS" }
**campaign.selected** — { "campaignId", "campaignName" }
**campaign.approved** — create campaign on Meta from draft. ONLY when user explicitly confirms Meta create.
**adset.choice** — { "choice": "existing" | "new" }
**adset.selected** — { "adSetId", "adSetName" }
**adset.approved** — create ad set on Meta. ONLY on explicit Meta confirmation.
**creative.mode** — { "mode": "ai" | "csv" }
**creative.csvParsed** — { "groups": GroupModel[] } full replacement (one row per ad from CSV mapper widget)
**preview.approved** / **preview.changes** — after ad preview.
**publish.submit** — { "scheduledAt"?: ISO string }
**workflow.goBack** — { "step": "<ChatWorkflowStep>", "label"?: string }

### Rules

- NEVER emit campaign.approved / adset.approved for vague phrases ("looks good", "ok", "nice").
- NEVER publish.submit until preview is approved.
- For FAQs ("how do I…"), use actions: [] and explain in reply.
- You may complete campaign/ad set BEFORE media if user gives enough detail (preset.build + focusStep mediaSource).
`.trim();
}

export const AGENT_ONLY_ACTIONS = new Set([
  'state.patch',
  'preset.build',
  'assistant.message',
]);

export const SILENT_AGENT_CHAIN_ACTIONS = new Set(['assistant.message']);
