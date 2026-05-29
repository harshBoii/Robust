import { prisma } from "@/lib/prisma";
import { ShopifyAdminError, shopifyGraphql } from "@/lib/shopify/admin";
import { syncBountyRevenueForCompany } from "@/lib/geo/radar/bountySync";
import {
  buildRelatedArticlesAppend,
  minimalMarkdownToHtml,
} from "@/lib/geo/bounty/markdownToHtmlForPublish";

const JSON_LD_NAMESPACE = "custom";
const JSON_LD_KEY = "json_ld";

const PAYLOAD_NAMESPACE = "custom";
const PAYLOAD_KEY = "immortel_payload";

const UPDATE_ARTICLE = `
  mutation UpdateArticle($id: ID!, $article: ArticleUpdateInput!) {
    articleUpdate(id: $id, article: $article) {
      article { id handle body }
      userErrors { field message code }
    }
  }
`;

type GqlUserError = { field: string[] | null; message: string; code: string | null };

function topicNameToShopifyBlogHandle(name: string): string | null {
  const handle = name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/\s+/)
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return handle ? handle : null;
}

function jsonStringifyAndValidate(
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  let str: string;
  try {
    str = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return { ok: false, error: "Value is not JSON-serializable" };
  }
  try {
    JSON.parse(str);
  } catch {
    return { ok: false, error: "Value must be valid JSON" };
  }
  return { ok: true, value: str };
}

async function ensureMetafieldDefinition(opts: {
  shopDomain: string;
  accessToken: string;
  namespace: string;
  key: string;
  name: string;
}): Promise<void> {
  const mutation = `
    mutation EnsureMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { field message code }
      }
    }
  `;

  const res = await shopifyGraphql<{
    metafieldDefinitionCreate: {
      createdDefinition: { id: string } | null;
      userErrors: GqlUserError[];
    } | null;
  }>({
    ctx: { shopDomain: opts.shopDomain, accessToken: opts.accessToken },
    query: mutation,
    variables: {
      definition: {
        name: opts.name,
        namespace: opts.namespace,
        key: opts.key,
        type: "json",
        ownerType: "ARTICLE",
      },
    },
  });

  const userErrors = res.data?.metafieldDefinitionCreate?.userErrors ?? [];
  const isAlreadyExists = userErrors.some(
    (e) =>
      e.code === "TAKEN" ||
      e.message?.toLowerCase().includes("already") ||
      e.message?.toLowerCase().includes("taken")
  );

  if (userErrors.length > 0 && !isAlreadyExists) {
    throw new Error(`metafieldDefinitionCreate failed: ${JSON.stringify(userErrors)}`);
  }
}

async function ensureBlogChannel(opts: {
  shopId: string;
  companyId: string;
  shopDomain: string;
  accessToken: string;
  handle: string;
}): Promise<{ blogId: string; existing: boolean }> {
  const existing = await prisma.shopifyBlogChannel.findUnique({
    where: { shopId_handle: { shopId: opts.shopId, handle: opts.handle } },
    select: { shopifyBlogGid: true },
  });
  if (existing) return { blogId: existing.shopifyBlogGid, existing: true };

  const mutation = `
    mutation BlogCreate($blog: BlogCreateInput!) {
      blogCreate(blog: $blog) {
        blog { id title handle }
        userErrors { field message code }
      }
    }
  `;

  const title = opts.handle === "vlogs" ? "Vlogs" : opts.handle;

  const res = await shopifyGraphql<{
    blogCreate: {
      blog: { id: string; title: string; handle: string } | null;
      userErrors: GqlUserError[];
    } | null;
  }>({
    ctx: { shopDomain: opts.shopDomain, accessToken: opts.accessToken },
    query: mutation,
    variables: { blog: { title, handle: opts.handle } },
  });

  const blogCreate = res.data?.blogCreate;
  const userErrors = blogCreate?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(`blogCreate userErrors: ${JSON.stringify(userErrors)}`);
  }

  const blogId = blogCreate?.blog?.id ?? null;
  if (!blogId) {
    throw new Error(
      `blogCreate returned null blog with no userErrors. ` +
        `Check that write_content scope is granted for shop ${opts.shopDomain}.`
    );
  }

  await prisma.shopifyBlogChannel.create({
    data: {
      shopId: opts.shopId,
      companyId: opts.companyId,
      handle: opts.handle,
      title,
      shopifyBlogGid: blogId,
    },
  });

  return { blogId, existing: false };
}

