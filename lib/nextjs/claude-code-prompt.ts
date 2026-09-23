import { REVALIDATE_ROUTE } from '@/lib/nextjs/types';
import { nextjsStarterFiles } from '@/lib/nextjs/starter-files';

/**
 * The copy-paste prompt a customer runs in Claude Code inside their Next.js repo to install
 * the Robust blog. With credentials it is ready to run; without (e.g. after a page reload,
 * since secrets are only shown once) it contains placeholders for the user to fill in.
 */

export const API_KEY_PLACEHOLDER = '<paste your ROBUST_API_KEY here>';
export const REVALIDATE_SECRET_PLACEHOLDER = '<paste your ROBUST_REVALIDATE_SECRET here>';

export function buildNextjsClaudeCodePrompt(opts: {
  apiBaseUrl: string;
  siteUrl: string;
  basePath: string;
  apiKey?: string | null;
  revalidateSecret?: string | null;
}): string {
  const apiKey = opts.apiKey || API_KEY_PLACEHOLDER;
  const secret = opts.revalidateSecret || REVALIDATE_SECRET_PLACEHOLDER;
  const base = opts.basePath;
  const files = nextjsStarterFiles(base);

  const fileBlocks = files
    .map((f) => {
      const lang = f.path.split('.').pop() ?? 'ts';
      return `### \`${f.path}\` — ${f.description}\n\n\`\`\`${lang}\n${f.content.trimEnd()}\n\`\`\``;
    })
    .join('\n\n');

  return `Set up this Next.js project to show blog articles published from Robust (${opts.apiBaseUrl}).

Articles are written and published in Robust. This site fetches them from Robust's API and renders them at \`${base}\` (index) and \`${base}/[slug]\` (article) with full SEO: metadata, canonical URL, Open Graph, an FAQ section and schema.org JSON-LD. When an article is published, Robust calls \`POST ${REVALIDATE_ROUTE}\` on this site so it shows up immediately.

## 1. Inspect the project first

Before writing anything, check and adapt to:
- **Router**: this guide targets the App Router (\`app/\`). If the project uses \`src/app\`, put files under \`src/\`. If it only uses the Pages Router, implement the same behaviour with \`getStaticProps\`/\`getStaticPaths\` (\`revalidate: 3600\`, \`fallback: 'blocking'\`) and an API route that calls \`res.revalidate(path)\`.
- **Import alias**: the files import \`@/lib/robust/blog\`. If \`@/\` isn't configured in tsconfig/jsconfig, use relative imports instead.
- **Next.js version**: on Next 15+ \`params\` is a Promise (as written). On Next 13/14, type \`params\` as a plain object and drop the \`await\`.
- **Existing routes**: if \`${base}\` already exists, stop and ask me before changing it. If an \`app/sitemap.ts\` already exists, merge the blog entries into it instead of replacing it.
- **Language**: if the project is JavaScript, convert the files to \`.js\`/\`.jsx\` and drop the types.

## 2. Environment variables

Add these to \`.env.local\` (create it if needed, and make sure \`.env*.local\` is in \`.gitignore\` — never commit these):

\`\`\`
ROBUST_API_URL=${opts.apiBaseUrl}
ROBUST_API_KEY=${apiKey}
ROBUST_REVALIDATE_SECRET=${secret}
\`\`\`

Then remind me to add the same three variables to the hosting provider (e.g. Vercel → Project → Settings → Environment Variables, for Production and Preview) and redeploy.

## 3. Create these files

Keep the CSS module as-is (it is scoped, so it won't clash with Tailwind or global styles). If the site has a clear brand colour, set \`--rb-accent\` in \`.root\` to match it. The pages render inside the existing root layout, so the site's header and footer appear automatically.

${fileBlocks}

## 4. Link it up

- Add a "Blog" link to the site's main navigation pointing to \`${base}\` if there is an obvious place for it.
- Don't change \`BLOG_BASE_PATH\` unless you also tell me — it must match the blog path configured in Robust (\`${base}\`).

## 5. Verify

1. Run the project's typecheck/lint and \`next build\`; fix anything that fails.
2. Start the app and open \`${base}\` — it should render (showing "No articles yet" is fine if nothing is published).
3. Check the revalidate endpoint:
   \`curl -i -X POST http://localhost:3000${REVALIDATE_ROUTE} -H "Authorization: Bearer $ROBUST_REVALIDATE_SECRET" -H "Content-Type: application/json" -d '{"type":"test"}'\` → expect \`200\`, and \`401\` with a wrong secret.
4. If an article exists, open it and confirm the page source contains \`<script type="application/ld+json">\` and \`<link rel="canonical" href="${opts.siteUrl}${base}/…">\`.

When you're done, summarize the files you created and anything you adapted, then tell me to deploy and click **Test connection** in Robust → Profile → Integrations → Next.js site.`;
}
