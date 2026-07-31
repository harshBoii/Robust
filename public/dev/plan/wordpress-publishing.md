# WordPress Blog Publishing — Full Implementation Plan

**Status:** Implemented (Phases 1–7) — see §6 Implementation status. Phase 8 (tests) not started.
**Author:** Engineering
**Date:** 2026-07-31
**Scope:** Publish GEO/bounty blog articles to a customer's WordPress site with full JSON-LD
schema parity with Shopify, plus a first-class WordPress connection in Profile → Integrations.

---

## 1. Where we are today

### 1.1 The Shopify path (the reference implementation)

`lib/geo/bounty/approveBountyToShopify.ts` is the mature path. It does eight things:


| #   | Step                                   | Implementation                                                                                                                                                                       |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Load bounty + `aeoPage`                | `citationBounty.findFirst` with nested `aeoPage` select                                                                                                                              |
| 2   | Resolve the store                      | `shopifyShop.findFirst({ status: 'installed' })`                                                                                                                                     |
| 3   | Ensure metafield **definitions** exist | `metafieldDefinitionCreate` for `custom.json_ld` and `custom.immortel_payload`, `ownerType: ARTICLE`, idempotent via `TAKEN` detection                                               |
| 4   | Ensure a **blog channel**              | Topic name → handle (`topicNameToShopifyBlogHandle`), cached in `ShopifyBlogChannel`, else `blogCreate`                                                                              |
| 5   | Render body                            | `minimalMarkdownToHtml(aeoPage.description)`                                                                                                                                         |
| 6   | Create the article                     | `articleCreate` with `body`, `author`, `isPublished`, `publishDate`, `tags`, and 4 metafields: `custom.json_ld`, `custom.immortel_payload`, `seo.title`, `seo.description`           |
| 7   | Pillar interlinking                    | `appendNewArticleLinkToPillar` — finds the oldest page in the topic, appends a `## Related reading` link, `articleUpdate`s it, and writes the markdown back to `AeoPage.description` |
| 8   | Persist + settle                       | `aeoPage.canonicalUrl` + `shopifyArticleGid`, `citationBounty.publishedAt`, `syncBountyRevenueForCompany`                                                                            |


It also handles the **partial success** case: if `userErrors` is non-empty *but* an article ID
came back, it still persists and returns `partial: true`.

### 1.2 The WordPress path (a broken stub)

Three files pretend WordPress works. None of them do.

`lib/wordpress/client.ts` — four separate defects:

```ts
// line 8-11 — looks up the SHOPIFY row, because IntegrationProvider has no WordPress member
const integration = await prisma.companyIntegrationCms.findFirst({
  where: { companyId, provider: "Shopify" },
  select: { appUrl: true },
});
...
// line 19-25 — no Authorization header at all. Every real WP install returns 401.
const res = await fetch(`${integration.appUrl}/wp-json/wp/v2/posts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(params),
});
```

1. Reads the **Shopify** CMS row (`provider: "Shopify"`) and uses `appUrl`, which is *our*
  app's public URL used to build the Shopify OAuth redirect — not the customer's WP site.
2. Sends **no authentication**. WP core rejects unauthenticated `POST /wp/v2/posts` with 401.
3. Throws `WP_UNAUTHORIZED` nowhere, yet
  `app/(backend)/api/geo/bounty/[id]/approve-wordpress/route.ts:96` branches on it.
4. **Zero JSON-LD.** `createPost` only accepts `{title, slug, status, content, excerpt}`.
  `aeoPage.knowledgeGraph` is never read on this path.

`lib/geo/bounty/getPublishTargets.ts:47` — availability is hardcoded off:

```ts
wordpressWoo: { available: false, reason: 'WordPress integration not yet configured' },
```

`lib/geo/bounty/publish/index.ts:20-93` — `websiteBlogAdapter` picks its destination
*implicitly*: if a Shopify shop row exists it goes to Shopify, otherwise it falls through to
`wpSafeFetch`. There is no way for a company connected to both to choose. Its
`isAvailable()` only checks Shopify, so with WordPress-only the adapter reports unavailable
while the fallthrough code below it is dead.

### 1.3 Where JSON-LD comes from

`lib/geo/bounty/huntForCompany.ts:124` maps the microservice response into the DB:

```ts
knowledgeGraph: (page.jsonLd ?? page.json_ld ?? {}) as unknown as Prisma.InputJsonValue,
```

So `AeoPage.knowledgeGraph` (Json, default `{}`) is the single source of truth. Shopify
stores it verbatim in the `custom.json_ld` metafield; the merchant's Liquid theme is
responsible for rendering it into `<head>`. **There is no** `application/ld+json` **emitter
anywhere in this repo** — confirmed by grep. WordPress will need one, because WP has no
metafield-render concept.

### 1.4 Integrations UI as it stands

- `app/(frontend)/(workspace)/profile/integration/page.tsx` → `IntegrationPageClient`
- `IntegrationPageClient.tsx` renders `IntegrationCard`s for Meta, Google Ads, Shopify, and
the Zernio-backed socials; modal state is `'meta' | 'shopify' | 'google-ads' | SocialProvider | null`
- Shopify card → `ShopifyConnectionModal` → `<ManagerShopifyClient embedded />`
- `ManagerShopifyClient` reads/writes `/api/company/shopify-app` (GET/PATCH) and links to
`/shopify/install` for OAuth; `/shopify/disconnect` tears down
- Landing page `IntegrationsSection.tsx` lists logos only (WooCommerce is there; WordPress is not)

---



## 2. Design decisions



### D1 — Authentication: WordPress Application Passwords

WP core ships **Application Passwords** since 5.6 (no plugin required). They authenticate the
REST API over HTTP Basic on HTTPS.

Critically, WP also ships an **authorize handshake** that gives us Shopify-grade one-click UX:

```
https://site.com/wp-admin/authorize-application.php
  ?app_name=Immortel
  &app_id=<uuid>
  &success_url=https://our-app.com/wordpress/callback?state=<signed>
