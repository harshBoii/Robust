# WordPress Publishing — End-to-End Test Runbook

**Goal:** connect a real WordPress site to Robust and publish a real blog post with live
JSON-LD, without Docker and without a paid host.

**Time:** ~30 minutes.

---

## Pre-flight: three `.env` fixes

### 1. `WORDPRESS_CALLBACK_ORIGIN` — must be `127.0.0.1`, not `localhost`

For local testing, change it to:

```bash
WORDPRESS_CALLBACK_ORIGIN="http://127.0.0.1:3000"
```

WordPress hard-rejects a non-HTTPS `success_url` — `authorize-application.php` calls
`wp_die()` before the approve screen even renders. The **only** exceptions are the literal
loopback hosts `127.0.0.1` and `[::1]`. `localhost` is *not* on that list:

```php
// wp-admin/includes/user.php — wp_is_authorize_application_redirect_url_valid()
$is_loopback = in_array( strtolower( $host ), array( '127.0.0.1', '[::1]' ), true );
if ( 'http' === $scheme && ! $is_local && ! $is_loopback ) {
    return new WP_Error( 'invalid_redirect_scheme', 'The URL must be served over a secure connection.' );
}
```

This landed in WP 6.3.2, so any sandbox spun up today has it.

Then **use `http://127.0.0.1:3000` in your browser too**, not `localhost:3000` — the session
cookie is host-scoped, and the callback lands on `127.0.0.1`.

Set it back to `https://www.tryrobust.com` before deploying.

### 2. Delete `WORDPRESS_DEFAULT_AUTHOR_ID`

`"0982345867"` is not a WordPress user ID — those are small sequential integers. It is only
consulted when the `users/me` probe fails, and if it ever kicks in every publish will be
rejected with `rest_invalid_param`. Omitting it makes WordPress attribute posts to the
authenticating user, which is the behavior you asked for.

### 3. `WORDPRESS_APP_ID` casing — already handled in code

