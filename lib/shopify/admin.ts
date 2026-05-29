import { getShopifyApiVersion } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export type ShopifyGraphqlResponse<T = unknown> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function shopifyAdminGraphql<T = unknown>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphqlResponse<T>> {
  const shop = normalizeShopDomain(shopDomain);
  const url = `https://${shop}/admin/api/${getShopifyApiVersion()}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as ShopifyGraphqlResponse<T>;
}

export type ShopifyAdminContext = {
  shopDomain: string;
  accessToken: string;
};

export class ShopifyAdminError extends Error {
  status: number | null;
  body: unknown;
  gqlErrors?: string;

  constructor(
    message: string,
    opts: { status: number | null; body: unknown; gqlErrors?: string }
  ) {
    super(message);
    this.name = "ShopifyAdminError";
    this.status = opts.status;
    this.body = opts.body;
    this.gqlErrors = opts.gqlErrors;
  }
}

export function getAdminBaseUrl(shopDomain: string): string {
  const shop = normalizeShopDomain(shopDomain);
  return `https://${shop}/admin/api/${getShopifyApiVersion()}`;
}

// ─── GraphQL ──────────────────────────────────────────────────────────────────

export async function shopifyGraphql<TData = unknown>(opts: {
  ctx: ShopifyAdminContext;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<{ data: TData; extensions?: unknown; raw: unknown }> {
  const baseUrl = getAdminBaseUrl(opts.ctx.shopDomain);

  const res = await fetch(`${baseUrl}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": opts.ctx.accessToken,
    },
    body: JSON.stringify({
      query: opts.query,
      variables: opts.variables ?? {},
    }),
  });

  const json = await res.json().catch(() => null);

  // FIX 1: Check for top-level GraphQL errors FIRST (HTTP 200 but no `data`).
  // Shopify returns { errors: [...] } with no `data` key for access/scope errors.
  const topLevelErrors = Array.isArray((json as any)?.errors)
    ? (json as any).errors as Array<{ message?: string; extensions?: { code?: string } }>
    : null;

  if (topLevelErrors && topLevelErrors.length > 0) {
    const gqlErrors = topLevelErrors
      .map((e) => {
        const code = e.extensions?.code ? ` [${e.extensions.code}]` : "";
        return `${e.message ?? JSON.stringify(e)}${code}`;
      })
      .join("; ");

    throw new ShopifyAdminError(
      `Shopify GraphQL error: ${gqlErrors}`,
      { status: res.status, body: json, gqlErrors }
    );
  }

  // FIX 2: Non-2xx HTTP errors (should come after gql errors check).
  if (!res.ok) {
    throw new ShopifyAdminError("Shopify GraphQL request failed", {
      status: res.status,
      body: json,
    });
  }

  // FIX 3: `data` is present but null → partial execution with errors already caught above.
  // Only throw if there are genuinely no errors and data is still missing.
  const hasDataProp =
    json !== null &&
    typeof json === "object" &&
    Object.prototype.hasOwnProperty.call(json as Record<string, unknown>, "data");

  if (!hasDataProp) {
    throw new ShopifyAdminError(
      "Shopify GraphQL response missing data property (no errors returned — check query syntax)",
      { status: res.status, body: json }
    );
  }

  // FIX 4: data === null means Shopify ran the mutation but returned null (e.g. object not found).
  // Don't throw — return it and let the caller handle userErrors.
  const data = (json as any).data as TData;

  return { data, extensions: (json as any)?.extensions, raw: json };
}

// ─── REST ─────────────────────────────────────────────────────────────────────

export async function shopifyRestJson<T = unknown>(opts: {
  ctx: ShopifyAdminContext;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; data: T; raw: unknown }> {
  const baseUrl = getAdminBaseUrl(opts.ctx.shopDomain);
  const url = new URL(`${baseUrl}${opts.path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": opts.ctx.accessToken,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ShopifyAdminError("Shopify REST JSON request failed", {
      status: res.status,
      body: json,
    });
  }

  return { status: res.status, data: json as T, raw: json };
}