```

The admin approves in wp-admin and WP redirects back with `?user_login=…&password=…&site_url=…`.
We never see their real password, and they can revoke per-application from their profile.

**Rejected alternatives:** WordPress.com OAuth2 only covers .com/Jetpack-connected sites;
JWT auth requires a third-party plugin; storing the admin password is unacceptable.

**Fallback:** a manual form (site URL + username + application password) for sites where the
handshake is blocked (some security plugins disable `authorize-application.php`).

### D2 — JSON-LD delivery: three layers, capability-detected

This is the part with no Shopify analogue. Shopify hands schema to the theme; WordPress does
not. Three mechanisms, tried in order:

**Layer A — Companion plugin (preferred).** Ship a ~120-line MU-plugin,
*Immortel Schema Bridge*, that:

- `register_post_meta('post', 'immortel_json_ld', ['show_in_rest' => true, 'single' => true, 'type' => 'string', 'auth_callback' => …])`
- same for `immortel_payload` (the Shopify `custom.immortel_payload` equivalent)
- hooks `wp_head` at priority 5 and prints `<script type="application/ld+json">` with the
stored graph, `wp_json_encode`d
- exposes `GET /wp-json/immortel/v1/status` → `{version, has_yoast, has_rankmath, can_unfiltered_html}`
so we can detect capabilities in one call
- when Yoast or Rank Math is active, hooks their filters (`wpseo_schema_graph` /
`rank_math/json_ld`) to **merge** our `@graph` nodes instead of emitting a second
competing `Article`

This is the only layer with true Shopify parity, and it's what we push customers toward.

**Layer B — Inline in post content (zero-dependency fallback).** Append the
`<script type="application/ld+json">…</script>` block to the post HTML. Google parses JSON-LD
in `<body>`. **Caveat:** `wp_kses_post` strips `<script>` for any user lacking the
`unfiltered_html` capability. On single-site, Administrator and Editor have it; on multisite,
only Super Admin does. We must probe this (Layer A's `/status`, or a canary post round-trip)
and surface a clear warning rather than silently publishing schema-less posts.

**Layer C — SEO plugin handoff.** If Yoast/Rank Math is present but our plugin is not, write
to their REST-exposed meta (`yoast_head_json` is read-only, but Yoast exposes writable
`meta._yoast_wpseo_title` / `_yoast_wpseo_metadesc` for SEO title/description). Schema graph
injection still needs Layer A or B; Layer C exists so we don't emit duplicate/conflicting
title tags.

**Decision:** implement A + B now, C only for SEO title/description. Store the resolved mode
on `WordPressSite.jsonLdMode` so the UI can show *"Schema: plugin (full)"* vs
*"Schema: inline (limited)"* vs *"Schema: unavailable"*.

### D3 — Topic → Category, mirroring `ShopifyBlogChannel`

Shopify creates one *Blog* per topic. The WordPress analogue is a **Category**
(`POST /wp/v2/categories`). We mirror `ShopifyBlogChannel` with `WordPressBlogChannel`
keyed `[siteId, slug]`, caching the numeric `wpCategoryId` so we never re-query.

### D4 — Destination becomes explicit, not implicit

`websiteBlogAdapter` stops guessing. It resolves a destination from, in order:

1. an explicit `destination: 'shopify' | 'wordpress'` on the publish call
2. the company's `defaultBlogDestination` (new column on `Company`)
3. whichever single provider is connected
4. error `MULTIPLE_BLOG_DESTINATIONS` if both are connected and none was chosen

`articleActions.tsx` already has `blogDestination` state and a two-way toggle — it just needs
to pass it through instead of routing to two different endpoints.

### D5 — Credential encryption

Application passwords are long-lived secrets. Encrypt at rest with AES-256-GCM, reusing the
pattern in `lib/auth/two-factor-crypto.ts` but with a **dedicated key**, not `JWT_SECRET` —
rotating the JWT secret must not brick every WordPress connection.

---



## 3. Implementation



### Phase 1 — Data model

`prisma/schema.prisma`

```prisma
enum IntegrationProvider {
  Shopify
  WordPress          // NEW
}