function storefrontBlogArticleUrl(opts: {
  shopDomain: string;
  blogHandle: string;
  articleHandle: string;
}): string {
  const host = opts.shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const blog = opts.blogHandle.trim();
  const handle = opts.articleHandle.trim();
  return `https://${host}/blogs/${blog}/${handle}`;
}

async function appendNewArticleLinkToPillar(opts: {
  shopDomain: string;
  accessToken: string;
  channelHandle: string;
  pillarPage: {
    id: string;
    shopifyArticleGid: string | null;
  };
  currentAeoPageId: string;
  pillarMarkdown: string;
  newArticleTitle: string;
  newArticleHandle: string | null | undefined;
}): Promise<void> {
  const gid = opts.pillarPage.shopifyArticleGid;
  const handle = opts.newArticleHandle?.trim();
  if (!gid || !handle) return;
  if (opts.pillarPage.id === opts.currentAeoPageId) return;

  const newArticleUrl = storefrontBlogArticleUrl({
    shopDomain: opts.shopDomain,
    blogHandle: opts.channelHandle,
    articleHandle: handle,
  });
  const updatedPillarPageContent = buildRelatedArticlesAppend(opts.pillarMarkdown, {
    title: opts.newArticleTitle,
    url: newArticleUrl,
  });
  const updatedBody = minimalMarkdownToHtml(updatedPillarPageContent);

  const updateRes = await shopifyGraphql<{
    articleUpdate: {
      article: { id: string; handle: string } | null;
      userErrors: GqlUserError[];
    } | null;
  }>({
    ctx: { shopDomain: opts.shopDomain, accessToken: opts.accessToken },
    query: UPDATE_ARTICLE,
    variables: {
      id: gid,
      article: { body: updatedBody },
    },
  });

  const updateErrors = updateRes.data?.articleUpdate?.userErrors ?? [];
  if (updateErrors.length > 0) {
    console.warn("[geo/approve-shopify] pillar articleUpdate errors", updateErrors);
    return;
  }

  await prisma.aeoPage.update({
    where: { id: opts.pillarPage.id },
    data: { description: updatedPillarPageContent },
  });
}

