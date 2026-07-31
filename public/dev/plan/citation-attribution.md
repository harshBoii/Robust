# Citation Attribution — Measuring Whether Published Pages Actually Get Cited

Turning the GEO radar from a design claim ("we generate AEO-optimised pages") into a
measured result ("this page was retrieved for 12 of 40 questions, up from 3 before publish,
while untreated questions in the same topic moved 1").

Two repos are involved:

- **Robust** (`/Users/mac/Desktop/Robust`) — Next.js app, Prisma/Postgres, owns the data model.
- **Immortel_AI** (`/Users/mac/Desktop/Immortel_AI`) — Python LangGraph microservice, runs the radar.

---

## 0. Correction to the premise before anything gets built

The plan says `parse_responses:1108-1110` already grabs the URL of every search result and
that we throw it away twice. The line references are all exactly right, but the **order of
operations makes it worse than described, and it changes what Step 1 has to do.**

The radar graph (`agent/companyRadar/pipe.py`) runs:

```
run_web_search  →  run_web_search_synth  →  parse_responses  →  aggregate_citations
   (Tavily)          (LLM rewrite)            (extraction)         (rollup)
```

`run_web_search_synth` runs **before** `parse_responses`, and at
`agent/companyRadar/functions.py:1068` it replaces `state["raw_responses"]` wholesale with
`synthesized` — entries of shape `{prompt, model, response: <LLM text>}`. No `results`, no URLs.

The URL-capturing code at `parse_responses:1096-1112` sits behind `if model_name == "tavily"`.
After synthesis, every entry's model is a real LLM name, so **that branch never executes in
production.** It is reachable only via the early return at `functions.py:989-991`, which fires
when the caller sends no models — and `lib/jobs/run-radar.ts:144` always sends three:

```ts
models: ['gpt-5.4-nano', 'claude-haiku-4-5-20251001', 'gemini-3.1-flash-lite-preview'],
```

So the loss is threefold, not twofold:


| #   | Location                                | What is lost                                                                                                                 |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `run_web_search_synth:1068`             | Tavily `results[]` (url, title, score) overwritten before anything reads them                                                |
| 2   | `build_company_radar_api_response:1444` | `raw_responses_with_prompt` is serialised from the *already-overwritten* list, so the HTTP payload never carries URLs either |
| 3   | `aggregate_citations:1183`              | Mention dict keeps only `{prompt, model, name, rank}`                                                                        |


**Consequence:** adding a `sourceUrl` column and populating it from `parse_responses` would
write `NULL` on every row in production. Step 1 has to preserve the Tavily result set
*across* the synth node and ship it through the API contract. That is the actual work.

### Second correction: `sourceUrl` on `Citation` is the wrong shape

`Citation` (`prisma/schema.prisma:1852`) is one row per **company mention extracted from an
LLM answer** — `mentionedName`, `rank`. In the production path those mentions come from
free-text LLM parsing (`parse_responses:1113-1133`) and have no URL associated with them,
ever. A URL is not an attribute of a mention; it is an attribute of **what the search
retrieved**, which is a separate fact at a different grain:

- Tavily searches **once per prompt** (`run_web_search`).
- Synthesis fans out **once per prompt × model**.
- `PromptExecution` is keyed **per prompt × model**.
- Retrieved URLs are therefore **per prompt**, shared across that prompt's three executions.

Modelling this as `Citation.sourceUrl` would triplicate every URL and still leave the
mention→URL link unproven. The plan below introduces a dedicated retrieval-sources table as
the primary record, and keeps a nullable `Citation.sourceUrl` for the narrower, genuinely
useful case: when a named company can be attributed to one of the retrieved domains.

Everything else in the four steps holds up. The sequencing below follows the original intent.

---



## Step 1 — Record which URLs got pulled in

**Goal:** for every radar run, know the exact set of URLs the search retrieved per question,
and whether any of them is one of our published pages.

### 1a. Immortel_AI — stop destroying the evidence

`agent/companyRadar/functions.py`

1. In `run_web_search_synth`, **before** the overwrite at line 1068, extract and stash the
  Tavily results. The loop at 1006-1032 already walks them to build `web_context`; capture
   in the same pass rather than re-walking:
   Note the existing `results[:6]` truncation: only the six results actually fed to the model
   are recorded. That is the correct choice — a URL the LLM never saw cannot have influenced
   the answer, and recording unseen results would inflate the coverage number. Keep the slice,
   and keep it as a named constant so the cap is visible.
2. Populate `state["search_sources"] = []` in the no-models early return (line 989-991) so the
  key is always present, and leave the existing Tavily branch in `parse_responses` untouched —
   it is the fallback path and still works.
3. `class_schema.py` — add `search_sources: list[dict]` to `GeoRadarState`.
4. `build_company_radar_api_response` (line ~1425) — emit a new top-level key:
  ```python
   "retrieved_sources": state.get("search_sources", []),
  ```
   Additive only. No existing key changes shape, so Robust keeps parsing old payloads and
   deployment order does not matter.



### 1b. Robust — persist it

`prisma/schema.prisma` — new models:

```prisma
model RadarRun {
  id          String   @id @default(cuid())
  companyId   String
  startedAt   DateTime @default(now()) @db.Timestamptz(3)
  completedAt DateTime?
  models      String[] @default([])
  promptCount Int      @default(0)
  trigger     String?  @db.VarChar(50)   // "manual" | "cron" | "pre-publish" | "post-publish"
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  sources     RadarPromptSource[]

  @@index([companyId, startedAt(sort: Desc)])
  @@map("radar_runs")
}

model RadarPromptSource {
  id            String   @id @default(cuid())
  runId         String
  promptId      String
  url           String   @db.VarChar(2000)
  normalizedUrl String   @db.VarChar(2000)   // matching key
  domain        String   @db.VarChar(255)
  title         String?  @db.VarChar(1000)
  rank          Int
  score         Float?
  aeoPageId     String?                       // set when normalizedUrl hits a published page
  isOwnDomain   Boolean  @default(false)
  createdAt     DateTime @default(now()) @db.Timestamptz(3)

  run     RadarRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  prompt  Prompt   @relation(fields: [promptId], references: [id], onDelete: Cascade)
  aeoPage AeoPage? @relation(fields: [aeoPageId], references: [id])

  @@unique([runId, promptId, normalizedUrl])
  @@index([runId])
  @@index([aeoPageId])
  @@index([domain])
  @@map("radar_prompt_sources")
}
```

Plus the nullable column the plan asked for, on `Citation` (`schema.prisma:1852`):

```prisma
  sourceUrl String? @db.VarChar(2000)
```

populated only when a mention is attributable (see 1d). Expect it sparse; that is honest.

Back-relations to add: `RadarRun[]` on `Company`, `RadarPromptSource[]` on `Prompt` and
`AeoPage`.

`lib/geo/radar/applyRadarOutput.ts`

- Extend the `RadarOutput` type (line 9) with
`retrieved_sources?: Array<{ prompt: string; rank: number; url: string; title?: string; score?: number }>`.
- Create the `RadarRun` row at the top of `applyRadarOutput` and thread `runId` through.
- After the prompt upsert loop (which already builds `promptMap`, line 219-272), map each
source's `prompt` string → `promptId` and `createMany` the `RadarPromptSource` rows with
`skipDuplicates: true`.
- Leave `parseRadarMicroservicePayload` (line 116) permissive: `retrieved_sources` must stay
optional so a not-yet-deployed microservice does not fail validation.



### 1c. URL matching — the part that decides whether the number is true

New `lib/geo/radar/urlMatch.ts`:

```
normalizeUrl(raw):
  lowercase host, strip protocol, strip leading "www.",
  drop hash, drop tracking params (utm_*, gclid, fbclid, ref, mc_cid),
  strip trailing slash, keep remaining path + meaningful query, keep case of path
```

Match a `RadarPromptSource` to an `AeoPage` on `normalizeUrl(source.url) === normalizeUrl(page.canonicalUrl)`.

**Two traps that will otherwise produce a fake number:**

1. `canonicalUrl` **is set before publish.** `lib/geo/bounty/huntForCompany.ts:127` writes an
  optimistic `${baseUrl}/${slug}` at hunt time, long before anything goes live. The real
   published URL is written later by `approveBountyToShopify.ts:464` and
   `api/geo/bounty/[id]/approve-wordpress/route.ts:71`. So **never treat** `canonicalUrl != null`
   **as "published"** — gate on `status = PUBLISHED AND publishedAt != null`, and only count a
   match if `publishedAt < run.startedAt`. A page cannot be retrieved before it exists.
2. **Own-domain ≠ own-page.** Track `isOwnDomain` (matches company website host) separately
  from `aeoPageId` (matches a specific published page). "Our domain appeared" and "the page
   we published for this question appeared" are different claims with different value.
   Report both, never merge them.



### 1d. Optional, cheap: attribute mentions to sources

For each `Citation` on an execution, if `mentionedName` matches the brand implied by exactly
one retrieved source domain for that prompt, write that URL to `Citation.sourceUrl`. Ambiguous
or zero matches stay `NULL`. Do not guess — a wrong attribution is worse than a null.

### 1e. The number this unlocks

```sql
-- pages retrieved, per run
SELECT p.id, count(DISTINCT s."promptId") AS prompts_hit
FROM radar_prompt_sources s
JOIN aeo_pages p ON p.id = s."aeoPageId"
WHERE s."runId" = $1
GROUP BY p.id;
```

Denominator = `RadarRun.promptCount`. "Showed up for 12 of 40 questions" — measured.

**Effort:** ~1 day for the microservice change + schema + persistence. ~2 days including the
`RadarRun` grouping, normalisation, and the publish-state gating. The extra day is what makes
Step 2 a query instead of a rewrite; do it now.

---



## Step 2 — Measure before and after, with a control group

**Goal:** separate "our article worked" from "the whole category moved."

### 2a. Run schedule

Radar already runs via `lib/jobs/run-radar.ts`. Add a `trigger` label and fire it at two
extra moments around the publish path:

- **pre-publish baseline** — on bounty approval, before the page goes live.
- **post-publish** — on a delay after `CitationBounty.publishedAt` / `AeoPage.publishedAt`.
Fire at **+7, +14, and +30 days**, not once: retrieval indexes lag, and a single post-check
at +2 days mostly measures crawl latency rather than effect.

Both timestamps already exist (`AeoPage.publishedAt:1673`, `CitationBounty.publishedAt:2064`).

### 2b. Treated vs. control assignment

The exposure variable is already in the schema — `AeoPage.llm_prompt_id` (line 1677) and
`AeoPage.llm_topic_id` (line 1680) record exactly which prompt/topic a page was written for.

For a topic `T` and intervention time `t`:

- **Treated** = prompts in `T` with a published `AeoPage` (`publishedAt < t`).
- **Control** = prompts in `T` with **no** published page at any point in the window.

Freeze the control set at baseline and persist it. If controls are recomputed at read time, a
page published mid-window silently migrates a prompt from control to treated and quietly
biases the result. New table:

```prisma
model RadarExperiment {
  id            String   @id @default(cuid())
  companyId     String
  topicId       String?
  aeoPageId     String?
  baselineRunId String
  postRunIds    String[] @default([])
  treatedPromptIds String[] @default([])
  controlPromptIds String[] @default([])
  interventionAt DateTime @db.Timestamptz(3)
  createdAt     DateTime @default(now()) @db.Timestamptz(3)

  @@index([companyId])
  @@index([topicId])
  @@map("radar_experiments")
}
```



### 2c. The estimate

Difference-in-differences on per-prompt retrieval rate:

```
lift = (treated_after − treated_before) − (control_after − control_before)
```

Report it with the four raw cells visible, plus n per cell. **Do not report a bare lift
percentage.** With 3-8 prompts per topic — which is the realistic size here — the confidence
interval will be wide enough that a single number is misleading. Show the counts; let the
shape of the evidence be visible. Suppress the lift figure entirely when either arm has n < 3
and say "not enough questions in this topic to separate the effect."

**Honest limitation to state in the UI:** control prompts are not randomly assigned. Pages get
written for the questions judged most winnable, so treated prompts are selected for
expected-to-improve. DiD removes category-wide drift, not selection bias. The number is
directional evidence, not a causal estimate — and that is still far more than "we published
something."

**Effort:** ~3-4 days.

---



## Step 3 — Find out which parts got quoted

**Goal:** learn whether FAQs, facts, or claims are what actually gets reused.

This works because `assemble_page` (`agent/functions.py:869-871`) stores the components as
separate structured lists rather than one blob:

```python
page["facts"]  = verified_facts
page["faq"]    = faq            # [{name, acceptedAnswer: {text}}]
page["claims"] = claims
```

and they land in `AeoPage.facts` / `.faq` / `.claims` (`schema.prisma:1662-1664`) as JSON.

The answer text to compare against is **already stored**: `applyRadarOutput.ts:341-347` writes
the synthesised response into `PromptExecution.response`. So Step 3 is offline analysis over
data already in Postgres — it needs no microservice change and can be **backfilled over
historical runs**.

### 3a. Element extraction

`lib/geo/attribution/elements.ts` — flatten a page into addressable units:


| Type    | Source                       | Text used          |
| ------- | ---------------------------- | ------------------ |
| `FACT`  | `facts[i]`                   | the fact statement |
| `FAQ_Q` | `faq[i].name`                | question           |
| `FAQ_A` | `faq[i].acceptedAnswer.text` | answer             |
| `CLAIM` | `claims[i]`                  | claim statement    |


Key each by `(pageId, elementType, elementIndex)` plus a `contentHash`, so edits to a page
don't corrupt history.

### 3b. Matching

Lexical first, no LLM:

1. Normalise both sides (lowercase, strip punctuation, collapse whitespace).
2. Word 5-gram shingle sets; score = `|A ∩ B| / |A|` (containment, not Jaccard — the answer
  is much longer than the element, so Jaccard would suppress every real match).
3. Threshold ~0.35, tuned against a hand-labelled sample of ~50 pairs before trusting it.

Escalate only for near-threshold cases (0.20-0.35), where paraphrase is plausible: embedding
cosine, or an LLM judge on that slice alone. Do not run an LLM over every element × execution
pair — with 40 prompts × 3 models × ~30 elements that is 3,600 calls per run.

**Watch for the trivial-match failure:** short generic elements ("Free shipping on all
orders") will match many answers by coincidence. Require a minimum element length (~8 words)
and record `elementLength` so low-signal matches can be filtered in analysis rather than
silently inflating the FAQ win rate.

### 3c. Storage

```prisma
model ContentElementCitation {
  id           String   @id @default(cuid())
  pageId       String
  executionId  String
  elementType  String   @db.VarChar(16)   // FACT | FAQ_Q | FAQ_A | CLAIM
  elementIndex Int
  contentHash  String   @db.VarChar(64)
  matchScore   Float
  method       String   @db.VarChar(24)   // shingle | embedding | llm
  createdAt    DateTime @default(now()) @db.Timestamptz(3)

  page      AeoPage         @relation(fields: [pageId], references: [id], onDelete: Cascade)
  execution PromptExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@unique([pageId, executionId, elementType, elementIndex])
  @@index([pageId])
  @@index([elementType])
  @@map("content_element_citations")
}
```

Aggregate to: reuse rate by `elementType`, by `AeoPageType`, by topic. That table is the asset
— it is a record of what worked, and it cannot be copied by copying the product.

**Effort:** ~4-5 days including threshold calibration.

---



## Step 4 — Feed it back into generation

**Only after Step 3 has meaningful volume.** Rule of thumb: ≥30 published pages with ≥2
post-publish measurement runs each. Below that, "FAQs beat facts" is noise, and tuning on
noise makes output worse while feeling data-driven.

The knobs live in Immortel_AI (`agent/functions.py`, `agent/content_specs.py`): how many facts
to require, how many FAQ entries, which page type. Robust already has the place to store
learned values per client — `AeoGenerationProfile` (`schema.prisma:1721`), which holds
`defaultPageType` and is passed into generation.

Sequence:

1. Report-only first. Surface reuse rates in the dashboard and let a human choose. Ship this
  and stop.
2. Then per-company suggested defaults written to `AeoGenerationProfile`, with the evidence
  count shown next to each.
3. Automatic tuning last, if at all, and never without the guardrail below.

**Effort:** ~2-3 days for report-only. Automation is a later, separate decision.

---



## Step 5 — The validity problem, and what to do about it

The radar does not ask ChatGPT. `run_web_search` calls Tavily, and `run_web_search_synth`
(`functions.py:993-1003`) has an LLM write a recommendation list from those six snippets,
under a hand-written prompt that explicitly instructs it to produce ranked companies and to
favour "indian local companies or global companies used widely in india."

That prompt is a strong prior of our own construction. It shapes the output we then measure.
So the pipeline measures: **would a model recommend us, given a Tavily top-6 and our own
instruction to produce rankings.** Real assistants use different retrieval, different
grounding, and their own system prompts.

Tuning content on this signal alone optimises for our own tool. Concretely:

**Do:**

- Name the metric for what it measures. Call it *web-retrieval visibility* in the schema, API,
and UI — not "AI visibility" and not "ChatGPT ranking." The Step 1 retrieval number
(did our URL get pulled in) is the **robust** part: it measures whether search surfaces the
page, which is real and provider-independent. Lead with it.
- Treat Step 3 element-reuse as a hypothesis generator, not ground truth.
- Keep the control group (Step 2). It is the one defence against category drift, and it works
regardless of which channel does the asking.

**Before Step 4 auto-tunes anything, add at least one independent channel** and confirm the
ranking of element types agrees across channels:

- a real assistant with live browsing, queried directly, on a sampled subset of prompts;
- and/or Google AI Overviews presence for the same queries.

Sample maybe 20% of prompts on the second channel — enough to validate direction, cheap enough
to run. If the two channels disagree about what gets quoted, the synth-only signal is
measuring our prompt, and Step 4 must not act on it.

**Do not:** report synth-derived rankings to clients as ChatGPT rankings. That is the claim
that gets checked, and it will not hold.

---

## Proof after each step

What you can actually put in front of a client after each step — a specific artifact they can
click into, not a summary number.

**After Step 1 — "your page showed up in retrieval"**
Pick one `RadarRun`, one published `AeoPage`. Show: *"Of the 40 prompts in this run, 12 had a
retrieved source URL matching your page's canonical URL."* The proof isn't the count — it's
that each of the 12 can be opened to show the actual URL Tavily returned next to the prompt
that triggered it. Show `isOwnDomain` separately from `aeoPageId` matches ("your domain
appeared 18 times, but only 12 were *this* page") — that distinction is what makes the number
credible instead of hand-wavy.

**After Step 2 — "your article caused it, not the category moving"**
Pick one `RadarExperiment`. Show the four raw cells, not one lift percentage:

| | before | after |
|---|---|---|
| treated (this topic's prompts, page published) | 2/8 | 6/8 |
| control (same topic, nothing published) | 3/10 | 4/10 |

That table is the deliverable — it answers "how do you know it wasn't just the category
moving," which is the question every agency dodges. Suppress it when either arm has n < 3
rather than showing a fake-precise percentage.

**After Step 3 — "here's what actually got quoted"**
One concrete example: your FAQ answer text next to the highlighted overlapping span in the
LLM's answer (`PromptExecution.response`). Then the aggregate across pages: *"FAQ answers get
reused in 42% of citing responses vs. 18% for standalone facts, across N pages."* This is the
chart nobody else can produce because it requires having published enough to measure.

**After Step 4 — "we changed the recipe because of that data"**
A specific `AeoGenerationProfile` diff: *"Default was 3 facts / 2 FAQs. Changed to 2 facts /
5 FAQs because FAQ reuse was 2.3x facts for this client's topics (12 pages measured)."* The
real proof lands one cycle later: the next batch of pages, measured again via Step 1/2, beats
the prior batch's baseline retrieval rate. Until that second measurement exists, this step is
a documented decision, not proof yet — say so explicitly rather than implying otherwise.

**After Step 5 — "we're not just fooling our own tool"**
Two independent channels' element-type rankings side by side (synth-search vs. a sampled real
assistant or AI-Overview channel), with agreement on which element type wins. That agreement
is what makes the Step 3 numbers trustworthy rather than self-referential. The free part ships
immediately: the UI says "Web-Retrieval Visibility," not "AI Visibility Score" — that
relabelling is itself a credibility proof.

---