enum WordPressAuthType {
  APP_PASSWORD
  MANUAL
}

enum WordPressJsonLdMode {
  PLUGIN             // companion plugin present — head injection
  INLINE             // no plugin, user has unfiltered_html — script in content
  SEO_PLUGIN         // Yoast/RankMath handles schema; we only set title/desc
  UNAVAILABLE        // no mechanism works — warn the user
}

model WordPressSite {
  id               String              @id @default(cuid())
  companyId        String
  siteUrl          String              @db.VarChar(1000)   // https://example.com
  restBase         String              @db.VarChar(1000)   // resolved wp-json root
  authType         WordPressAuthType   @default(APP_PASSWORD)
  username         String              @db.VarChar(255)
  appPasswordEnc   String              @db.Text            // AES-256-GCM
  status           String              @default("connected") @db.VarChar(32)
  wpVersion        String?             @db.VarChar(32)
  jsonLdMode       WordPressJsonLdMode @default(UNAVAILABLE)
  pluginVersion    String?             @db.VarChar(32)
  seoPlugin        String?             @db.VarChar(32)     // yoast | rankmath | null
  capabilities     Json                @default("{}")
  defaultAuthorId  Int?
  lastVerifiedAt   DateTime?           @db.Timestamptz(3)
  lastError        String?             @db.Text
  disconnectedAt   DateTime?           @db.Timestamptz(3)
  createdAt        DateTime            @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime            @updatedAt @db.Timestamptz(3)

  company       Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  blogChannels  WordPressBlogChannel[]

  @@unique([companyId, siteUrl])
  @@index([companyId])
  @@map("wordpress_sites")
}

model WordPressBlogChannel {
  id            String   @id @default(cuid())
  siteId        String
  companyId     String
  slug          String   @db.VarChar(255)
  name          String   @db.VarChar(255)
  wpCategoryId  Int
  createdAt     DateTime @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime @updatedAt @db.Timestamptz(3)

  site    WordPressSite @relation(fields: [siteId], references: [id], onDelete: Cascade)
  company Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([siteId, slug])
  @@index([siteId])
  @@index([companyId])
  @@map("wordpress_blog_channels")
}
```

`AeoPage` — mirror `shopifyArticleGid`:

```prisma
  /// WordPress REST post ID when published via approve-wordpress
  wordpressPostId  Int?
  wordpressSiteId  String? @db.VarChar(64)
