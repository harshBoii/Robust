import { prisma } from "@/lib/prisma";

type WpClient = {
  createPost: (params: { title: string; slug: string; status: string; content: string; excerpt?: string }) => Promise<{ id: number; link?: string; guid?: { rendered?: string } }>;
};

export async function wpSafeFetch<T>(companyId: string, fn: (wp: WpClient) => Promise<T>): Promise<{ data: T }> {
  const integration = await prisma.companyIntegrationCms.findFirst({
    where: { companyId, provider: "Shopify" },
    select: { appUrl: true },
  });

  if (!integration?.appUrl) {
    throw new Error("WP_NOT_CONNECTED");
  }

  const wp: WpClient = {
    createPost: async (params) => {
      const res = await fetch(`${integration.appUrl}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`WP_ERROR:${text}`);
      }
      return res.json();
    },
  };

  const data = await fn(wp);
  return { data };
}
