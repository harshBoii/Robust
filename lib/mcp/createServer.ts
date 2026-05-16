import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { signSessionToken } from "@/lib/auth/jwt";
import { getR2PublicObjectUrl } from "@/lib/cloudfare/r2";
import { resolveCompanyByUserNamePassword } from "@/lib/mcp/auth";
import { prisma } from "@/lib/prisma";
import { syncCampaigns, syncAdSets, createAndStoreCampaignFromPreset, createAndStoreAdSetFromPreset } from "@/lib/meta/sync";
import { createAdCreative, getAdCreativePreviews, uploadAdImage, uploadAdVideo } from "@/lib/meta/client";
import { requireMetaAdAccountId, requireMetaFbPageId } from "@/lib/meta/integration-token";

export type CreateMcpServerOptions = {
  /** Preferred public origin for MCP `publicR2Url` responses (bucket custom domain). Falls back to R2_PUBLIC_BASE_URL when omitted. */
  r2PublicBaseUrl?: string;
};

export function createServer(options?: CreateMcpServerOptions): McpServer {
  const mcpR2PublicBaseUrl =
    typeof options?.r2PublicBaseUrl === "string" && options.r2PublicBaseUrl.trim()
      ? options.r2PublicBaseUrl.trim().replace(/\/+$/, "")
      : undefined;

  const server = new McpServer({
    name: "Robust MCP Server",
    version: "0.1.0",
  });

  server.registerTool(
    "hello_miss_robusta",
    {
      title: "Hello from Miss Robusta",
      description: 'Returns the greeting "Hello From Miss Robusta".',
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: "text" as const, text: "Hello From Miss Robusta" }],
      };
    },
  );

  const baseAuthSchema = z.object({
    userName: z.string().min(1).describe("Company userName"),
    password: z.string().min(1).describe("Company password"),
  });

  function appBaseUrl(): string {
    return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  }

  // ─── manage_assets ────────────────────────────────────────────────────────
  const manageAssetsSchema = baseAuthSchema.extend({
    action: z.enum(["upload_link", "list", "get_group"]),
    groupId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
  });

  server.registerTool(
    "manage_assets",
    {
      title: "Manage assets",
      description:
        "upload_link (returns hosted upload link), list (bulk uploads + groups), get_group (group details + resolution variants).",
      inputSchema: (manageAssetsSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = manageAssetsSchema.safeParse(input);
      if (!parsed.success) {
        return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };
      }

      const { userName, password, action, groupId, limit } = parsed.data;
      const company = await resolveCompanyByUserNamePassword({ userName, password });

      if (action === "upload_link") {
        const token = await signSessionToken({
          companyId: company.id,
          userName: company.userName,
          slug: company.slug,
        });
        const url = `${appBaseUrl()}/api/mcp/session?t=${encodeURIComponent(token)}&next=${encodeURIComponent("/create-ad")}`;
        return {
          content: [
            {
              type: "text" as const,
              text:
                "Open this link to log in and upload creatives (it redirects to Create Ad):\n" +
                url +
                "\nAfter uploading and grouping, copy the bulkUploadId and group (bucket) ids shown in the UI.",
            },
          ],
          structuredContent: { uploadUrl: url },
        };
      }

      if (action === "list") {
        const bulks = await prisma.bulkUpload.findMany({
          where: { companyId: company.id },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { id: true, name: true, status: true, createdAt: true },
        });
        const bulkIds = bulks.map((b) => b.id);
        const buckets = await prisma.assetBucket.findMany({
          where: { companyId: company.id, bulkUploadId: { in: bulkIds } },
          select: { id: true, bulkUploadId: true, label: true, bucketType: true, bucketValue: true, _count: { select: { assets: true } } },
          orderBy: { updatedAt: "desc" },
          take: 500,
        });
        const byBulk: Record<string, unknown[]> = {};
        for (const b of buckets) {
          if (!byBulk[b.bulkUploadId]) byBulk[b.bulkUploadId] = [];
          byBulk[b.bulkUploadId]!.push({
            id: b.id,
            label: b.label,
            bucketType: b.bucketType,
            bucketValue: b.bucketValue,
            assetCount: b._count.assets,
          });
        }
        const result = bulks.map((b) => ({
          id: b.id,
          name: b.name,
          status: b.status,
          createdAt: b.createdAt,
          groups: byBulk[b.id] ?? [],
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ bulkUploads: result }) }],
          structuredContent: { bulkUploads: result },
        };
      }

      if (action === "get_group") {
        if (!groupId) {
          return { content: [{ type: "text" as const, text: "Error: groupId is required for get_group." }] };
        }
        const bucket = await prisma.assetBucket.findFirst({
          where: { id: groupId, companyId: company.id },
          select: { id: true, label: true, bucketType: true, bucketValue: true, bulkUploadId: true },
        });
        if (!bucket) {
          return { content: [{ type: "text" as const, text: "Error: Group not found." }] };
        }
        const assets = await prisma.asset.findMany({
          where: { companyId: company.id, assetBucketId: bucket.id },
          orderBy: { createdAt: "desc" },
          take: 500,
          select: {
            id: true,
            title: true,
            assetType: true,
            status: true,
            resolution: true,
            duration: true,
            thumbnailUrl: true,
            playbackUrl: true,
            createdAt: true,
          },
        });
        const result = { group: bucket, variants: assets };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      }

      return { content: [{ type: "text" as const, text: "Error: Unknown action." }] };
    }) as any,
  );

  // ─── get_asset_public_r2_urls ─────────────────────────────────────────────
  const getAssetPublicR2UrlsSchema = baseAuthSchema.extend({
    bulkUploadId: z.string().optional().describe("Bulk upload session id (all assets in that session)"),
    assetBucketId: z.string().optional().describe("Asset bucket / group id (assets in that bucket only)"),
    limit: z.number().int().min(1).max(500).optional().default(200),
  });

  server.registerTool(
    "get_asset_public_r2_urls",
    {
      title: "Public R2 URLs for bulk or bucket",
      description:
        "Returns stable public HTTPS URLs (MCP/public base + r2Key) for assets in a bulk upload session or a single asset bucket. Provide exactly one of bulkUploadId or assetBucketId.",
      inputSchema: (getAssetPublicR2UrlsSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = getAssetPublicR2UrlsSchema.safeParse(input);
      if (!parsed.success) {
        return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };
      }
      const { userName, password, bulkUploadId, assetBucketId, limit } = parsed.data;
      const bulk = Boolean(bulkUploadId?.trim());
      const bucket = Boolean(assetBucketId?.trim());
      if (bulk === bucket) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Provide exactly one of bulkUploadId or assetBucketId.",
            },
          ],
        };
      }

      const company = await resolveCompanyByUserNamePassword({ userName, password });
      const publicBaseConfigured = Boolean(
        mcpR2PublicBaseUrl || process.env.R2_PUBLIC_BASE_URL?.trim(),
      );

      let scope: { type: "bulk_upload"; id: string; name?: string } | { type: "asset_bucket"; id: string; label?: string };
      let where: { companyId: string; bulkUploadId?: string; assetBucketId?: string };

      if (bulk) {
        const id = bulkUploadId!.trim();
        const session = await prisma.bulkUpload.findFirst({
          where: { id, companyId: company.id },
          select: { id: true, name: true },
        });
        if (!session) {
          return { content: [{ type: "text" as const, text: "Error: Bulk upload not found." }] };
        }
        scope = { type: "bulk_upload", id: session.id, name: session.name };
        where = { companyId: company.id, bulkUploadId: session.id };
      } else {
        const id = assetBucketId!.trim();
        const b = await prisma.assetBucket.findFirst({
          where: { id, companyId: company.id },
          select: { id: true, label: true },
        });
        if (!b) {
          return { content: [{ type: "text" as const, text: "Error: Asset bucket not found." }] };
        }
        scope = { type: "asset_bucket", id: b.id, label: b.label };
        where = { companyId: company.id, assetBucketId: b.id };
      }

      const rows = await prisma.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          assetType: true,
          status: true,
          r2Key: true,
          thumbnailUrl: true,
          playbackUrl: true,
        },
      });

      const assets = rows.map((a) => ({
        ...a,
        publicR2Url: getR2PublicObjectUrl(a.r2Key, mcpR2PublicBaseUrl),
      }));

      const result = {
        scope,
        publicBaseConfigured,
        notice: publicBaseConfigured
          ? undefined
          : "No MCP or R2 public base URL configured; publicR2Url is null for each asset.",
        assets,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: result,
      };
    }) as any,
  );

  // ─── manage_campaigns ─────────────────────────────────────────────────────
  const manageCampaignsSchema = baseAuthSchema.extend({
    action: z.enum(["list", "list_presets", "create"]),
    presetId: z.string().optional(),
    name: z.string().optional(),
  });

  server.registerTool(
    "manage_campaigns",
    {
      title: "Manage campaigns",
      description: "list, list_presets, create (from preset).",
      inputSchema: (manageCampaignsSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = manageCampaignsSchema.safeParse(input);
      if (!parsed.success) {
        return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };
      }
      const { userName, password, action, presetId, name } = parsed.data;
      const company = await resolveCompanyByUserNamePassword({ userName, password });

      const integration = await prisma.metaIntegration.findUnique({
        where: { companyId: company.id },
        select: { id: true },
      });
      if (!integration) {
        return { content: [{ type: "text" as const, text: "Error: Meta not connected." }] };
      }

      if (action === "list") {
        const campaigns = await syncCampaigns(integration.id);
        return { content: [{ type: "text" as const, text: JSON.stringify({ campaigns }) }], structuredContent: { campaigns } };
      }

      if (action === "list_presets") {
        const presets = await prisma.campaignPreset.findMany({
          where: { companyId: company.id },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          take: 200,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ presets }) }], structuredContent: { presets } };
      }

      if (action === "create") {
        if (!presetId) return { content: [{ type: "text" as const, text: "Error: presetId is required." }] };
        const campaign = await createAndStoreCampaignFromPreset({
          metaIntegrationId: integration.id,
          presetId,
          name: typeof name === "string" && name.trim() ? name.trim().slice(0, 255) : undefined,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ campaign }) }], structuredContent: { campaign } };
      }

      return { content: [{ type: "text" as const, text: "Error: Unknown action." }] };
    }) as any,
  );

  // ─── manage_adsets ────────────────────────────────────────────────────────
  const manageAdsetsSchema = baseAuthSchema.extend({
    action: z.enum(["list", "list_presets", "create"]),
    campaignId: z.string().optional().describe("Meta campaign DB id (metaCampaign table id)"),
    presetId: z.string().optional(),
    name: z.string().optional(),
    createMode: z.enum(["single", "by_group"]).optional().default("single"),
    groupToAdset: z.record(
      z.string(),
      z.object({
        presetId: z.string().optional(),
        name: z.string().optional(),
      }),
    ).optional(),
  });

  server.registerTool(
    "manage_adsets",
    {
      title: "Manage ad sets",
      description: "list, list_presets, create ad sets (single or by_group mapping).",
      inputSchema: (manageAdsetsSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = manageAdsetsSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };
      const { userName, password, action, campaignId, presetId, name, createMode, groupToAdset } = parsed.data;
      const company = await resolveCompanyByUserNamePassword({ userName, password });

      const integration = await prisma.metaIntegration.findUnique({
        where: { companyId: company.id },
        select: { id: true },
      });
      if (!integration) return { content: [{ type: "text" as const, text: "Error: Meta not connected." }] };

      if (action === "list") {
        if (!campaignId) return { content: [{ type: "text" as const, text: "Error: campaignId is required." }] };
        const adSets = await syncAdSets({ metaIntegrationId: integration.id, campaignDbId: campaignId });
        return { content: [{ type: "text" as const, text: JSON.stringify({ adSets }) }], structuredContent: { adSets } };
      }

      if (action === "list_presets") {
        const presets = await prisma.adsetPreset.findMany({
          where: { companyId: company.id },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          take: 200,
          include: { pinnedCampaign: { select: { id: true, name: true } } },
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ presets }) }], structuredContent: { presets } };
      }

      if (action === "create") {
        if (!campaignId) return { content: [{ type: "text" as const, text: "Error: campaignId is required." }] };

        if (createMode === "by_group") {
          const map = groupToAdset ?? {};
          const entries = Object.entries(map);
          if (entries.length === 0) {
            return { content: [{ type: "text" as const, text: "Error: groupToAdset is required for by_group." }] };
          }
          const createdAdSets: Array<{ groupId: string; adSetId: string; adSetName: string }> = [];
          for (const [groupId, spec] of entries) {
            if (!spec.presetId) {
              return { content: [{ type: "text" as const, text: `Error: Missing presetId for group ${groupId}.` }] };
            }
            const adSet = await createAndStoreAdSetFromPreset({
              metaIntegrationId: integration.id,
              campaignDbId: campaignId,
              presetId: spec.presetId,
              name: typeof spec.name === "string" && spec.name.trim() ? spec.name.trim().slice(0, 255) : undefined,
            });
            createdAdSets.push({ groupId, adSetId: adSet.id, adSetName: (adSet as any).name ?? adSet.id });
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ createdAdSets }) }],
            structuredContent: { createdAdSets },
          };
        }

        if (!presetId) return { content: [{ type: "text" as const, text: "Error: presetId is required." }] };
        const adSet = await createAndStoreAdSetFromPreset({
          metaIntegrationId: integration.id,
          campaignDbId: campaignId,
          presetId,
          name: typeof name === "string" && name.trim() ? name.trim().slice(0, 255) : undefined,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ adSet }) }], structuredContent: { adSet } };
      }

      return { content: [{ type: "text" as const, text: "Error: Unknown action." }] };
    }) as any,
  );

  // ─── preview_ad ──────────────────────────────────────────────────────────
  const previewSchema = baseAuthSchema.extend({
    groupId: z.string().min(1),
    assetId: z.string().min(1),
    adFormat: z.string().optional().describe("Meta ad_format for previews (default DESKTOP_FEED_STANDARD)"),
    creative: z.object({
      headline: z.string().min(1),
      primaryText: z.string().optional().default(""),
      description: z.string().optional(),
      landingUrl: z.string().min(1),
      ctaType: z.string().min(1).default("LEARN_MORE"),
      pixelIds: z.array(z.string()).optional(),
    }),
  });

  server.registerTool(
    "preview_ad",
    {
      title: "Preview ad",
      description:
        "Creates a Meta ad creative for an asset and returns Meta preview payload (HTML).",
      inputSchema: (previewSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = previewSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };

      const { userName, password, assetId, groupId, creative, adFormat } = parsed.data;
      const company = await resolveCompanyByUserNamePassword({ userName, password });

      const integration = await prisma.metaIntegration.findUnique({
        where: { companyId: company.id },
        select: { id: true, adAccountId: true, fbPageId: true },
      });
      if (!integration) return { content: [{ type: "text" as const, text: "Error: Meta not connected." }] };

      let adAccountId: string;
      let fbPageId: string;
      try {
        adAccountId = requireMetaAdAccountId(integration.adAccountId);
        fbPageId = requireMetaFbPageId(integration.fbPageId);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Configure ad account and page in workspace settings.",
            },
          ],
        };
      }

      const bucket = await prisma.assetBucket.findFirst({
        where: { id: groupId, companyId: company.id },
        select: { id: true },
      });
      if (!bucket) return { content: [{ type: "text" as const, text: "Error: Group not found." }] };

      const asset = await prisma.asset.findFirst({
        where: { id: assetId, companyId: company.id, assetBucketId: bucket.id },
        select: { id: true, title: true, assetType: true, r2Key: true, r2Bucket: true, mimeType: true, playbackUrl: true },
      });
      if (!asset) return { content: [{ type: "text" as const, text: "Error: Asset not found in group." }] };

      // If we already have MetaMedia for this asset, reuse it; otherwise upload to Meta now.
      const existing = await prisma.metaMedia.findFirst({
        where: { metaIntegrationId: integration.id, assetId: asset.id },
        select: { imageHash: true, videoId: true, kind: true },
      });

      let imageHash: string | null = existing?.imageHash ?? null;
      let videoId: string | null = existing?.videoId ?? null;

      if (!imageHash && !videoId) {
        // Download bytes from R2 public URL if available, otherwise fail (we can extend later).
        // For now, rely on existing public URL pipeline via /api/assets/:id/url in the app.
        const assetUrlRes = await fetch(`${appBaseUrl()}/api/assets/${encodeURIComponent(asset.id)}/url`, {
          headers: { Accept: "application/json" },
        });
        if (!assetUrlRes.ok) {
          return { content: [{ type: "text" as const, text: `Error: Unable to resolve asset URL (${assetUrlRes.status}).` }] };
        }
        const assetUrlJson = (await assetUrlRes.json()) as { url?: string };
        const url = assetUrlJson.url;
        if (!url) return { content: [{ type: "text" as const, text: "Error: Asset URL missing." }] };

        const fileRes = await fetch(url);
        if (!fileRes.ok) {
          return { content: [{ type: "text" as const, text: `Error: Failed to download asset bytes (${fileRes.status}).` }] };
        }
        const bytes = new Uint8Array(await fileRes.arrayBuffer());

        if (asset.assetType === "VIDEO") {
          const up = await uploadAdVideo({
            companyId: company.id,
            adAccountId,
            bytes,
            filename: `${asset.title}`.slice(0, 120) || "video.mp4",
            name: asset.title.slice(0, 120) || "Robust Video",
          });
          videoId = up.videoId;
          await prisma.metaMedia.upsert({
            where: { assetId: asset.id },
            create: {
              metaIntegrationId: integration.id,
              kind: "video",
              videoId,
              assetId: asset.id,
              filename: asset.title.slice(0, 500),
              mimeType: asset.mimeType ?? null,
              bytes: bytes.length,
              status: "ready",
            },
            update: { videoId, kind: "video", status: "ready" },
          });
        } else {
          const up = await uploadAdImage({
            companyId: company.id,
            adAccountId,
            bytes,
            filename: `${asset.title}`.slice(0, 120) || "image.jpg",
          });
          imageHash = up.imageHash;
          await prisma.metaMedia.upsert({
            where: { assetId: asset.id },
            create: {
              metaIntegrationId: integration.id,
              kind: "image",
              imageHash,
              assetId: asset.id,
              filename: asset.title.slice(0, 500),
              mimeType: asset.mimeType ?? null,
              bytes: bytes.length,
              status: "ready",
            },
            update: { imageHash, kind: "image", status: "ready" },
          });
        }
      }

      const created = await createAdCreative({
        companyId: company.id,
        adAccountId,
        fbPageId,
        headline: creative.headline,
        primaryText: creative.primaryText ?? "",
        description: creative.description ?? null,
        ctaType: creative.ctaType,
        landingUrl: creative.landingUrl,
        imageHash,
        videoId,
        pixelIds: creative.pixelIds ?? null,
      });

      const previews = await getAdCreativePreviews({
        companyId: company.id,
        creativeId: created.id,
        adFormat: adFormat ?? undefined,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ creativeId: created.id, previews }) }],
        structuredContent: { creativeId: created.id, previews },
      };
    }) as any,
  );

  // ─── publish_ads ─────────────────────────────────────────────────────────
  const publishSchema = baseAuthSchema.extend({
    campaignId: z.string().min(1).describe("Meta campaign DB id (metaCampaign table id)"),
    scheduledAt: z.string().optional().describe("ISO datetime"),
    groups: z.array(
      z.object({
        groupId: z.string().min(1),
        adSetId: z.string().min(1),
        assetIds: z.array(z.string().min(1)).min(1),
        headline: z.string().min(1),
        primaryText: z.string().optional(),
        description: z.string().optional(),
        landingUrl: z.string().min(1),
        ctaType: z.string().min(1).default("LEARN_MORE"),
        pixelId: z.string().optional(),
      }),
    ).min(1),
  });

  function parseIsoDate(v: unknown): Date | null {
    if (typeof v !== "string" || !v.trim()) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  server.registerTool(
    "publish_ads",
    {
      title: "Publish ads",
      description: "Creates async publish jobs and returns jobIds (poll with get_ad_status).",
      inputSchema: (publishSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = publishSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };
      const { userName, password, campaignId, groups, scheduledAt } = parsed.data;
      const company = await resolveCompanyByUserNamePassword({ userName, password });

      const integration = await prisma.metaIntegration.findUnique({
        where: { companyId: company.id },
        select: { id: true },
      });
      if (!integration) return { content: [{ type: "text" as const, text: "Error: Meta not connected." }] };

      const campaign = await prisma.metaCampaign.findFirst({
        where: { id: campaignId, metaIntegrationId: integration.id },
        select: { id: true },
      });
      if (!campaign) return { content: [{ type: "text" as const, text: "Error: Campaign not found." }] };

      const scheduleDate = parseIsoDate(scheduledAt);

      // Validate adSets (dedupe)
      const uniqueAdSetIds = [...new Set(groups.map((g) => g.adSetId))];
      const adSetsFound = await prisma.metaAdSet.findMany({
        where: { id: { in: uniqueAdSetIds }, metaIntegrationId: integration.id },
        select: { id: true },
      });
      const foundAdSetIds = new Set(adSetsFound.map((a) => a.id));
      const missingAdSets = uniqueAdSetIds.filter((id) => !foundAdSetIds.has(id));
      if (missingAdSets.length) {
        return { content: [{ type: "text" as const, text: `Error: Ad set not found: ${missingAdSets.join(",")}` }] };
      }

      const allAssetIds = [...new Set(groups.flatMap((g) => g.assetIds))];
      const assetsFound = await prisma.asset.findMany({
        where: { id: { in: allAssetIds }, companyId: company.id },
        select: { id: true },
      });
      const foundAssetIds = new Set(assetsFound.map((a) => a.id));
      const missingAssets = allAssetIds.filter((id) => !foundAssetIds.has(id));
      if (missingAssets.length) {
        return { content: [{ type: "text" as const, text: `Error: Asset not found: ${missingAssets.join(",")}` }] };
      }

      const schedule = scheduleDate
        ? await prisma.adSchedule.create({
            data: { companyId: company.id, scheduledAt: scheduleDate, status: "PENDING" },
            select: { id: true },
          })
        : null;

      const allJobData = groups.flatMap((g) =>
        g.assetIds.map((assetId) => ({
          companyId: company.id,
          metaIntegrationId: integration.id,
          campaignId: campaign.id,
          adSetId: g.adSetId,
          assetId,
          scheduleId: schedule?.id ?? null,
          scheduledAt: scheduleDate,
          status: "QUEUED" as const,
          headlineOverride: g.headline,
          primaryTextOverride: g.primaryText,
          descriptionOverride: g.description,
          landingUrlOverride: g.landingUrl,
          ctaTypeOverride: g.ctaType,
          pixelIdOverride: g.pixelId,
          groupKey: g.groupId,
        })),
      );

      const jobs = await prisma.$transaction(
        allJobData.map((data) => prisma.adPublishJob.create({ data, select: { id: true } })),
      );

      const jobIds = jobs.map((j) => j.id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ jobIds }) }], structuredContent: { jobIds } };
    }) as any,
  );

  // ─── get_ad_status ───────────────────────────────────────────────────────
  const statusSchema = baseAuthSchema.extend({
    jobIds: z.array(z.string().min(1)).min(1),
  });

  server.registerTool(
    "get_ad_status",
    {
      title: "Get ad status",
      description: "Poll publish job status by jobIds.",
      inputSchema: (statusSchema as any).shape,
    },
    (async (input: unknown) => {
      const parsed = statusSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text" as const, text: "Error: Invalid input." }] };
      const { userName, password, jobIds } = parsed.data;
      const company = await resolveCompanyByUserNamePassword({ userName, password });

      const jobs = await prisma.adPublishJob.findMany({
        where: { id: { in: jobIds }, companyId: company.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          lastError: true,
          metaAdDbId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { content: [{ type: "text" as const, text: JSON.stringify({ jobs }) }], structuredContent: { jobs } };
    }) as any,
  );

  return server;
}