```

`Company` — add `defaultBlogDestination String? @db.VarChar(16)` (`shopify` | `wordpress`)
plus the back-relations `wordpressSites` / `wordpressBlogChannels`.

> **Migration note:** adding a member to `IntegrationProvider` is an additive Postgres enum
> change (`ALTER TYPE … ADD VALUE`). Prisma emits this in its own migration; Postgres cannot
> run `ADD VALUE` inside a transaction block on older versions, so keep it in a **standalone
> migration** ahead of the table creates.



### Phase 2 — `lib/wordpress/`


| File              | Responsibility                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crypto.ts`       | `encryptWpSecret` / `decryptWpSecret`, AES-256-GCM off `WORDPRESS_CREDENTIALS_SECRET`; mirror `lib/auth/two-factor-crypto.ts` structure                                                                                                                                                                                                                                   |
| `domain.ts`       | `normalizeSiteUrl` (strip trailing slash, force https, reject IP/localhost unless `WORDPRESS_ALLOW_INSECURE_HTTP`), `discoverRestBase` via `Link: <…>; rel="https://api.w.org/"` header with `/wp-json` fallback                                                                                                                                                          |
| `config.ts`       | `getWordPressConfig(companyId)` → resolved site + decrypted creds, or `null`. Mirrors `lib/shopify/config.ts`                                                                                                                                                                                                                                                             |
| `client.ts`       | **Full rewrite.** `wpFetch<T>()` — Basic auth header, timeout via `AbortSignal.timeout(WORDPRESS_API_TIMEOUT_MS)`, retry-once on 5xx, maps status → typed `WordPressApiError` (`WP_NOT_CONNECTED` / `WP_UNAUTHORIZED` / `WP_FORBIDDEN` / `WP_NOT_FOUND` / `WP_ERROR:<code>`) so the existing route branches in `approve-wordpress/route.ts:90-108` finally fire correctly |
| `capabilities.ts` | `probeSite()` — `GET /wp-json`, `GET /wp/v2/users/me?context=edit`, `GET /immortel/v1/status`; resolves `jsonLdMode`, `seoPlugin`, `wpVersion`, `defaultAuthorId`; persists to `WordPressSite`                                                                                                                                                                            |
| `categories.ts`   | `ensureCategory({siteId, slug, name})` — read-through `WordPressBlogChannel`, else `GET /wp/v2/categories?slug=`, else `POST /wp/v2/categories`. Exact analogue of `ensureBlogChannel`                                                                                                                                                                                    |
| `jsonld.ts`       | `buildArticleGraph()` + `attachJsonLd()` — see Phase 3                                                                                                                                                                                                                                                                                                                    |
| `posts.ts`        | `createPost` / `updatePost` / `getPost` against `/wp/v2/posts`, incl. `meta`, `categories`, `tags`, `status`, `date_gmt`, `slug`, `excerpt`                                                                                                                                                                                                                               |
| `tags.ts`         | `ensureTags(['geo','bounty',<topic>])` → numeric term IDs (WP requires IDs, not strings)                                                                                                                                                                                                                                                                                  |
| `media.ts`        | *(deferred to Phase 7)* sideload featured images via `POST /wp/v2/media`                                                                                                                                                                                                                                                                                                  |




### Phase 3 — JSON-LD parity (`lib/wordpress/jsonld.ts`)

```ts
export function buildArticleGraph(opts: {
  knowledgeGraph: unknown;      // AeoPage.knowledgeGraph — source of truth
  canonicalUrl: string;
  title: string;
  description: string;
  publishedAt: Date | null;
  modifiedAt: Date;
  authorName: string;
  siteUrl: string;
}): Record<string, unknown>
```

Rules:

- If `knowledgeGraph` already carries `@context`, treat it as authoritative and only
**backfill** missing `url` / `datePublished` / `dateModified` / `mainEntityOfPage`.
We never overwrite what the microservice produced.
- If it's a bare object or `{}`, wrap into a proper
`{"@context":"https://schema.org","@graph":[ …Article, …BreadcrumbList, …FAQPage ]}`.
`FAQPage` is assembled from `AeoPage.faq` (already a Json array), matching what Shopify
merchants render off the metafield.
- Validate with `JSON.parse(JSON.stringify(x))` — same guard as
`jsonStringifyAndValidate` in `approveBountyToShopify.ts:40`.

Then `attachJsonLd(mode, post, graph)` dispatches:


| Mode          | Action                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `PLUGIN`      | `meta: { immortel_json_ld: JSON.stringify(graph), immortel_payload: JSON.stringify(payload) }` on the post body              |
| `INLINE`      | append `<script type="application/ld+json">…</script>` to `content`, `<` escaped as `<` to survive kses and prevent breakout |
| `SEO_PLUGIN`  | set `meta._yoast_wpseo_title` / `_yoast_wpseo_metadesc` (or Rank Math equivalents); graph via `INLINE` if permitted          |
| `UNAVAILABLE` | publish anyway, set `lastError`, return `schemaSkipped: true` so the UI can warn                                             |


**Verification step:** after create, `GET` the post's permalink and assert the
`application/ld+json` block is actually present. Persist the result — this is the difference
between "we sent schema" and "schema is live", and it's exactly the failure mode the
`unfiltered_html` caveat produces.

### Phase 4 — `lib/geo/bounty/approveBountyToWordPress.ts`

A structural mirror of `approveBountyToShopify.ts`, same eight steps:

1. Load bounty + `aeoPage` (identical select, plus `seoDescription`)
2. `getWordPressConfig(companyId)` → 404 `WP_NOT_CONNECTED`
3. `probeSite()` if `lastVerifiedAt` is stale (> 24h) — the Layer-A/B analogue of
  `ensureMetafieldDefinition`
4. `ensureCategory()` from `llm_topic.name` → reuse `topicNameToShopifyBlogHandle`'s slug
  logic, **extracted to a shared** `slugifyTopicName()` in
   `lib/geo/bounty/markdownToHtmlForPublish.ts` (or a new `topic-slug.ts`) so both providers
   stay in lockstep