WordPress validates it with `wp_is_uuid()`, whose regex is `[0-9a-f]` with **no `i` flag**.
`uuidgen` on macOS emits uppercase, which WP rejects outright ("The application ID must be
a UUID"). `getWordPressAppId()` now lowercases and shape-checks it, so your existing value
works as-is. Lowercasing it in `.env` anyway does no harm.

---

## ⚠️ Your local dev server writes to the production database

`DATABASE_URL` points at Neon. Publishing a test post will really set
`citationBounty.publishedAt`, overwrite `aeoPage.canonicalUrl`, and run
`syncBountyRevenueForCompany`.

Pick a bounty you do not mind mutating, and note its `aeoPage.canonicalUrl` before you start
so you can restore it. Publishing is not idempotent — a second publish creates a second
WordPress post.

---

## Step 1 — Get a WordPress site (2 min)

Use **InstaWP** or **TasteWP**. Both give an instant, publicly reachable HTTPS WordPress
with full admin — which is what this needs, because *our server* fetches the site.

| | InstaWP | TasteWP |
|---|---|---|
| Free tier | 3 sites, 48 h each | 2 sites/48 h anonymous; 6 sites/7 days registered |
| Domain | `*.instawp.xyz` | `*.tastewp.com` |
| HTTPS | yes | yes |

Register with TasteWP if you want 7 days rather than 48 hours.

1. Go to [instawp.com](https://instawp.com/) → sign up → **New Site**.
2. Pick the latest WordPress and PHP 8.2+.
3. Use **Magic Login** / **Auto Login** to land in `/wp-admin`.
4. Copy the site URL, e.g. `https://something.instawp.xyz`.

**Not viable, to save you the detour:**
- **WordPress.com free/Personal** — no Application Passwords, no plugin uploads.
- **WordPress Playground** (`playground.wordpress.net`) — runs in your browser via WASM. It
  has no public origin, so our server cannot reach it. Rules out the whole flow.

## Step 2 — Set permalinks to "Post name"

In wp-admin: **Settings → Permalinks → Post name → Save**.

With plain permalinks the REST root is `/?rest_route=/` rather than `/wp-json`, which is the
usual cause of a `rest_unreachable` error on connect.

## Step 3 — Confirm the REST API is reachable

```bash
curl -s https://YOUR-SITE.instawp.xyz/wp-json | head -c 300
```

You want JSON with a `namespaces` array. If you get HTML or a 403, a security plugin or
basic-auth is in the way — and note that WordPress refuses application passwords entirely on
sites behind basic auth.

## Step 4 — Start Robust

```bash
npm run dev
```

Open **`http://127.0.0.1:3000`** and log in.

## Step 5 — Connect, with no plugin installed yet

Do this pass *before* installing the companion plugin, so you exercise the fallback path and
watch the mode change later.

1. **Profile → Integrations → WordPress → Manage.**
2. Paste the site URL → **Connect WordPress**.
3. You land on your own wp-admin authorize screen → **Yes, I approve**.
4. You are redirected back to `127.0.0.1:3000` and the modal reopens.

**Expected:** "Connected · your-username", schema badge **Inline schema** (amber).

`INLINE` is correct here: an InstaWP admin on single-site has `unfiltered_html`, so the
`<script>` tag will survive `wp_kses`.

**If it fails:**

| Error | Cause |
|---|---|
| `rest_unreachable` | Step 2 or 3 — permalinks or a blocking plugin |
| `The application ID must be a UUID` | Uppercase `WORDPRESS_APP_ID` — pull the latest branch |
| `The URL must be served over a secure connection` | You used `localhost`, not `127.0.0.1` |
| `state_mismatch` | Took >10 min to approve; the state cookie expired. Retry |
| Bounced to `/login` | Session expired mid-handshake; log in and retry |

**Fallback if your host blocks the handshake:** click **Enter credentials manually**, then in
wp-admin go to **Users → Profile → Application Passwords**, create one named "Robust", and
paste it. This path has no HTTPS requirement at all and tests everything except the redirect.

## Step 6 — Publish a post

1. Open a bounty that has a generated article: **Organic → Bounty → [pick one] → Hunt**.
2. In **Approve & Publish**, set **Platform = Blogs**.
3. Set **Publish to = WordPress**. If Shopify is also connected the picker starts empty and
   the button stays disabled until you choose — that is the ambiguity guard working.
4. Click **Approve & Publish**.

**Expected:** "Published blog successfully." — no warnings.

If you get *"Schema was sent but could not be confirmed on the live page"*, the post
published but WordPress stripped the script tag. That is the verification step doing its job.

## Step 7 — Verify on WordPress

1. **Posts → All Posts** — your article, status **Published**.
2. Its **Category** should be the topic slug (or `quick-reads` as the fallback).
3. **Tags:** `geo`, `bounty`, and the topic slug.
4. Open the post, **View Source**, search for `application/ld+json`. You should find your
   graph near the end of the body.
5. Paste the post URL into the
   [Rich Results Test](https://search.google.com/test/rich-results) — it should detect
   `Article`, plus `FAQPage` if the page had FAQs.

Then confirm the round-trip landed in the database:

```sql
SELECT slug, "canonicalUrl", "wordpressPostId", "wordpressSiteId"
FROM aeo_pages WHERE "wordpressPostId" IS NOT NULL;

SELECT slug, name, "wpCategoryId" FROM wordpress_blog_channels;
```

## Step 8 — Install the companion plugin and re-test

This is the part with real Shopify parity, so it is worth the second pass.

1. Build it if you have not: `./tools/wordpress-plugin/build.sh`
2. wp-admin → **Plugins → Add New → Upload Plugin** → `public/downloads/immortel-schema-bridge.zip`
   → **Install** → **Activate**.
3. Back in Robust: **Integrations → WordPress → Verify site**.

**Expected:** badge flips to **Full schema** (green), and the plugin version appears.

4. Publish a *different* bounty.
5. View source on the new post — the JSON-LD is now in `<head>` with
   `data-immortel="1"`, not in the body.

## Step 9 — Optional: SEO plugin interop

Install **Yoast SEO** (free) and hit **Verify site** again. Publish once more and view
source: there should be exactly **one** `ld+json` block — Yoast's — with our non-competing
nodes (`FAQPage`, etc.) merged in. Two `Article` nodes on one page means the merge filter
regressed.

---

## Cleanup

- Set `WORDPRESS_CALLBACK_ORIGIN` back to `https://www.tryrobust.com`.
- Restore any `aeoPage.canonicalUrl` you overwrote.
- **Integrations → WordPress → Disconnect** (revokes the application password on the WP side).
- Let the sandbox expire on its own.

---

## Sources

- [wp_is_authorize_application_password_request_valid()](https://developer.wordpress.org/reference/functions/wp_is_authorize_application_password_request_valid/)
- [WordPress core `authorize-application.php`](https://github.com/WordPress/WordPress/blob/master/wp-admin/authorize-application.php)
- [Application Passwords: Integration Guide](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)
- [Trac #57809 — http success_url for localhost](https://core.trac.wordpress.org/ticket/57809)
- [InstaWP free plan](https://instawp.com/instawp-free-plan-features-overview/)
- [TasteWP](https://sourceforge.net/software/product/TasteWP/)