export async function approveBountyToShopify(opts: {
  companyId: string;
  bountyId: string;
}) {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: opts.bountyId, companyId: opts.companyId },
    select: {
      id: true,
      query: true,
      pageType: true,
      generationContext: true,
      aeoPage: {
        select: {
          id: true,
          slug: true,
          locale: true,
          title: true,
          seoTitle: true,
          description: true,
          publishedAt: true,
          summary: true,
          facts: true,
          claims: true,
          faq: true,
          knowledgeGraph: true,
          llm_topic_id: true,
          llm_topic: { select: { name: true } },
          llm_prompt: { select: { topic: true, llmTopic: { select: { name: true } } } },
        },
      },
    },
  });

  if (!bounty || !bounty.aeoPage) {
    throw new Error("Bounty or generated page not found");
  }

  const shop = await prisma.shopifyShop.findFirst({
    where: { companyId: opts.companyId, status: "installed" },
    select: { id: true, shopDomain: true, accessToken: true },
  });

  if (!shop) {
    throw new Error("No connected Shopify store found");
  }

  try {
    await ensureMetafieldDefinition({
      shopDomain: shop.shopDomain,
      accessToken: shop.accessToken,
      namespace: JSON_LD_NAMESPACE,
      key: JSON_LD_KEY,
      name: "JSON-LD",
    });
    await ensureMetafieldDefinition({
      shopDomain: shop.shopDomain,
      accessToken: shop.accessToken,
      namespace: PAYLOAD_NAMESPACE,
      key: PAYLOAD_KEY,
      name: "Immortel Payload",
    });
  } catch (e) {
    const details =
      e instanceof ShopifyAdminError
        ? { message: e.message, status: e.status, body: e.body }
        : { message: e instanceof Error ? e.message : String(e) };
    console.error("[geo/approve-shopify] ensureMetafieldDefinition failed", details);
    throw new Error("Failed to ensure metafield definitions");
  }

  let blogId: string;
  const rawTopicName =
    bounty.aeoPage.llm_topic?.name ??
    bounty.aeoPage.llm_prompt?.llmTopic?.name ??
    bounty.aeoPage.llm_prompt?.topic ??
    "";
  const channelHandle = topicNameToShopifyBlogHandle(rawTopicName) ?? "quick-reads";
  try {
    const ensured = await ensureBlogChannel({
      shopId: shop.id,
      companyId: opts.companyId,
      shopDomain: shop.shopDomain,
      accessToken: shop.accessToken,
      handle: channelHandle,
    });
    blogId = ensured.blogId;
  } catch (e) {
    const details =
      e instanceof ShopifyAdminError
        ? { message: e.message, status: e.status, body: e.body }
        : { message: e instanceof Error ? e.message : String(e) };
    console.error("[geo/approve-shopify] ensureBlogChannel failed", details);
    throw new Error(`Failed to ensure blog channel exists: ${details.message}`);
  }

  const aeoPage = bounty.aeoPage;

  const pillarPage = aeoPage.llm_topic_id
    ? await prisma.aeoPage.findFirst({
        where: { companyId: opts.companyId, llm_topic_id: aeoPage.llm_topic_id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          slug: true,
          locale: true,
          title: true,
          seoTitle: true,
          description: true,
          canonicalUrl: true,
          shopifyArticleGid: true,
          createdAt: true,
          publishedAt: true,
        },
      })
    : null;

  const pillarPageContent = pillarPage?.description ?? "";
  const topicPageCount = aeoPage.llm_topic_id
    ? await prisma.aeoPage.count({
        where: { companyId: opts.companyId, llm_topic_id: aeoPage.llm_topic_id },
      })
    : 0;

  const title = (aeoPage.seoTitle ?? aeoPage.title ?? bounty.query).trim();
  const body = minimalMarkdownToHtml(aeoPage.description ?? "");
  const publishDate = aeoPage.publishedAt ? aeoPage.publishedAt.toISOString() : null;

  const jsonLdCandidate = aeoPage.knowledgeGraph ?? {};
  const jsonLdStr = jsonStringifyAndValidate(jsonLdCandidate);
  if (!jsonLdStr.ok) {
    throw new Error(`Invalid JSON-LD payload: ${jsonLdStr.error}`);
  }

  const immortelPayload = {
    bountyId: bounty.id,
    query: bounty.query,
    pageType: bounty.pageType,
    pillarPage: pillarPage
      ? {
          id: pillarPage.id,
          slug: pillarPage.slug,
          locale: pillarPage.locale,
          title: pillarPage.title,
          seoTitle: pillarPage.seoTitle,
          canonicalUrl: pillarPage.canonicalUrl,
          publishedAt: pillarPage.publishedAt?.toISOString() ?? null,
          createdAt: pillarPage.createdAt.toISOString(),
        }
      : null,
    aeoPage: {
      id: aeoPage.id,
      slug: aeoPage.slug,
      locale: aeoPage.locale,
      title: aeoPage.title,
      seoTitle: aeoPage.seoTitle,
      publishedAt: publishDate,
      summary: aeoPage.summary,
      facts: aeoPage.facts,
      claims: aeoPage.claims,
      faq: aeoPage.faq,
      jsonLd: jsonLdCandidate,
    },
    generationContext: bounty.generationContext,
  };

  const payloadStr = jsonStringifyAndValidate(immortelPayload);
  if (!payloadStr.ok) {
    throw new Error(`Invalid metadata payload: ${payloadStr.error}`);
  }

  const mutation = `
    mutation ArticleCreate($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article { id handle title }
        userErrors { field message code }
      }
    }
  `;

  const res = await shopifyGraphql<{
    articleCreate: {
      article: { id: string; handle: string; title: string } | null;
      userErrors: GqlUserError[];
    };
  }>({
    ctx: { shopDomain: shop.shopDomain, accessToken: shop.accessToken },
    query: mutation,
    variables: {
      article: {
        blogId,
        title,
        body,
        author: { name: "Ramappa Ramachandra" },
        isPublished: true,
        ...(publishDate ? { publishDate } : {}),
        tags: ["geo", "bounty", channelHandle],
        metafields: [
          {
            namespace: JSON_LD_NAMESPACE,
            key: JSON_LD_KEY,
            type: "json",
            value: jsonLdStr.value,
          },
          {
            namespace: PAYLOAD_NAMESPACE,
            key: PAYLOAD_KEY,
            type: "json",
            value: payloadStr.value,
          },
          { namespace: "seo", key: "title", type: "single_line_text_field", value: aeoPage.seoTitle ?? title },
          { namespace: "seo", key: "description", type: "single_line_text_field", value: (aeoPage.summary as string) ?? "" },
        ],
      },
    },
  });

  const article = res.data.articleCreate.article;
  const userErrors = res.data.articleCreate.userErrors ?? [];

  if (userErrors.length > 0 && article?.id) {
    const publishedCanonical =
      article.handle &&
      storefrontBlogArticleUrl({
        shopDomain: shop.shopDomain,
        blogHandle: channelHandle,
        articleHandle: article.handle,
      });
    await prisma.aeoPage.update({
      where: { id: aeoPage.id },
      data: {
        ...(publishedCanonical ? { canonicalUrl: publishedCanonical } : {}),
        shopifyArticleGid: article.id,
      },
    });
    if (pillarPage && article.handle && topicPageCount > 1) {
      await appendNewArticleLinkToPillar({
        shopDomain: shop.shopDomain,
        accessToken: shop.accessToken,
        channelHandle,
        pillarPage: { id: pillarPage.id, shopifyArticleGid: pillarPage.shopifyArticleGid },
        currentAeoPageId: aeoPage.id,
        pillarMarkdown: pillarPageContent,
        newArticleTitle: title,
        newArticleHandle: article.handle,
      });
    }
    await prisma.citationBounty.update({
      where: { id: opts.bountyId },
      data: { publishedAt: new Date() },
    });
    await syncBountyRevenueForCompany(prisma, opts.companyId);
    return {
      articleId: article.id,
      canonicalUrl: publishedCanonical ?? null,
      channelHandle,
      partial: true,
      userErrors,
    };
  }

  if (userErrors.length > 0) {
    throw new Error("Failed to create article");
  }

  const publishedCanonical =
    article?.handle &&
    storefrontBlogArticleUrl({
      shopDomain: shop.shopDomain,
      blogHandle: channelHandle,
      articleHandle: article.handle,
    });
  await prisma.aeoPage.update({
    where: { id: aeoPage.id },
    data: {
      ...(publishedCanonical ? { canonicalUrl: publishedCanonical } : {}),
      ...(article?.id ? { shopifyArticleGid: article.id } : {}),
    },
  });

  if (pillarPage && article?.handle && topicPageCount > 1) {
    await appendNewArticleLinkToPillar({
      shopDomain: shop.shopDomain,
      accessToken: shop.accessToken,
      channelHandle,
      pillarPage: { id: pillarPage.id, shopifyArticleGid: pillarPage.shopifyArticleGid },
      currentAeoPageId: aeoPage.id,
      pillarMarkdown: pillarPageContent,
      newArticleTitle: title,
      newArticleHandle: article.handle,
    });
  }

  await prisma.citationBounty.update({
    where: { id: opts.bountyId },
    data: { publishedAt: new Date() },
  });
  await syncBountyRevenueForCompany(prisma, opts.companyId);

  return {
    articleId: article?.id ?? null,
    canonicalUrl: publishedCanonical ?? null,
    channelHandle,
    partial: false,
  };
}