5. `minimalMarkdownToHtml(aeoPage.description)` — unchanged, shared
6. `createPost` with title, content (+ inline schema if `INLINE`), excerpt, slug, `status: 'publish'`,
  `date_gmt`, `categories: [id]`, `tags`, `meta`
7. Pillar interlinking — `appendNewArticleLinkToPillar` generalized: today it hardcodes
  `shopifyArticleGid` + `articleUpdate`. Refactor to take a
   `{ updateBody(externalId, html): Promise<void> }` callback so both providers share the
   `buildRelatedArticlesAppend` → `minimalMarkdownToHtml` → persist flow
8. Persist `canonicalUrl` (the WP `link`), `wordpressPostId`, `wordpressSiteId`,
  `citationBounty.publishedAt`, `syncBountyRevenueForCompany`

Return shape matches Shopify's, plus `schemaMode` and `schemaVerified`.

### Phase 5 — Wire into the publish pipeline

`lib/geo/bounty/publish/types.ts` — add to the adapter's `publish` opts:

```ts
destination?: 'shopify' | 'wordpress';
```

`lib/geo/bounty/publish/index.ts` — rewrite `websiteBlogAdapter`:

- `isAvailable()` returns true if **either** Shopify or WordPress is connected (today it only
checks Shopify, which is why the WP fallthrough at line 59 is unreachable)
- `publish()` resolves per D4 and delegates to `approveBountyToShopify` or
`approveBountyToWordPress`
- delete the inline `wpSafeFetch` block (lines 54-91) entirely

`lib/geo/bounty/getPublishTargets.ts` — replace the hardcoded `false`:

```ts
wordpress: { available: Boolean(wpSite), reason?, jsonLdMode?, siteUrl? },
wordpressWoo: { available: Boolean(wpSite) },   // keep key; articleActions.tsx reads it
```

`app/(backend)/api/geo/bounty/[id]/approve-wordpress/route.ts` — thin it out to
session-check → `approveBountyToWordPress()` → error mapping, matching how
`approve-shopify/route.ts` is structured. The error branches it already has become live.

`articleActions.tsx` — `blogDestination` already exists (line 60) and already toggles
(lines 85-86, 190). Change the two-endpoint fork (lines 188-191) into a single
`POST /api/geo/bounty/:id/publish` with `{platform:'WEBSITE_BLOG', destination}`, or keep the
fork and just fix availability gating. Surface a schema warning when `jsonLdMode === 'UNAVAILABLE'`.

### Phase 6 — Connection UX

**API —** `app/(backend)/api/company/wordpress-app/route.ts` (mirrors `shopify-app/route.ts`):

- `GET` → `{ site: {siteUrl, username, status, jsonLdMode, seoPlugin, wpVersion, lastVerifiedAt, lastError}, connected }`.
**Never** return `appPasswordEnc`; expose `hasAppPassword: boolean` only — same shape
discipline as `hasApiSecret` at `shopify-app/route.ts:55`
- `PATCH` → manual credential entry (site URL + username + app password) → encrypt → `probeSite()` → upsert
- `POST /verify` → re-run `probeSite()` on demand

**Handshake routes** (mirror `app/shopify/`*):


| Route                               | Purpose                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/wordpress/authorize/route.ts`  | Validate + normalize site URL, discover REST base, mint signed state cookie (clone `lib/auth/shopify-oauth-state.ts` → `wordpress-oauth-state.ts`), 302 to `/wp-admin/authorize-application.php` |
| `app/wordpress/callback/route.ts`   | Verify state cookie, read `user_login` / `password` / `site_url` from the query, encrypt, upsert `WordPressSite`, `probeSite()`, redirect to `/profile/integration?wordpress_connected=1`        |
| `app/wordpress/disconnect/route.ts` | `DELETE /wp/v2/application-passwords/me/<uuid>` best-effort, then mark `status: 'disconnected'` + `disconnectedAt`                                                                               |


> **Security:** WP delivers the application password as a **query parameter** on the callback.
> Consume it, redirect immediately (303) to a clean URL, and never log the full request URL.
> Add an explicit scrub in the callback's error paths.

**UI:**

- `app/components/manager/ManagerWordPressClient.tsx` — modeled on `ManagerShopifyClient.tsx`
(337 lines): site URL field, Connect button → `/wordpress/authorize`, connected state with
site/user/WP version, **schema status badge** driven by `jsonLdMode`, a
*"Install schema plugin"* prompt + download link when mode is `INLINE`/`UNAVAILABLE`,
Verify and Disconnect buttons
- `IntegrationConnectionModals.tsx` — add `WordPressConnectionModal` next to `ShopifyConnectionModal`
- `IntegrationPageClient.tsx` — widen `IntegrationModal` to include `'wordpress'`; add the
card (`SiWordpress` from `react-icons/si`, `#21759B`); add `wordpressConnected` state and
fold `/api/company/wordpress-app` into the existing `Promise.all` at line 166; handle
`?wordpress_connected` / `?wordpress_error` params alongside the Shopify ones at lines 227/257
- `app/components/landing/sections/IntegrationsSection.tsx` — add
`{ kind: 'si', Icon: SiWordpress, name: 'WordPress', color: '#21759B' }` after Shopify



