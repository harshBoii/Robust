import { Client } from "@elastic/elasticsearch";

const globalForEs = globalThis as unknown as {
  elasticsearch: Client | undefined;
};

export function getProductsIndex(): string {
  return process.env.PRODUCTS_INDEX?.trim() || "shopify_products";
}

export function isElasticsearchConfigured(): boolean {
  return Boolean(process.env.ELASTICSEARCH_URL?.trim());
}

export function getElasticsearchClient(): Client | null {
  const node = process.env.ELASTICSEARCH_URL?.trim();
  if (!node) return null;

  if (globalForEs.elasticsearch) {
    return globalForEs.elasticsearch;
  }

  const apiKey = process.env.ELASTICSEARCH_API_KEY?.trim();
  const client = new Client({
    node,
    ...(apiKey ? { auth: { apiKey } } : {}),
  });

  if (process.env.NODE_ENV !== "production") {
    globalForEs.elasticsearch = client;
  }

  return client;
}