### Phase 7 — Companion plugin

Ship `public/downloads/immortel-schema-bridge.zip`, built from a source dir at
`tools/wordpress-plugin/`:

```
immortel-schema-bridge/
  immortel-schema-bridge.php   # header, register_post_meta, wp_head printer
  includes/rest-status.php     # GET /immortel/v1/status
  includes/seo-bridge.php      # wpseo_schema_graph + rank_math/json_ld merge filters
  readme.txt
```

Served from the connection modal when `jsonLdMode !== 'PLUGIN'`. Keep it dependency-free and
tested against the two most recent WP majors.

### Phase 8 — Tests

- `lib/wordpress/domain.test.ts` — normalization, REST discovery, http rejection
- `lib/wordpress/jsonld.test.ts` — passthrough of an existing `@graph`; wrapping of a bare
object; FAQ assembly from `AeoPage.faq`; `<` escaping in `INLINE`
- `lib/wordpress/client.test.ts` — status → error-code mapping (401 → `WP_UNAUTHORIZED` etc.)
- `approveBountyToWordPress.test.ts` — mocked `wpFetch`; asserts category reuse, pillar
append, and the `aeoPage` / `citationBounty` writes
- Manual matrix: fresh WP, WP + our plugin, WP + Yoast, WP + Rank Math, WP multisite
(the `unfiltered_html` edge), WP behind Cloudflare

---



## 4. Risks


| Risk                                                                                     | Mitigation                                                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `<script>` stripped by `wp_kses` for non-`unfiltered_html` users                         | Capability probe + post-publish permalink verification; push the plugin; never report success on unverified schema |
| Duplicate `Article` schema when Yoast/Rank Math is active                                | Plugin merges into their graph filters; standalone mode emits `BreadcrumbList`/`FAQPage` only                      |
| Application password leaked via referrer/logs on callback                                | 303 to a clean URL immediately; scrub URLs from error logging                                                      |
| `IntegrationProvider` enum change blocking migration                                     | Standalone additive-enum migration ahead of table creates                                                          |
| Self-hosted WP behind auth walls / security plugins blocking `authorize-application.php` | Manual credential form as the documented fallback                                                                  |
| Slug collisions between Shopify `handle` and WP `slug`                                   | Shared `slugifyTopicName()`; `@@unique([siteId, slug])`                                                            |
| Both providers connected, ambiguous destination                                          | Explicit `destination` param + `Company.defaultBlogDestination` (D4)                                               |




## 5. Sequencing


| Phase                          | Depends on | Est. |
| ------------------------------ | ---------- | ---- |
| 1 — Schema + migrations        | —          | 0.5d |
| 2 — `lib/wordpress/` core      | 1          | 1.5d |
| 3 — JSON-LD builder + attach   | 2          | 1.5d |
| 4 — `approveBountyToWordPress` | 2, 3       | 1d   |
| 5 — Pipeline wiring            | 4          | 0.5d |
| 6 — Connection UX              | 2          | 1.5d |
| 7 — Companion plugin           | 3          | 1d   |
| 8 — Tests                      | all        | 1d   |


Phases 6 and 7 parallelize against 3–5. Critical path ≈ **6 days**.

---

## 6. Implementation status

Phases 1–7 are built. `npx tsc --noEmit` and `npm run build` both pass clean.

### Files added

| File | Purpose |
|------|---------|
| `lib/wordpress/crypto.ts` | AES-256-GCM for application passwords, keyed off `WORDPRESS_CREDENTIALS_SECRET` |
| `lib/wordpress/domain.ts` | Site URL normalization, REST root discovery via the `api.w.org` Link header |
| `lib/wordpress/errors.ts` | `WordPressApiError` with typed codes; keeps the `WP_ERROR:<slug>` prefix the route branches on |
| `lib/wordpress/config.ts` | Env accessors + `getWordPressContext` / `requireWordPressContext` |
| `lib/wordpress/client.ts` | **Rewritten.** Basic auth, timeout, retry, status→typed-error mapping |
| `lib/wordpress/capabilities.ts` | `probeSite` / `probeAndPersist` / `ensureFreshProbe`, resolves `jsonLdMode` |
| `lib/wordpress/taxonomy.ts` | `ensureCategory` (cached in `WordPressBlogChannel`), `ensureTags` |
| `lib/wordpress/posts.ts` | `createPost` / `updatePost` / `getPost` / `postPermalink` |
| `lib/wordpress/jsonld.ts` | `buildArticleGraph`, `serializeGraph`, `renderInlineJsonLd`, `attachJsonLd` |
| `lib/wordpress/verify.ts` | Post-publish permalink fetch confirming the schema actually rendered |
| `lib/geo/bounty/approveBountyToWordPress.ts` | The publisher |
| `lib/geo/bounty/topic-slug.ts` | Shared topic→slug logic (both providers) |
| `lib/geo/bounty/pillar-interlink.ts` | Shared pillar interlinking (both providers) |
| `lib/geo/bounty/blog-destination.ts` | Explicit destination resolution |
| `lib/auth/wordpress-connect-state.ts` | CSRF state cookie for the handshake |
| `app/wordpress/{authorize,callback,disconnect}/route.ts` | Handshake routes |
| `app/(backend)/api/company/wordpress-app/route.ts` | GET status / PATCH manual creds + default / POST verify |
| `app/components/manager/ManagerWordPressClient.tsx` | Connection panel with schema status badge |
| `tools/wordpress-plugin/immortel-schema-bridge/` + `build.sh` | Companion plugin and packaging |
| `public/downloads/immortel-schema-bridge.zip` | Built artifact served from the connection modal |

### Files modified

- `prisma/schema.prisma` + migration `20260731092943_wordpress_publishing`
- `lib/geo/bounty/publish/{index,types}.ts` — destination-aware `websiteBlogAdapter`; the dead `wpSafeFetch` fallthrough is gone
- `lib/geo/bounty/getPublishTargets.ts` — real availability, `jsonLdMode`, ambiguity signalling
- `lib/geo/bounty/approveBountyToShopify.ts` — now uses the shared slug + pillar helpers
- `app/(backend)/api/geo/bounty/[id]/approve-wordpress/route.ts` — thin handler over the publisher
- `articleActions.tsx` — destination values, ambiguity gating, schema + publish warnings
- `IntegrationPageClient.tsx`, `IntegrationConnectionModals.tsx`, landing `IntegrationsSection.tsx`
- `lib/geo/chat/{geo-agent-schema,geo-agent-prompt,types}.ts`, `lib/geo/chat/tools/index.ts` — agent can pass `blogDestination`
- `.env.example`

### Deviations from the plan

1. **Enum migration is not standalone.** `ALTER TYPE … ADD VALUE` ran inside the main
   migration without incident — Neon is PG 16+, and the new value is not referenced by DDL
   in the same transaction. The separate-migration precaution was unnecessary.
2. **`wordpressWoo` compat key retained but empty of consumers.** Every reader was migrated
   to `wordpress`; the key is still emitted so nothing external breaks.
3. **Manual-credential fallback shipped in Phase 6** rather than being deferred — it is the
   only path that works when a host blocks `authorize-application.php`.
4. **Disconnect wipes `appPasswordEnc`** rather than leaving a revoked credential at rest.
5. **Chat agent made destination-aware.** Not in the original plan, but it was otherwise the
   one publish path that could not resolve an ambiguous destination.

### Not done

- **Phase 8 (tests).** No unit tests written. The listed suites are still the right ones.
- **`lib/wordpress/media.ts`** — featured-image sideloading was deferred in the plan and
  remains so.
- **PHP syntax was never machine-checked.** No PHP runtime is available in this environment,
  so `immortel-schema-bridge` is unverified beyond review. Run `php -l` on all four files
  before shipping the zip, and exercise the manual test matrix.

---



# TODO — for you (Harsh)

Things I cannot do from the codebase. Roughly in the order you'll need them.

### Before Phase 1

- [x] **Confirm the WordPress target type.** Self-hosted WP only, or must WordPress.com /
  ```
  Jetpack-connected sites work too? WP.com needs a separate OAuth2 app and changes D1.
  ```
- [x] **Confirm we may ship a plugin.** Layer A is the only route to true Shopify schema
  ```
  parity. If shipping a plugin is off the table, say so now — we ship Layer B only and
  accept that schema silently fails for non-`unfiltered_html` users.
  ```
- [x] **Decide** `defaultBlogDestination` **semantics** — per company, or a per-bounty choice
  ```
  every time? Plan assumes company default + per-publish override.
  ```



### Infrastructure

- [ ] **Generate** `WORDPRESS_CREDENTIALS_SECRET` — `openssl rand -base64 32`. Add to local
  ```
  `.env`, staging, and production. Do **not** reuse `JWT_SECRET`.
  ```
- [ ] **Register an app UUID** for the Application Password handshake (`app_id`) — any stable
  ```
  UUIDv4, generate once and put it in env so revocation works consistently.
  ```
- [ ] **Confirm the public callback origin** per environment. The handshake `success_url` must
  ```
  be HTTPS and exactly match what's registered. Localhost needs an ngrok/tunnel URL.
  ```
- [ ] **Allow outbound HTTP to arbitrary customer domains** from the app runtime. If egress is
  ```
  restricted (Vercel firewall / VPC), WP calls fail — verify before Phase 2.
  ```



### Test environment

- [ ] **Stand up a WordPress test site** with HTTPS and an admin account. Needed to develop
  ```
  Phase 2 at all. A cheap managed host or local Docker + tunnel both work.
  ```
- [ ] **Provision variant sites** for the matrix: one with Yoast, one with Rank Math, one
  ```
  multisite. These surface the `unfiltered_html` and duplicate-schema bugs.
  ```
- [ ] **Confirm** `authorize-application.php` **is reachable** on your test host — some managed
  ```
  hosts and security plugins disable it, which decides how prominent the manual-credential
  fallback needs to be.
  ```



### Product / content

- [ ] **Decide the author byline.** `approveBountyToShopify.ts:426` hardcodes
  ```
  `author: { name: "Ramappa Ramachandra" }`. WP needs a numeric user ID. Map to the
  connecting user, a configured author, or the site default?
  ```
- [ ] **Confirm post status.** Shopify publishes live (`isPublished: true`). Should WordPress
  ```
  go straight to `publish`, or land in `draft`/`pending` for review?
  ```
- [ ] **Provide the plugin's display name, slug, author URI, and icon** for the plugin header
  ```
  and the WP admin listing.
  ```
- [ ] **Confirm the landing-page listing.** WooCommerce is already on `IntegrationsSection`;
  ```
  adding WordPress next to it means we're publicly claiming both.
  ```



### Post-merge

- [ ] **Backfill check:** any company whose `CompanyIntegrationCms` row was touched by the old
  ```
  broken `wpSafeFetch` path (it read the Shopify row's `appUrl`). Confirm nothing was
  written back — the stub was read-only, so this is likely a no-op, but verify.
  ```
- [ ] **Docs:** a short customer-facing "Connect WordPress" guide covering the handshake, the
  ```
  plugin install, and what the schema status badge means.
  ```

---



# Environment variables to create

Add to `.env`, `.env.example`, and every deployed environment.

### Required

```bash
# AES-256-GCM key for WordPress application passwords at rest.
# Generate: openssl rand -base64 32
# MUST be distinct from JWT_SECRET — rotating JWT_SECRET must not brick WP connections.
WORDPRESS_CREDENTIALS_SECRET=

# Stable UUIDv4 identifying our app in the WP Application Password handshake.
# Sent as ?app_id=; lets users find and revoke our credential in their WP profile.
# Generate once: uuidgen
WORDPRESS_APP_ID=

# Public HTTPS origin that WordPress redirects back to after authorization.
# Must exactly match the success_url we send. Local dev needs a tunnel (ngrok/cloudflared).
# e.g. https://app.example.com
WORDPRESS_CALLBACK_ORIGIN=
```



### Optional (sensible defaults in code)

```bash
# Display name shown on the WP authorization screen. Default: "Immortel"
WORDPRESS_APP_NAME=Immortel

# Per-request timeout in ms for customer WP REST calls. Default: 15000
WORDPRESS_API_TIMEOUT_MS=15000

# Allow http:// and localhost site URLs. Dev only — never set in production.
# Default: false
WORDPRESS_ALLOW_INSECURE_HTTP=false

# Fallback numeric WP user ID for post authorship when none is resolved.
# Default: the site's default author from the probe.
WORDPRESS_DEFAULT_AUTHOR_ID=

# Public URL of the companion plugin zip, linked from the connection modal.
# Default: /downloads/immortel-schema-bridge.zip (served from public/)
WORDPRESS_PLUGIN_DOWNLOAD_URL=

# Hours before a cached capability probe is re-run. Default: 24
WORDPRESS_PROBE_TTL_HOURS=24
```



### Already present — no action needed

`MICROSERVICE_URL` (JSON-LD originates here via `huntForCompany`), `DATABASE_URL`,
`JWT_SECRET`, and all `SHOPIFY_*` vars are untouched by this work.