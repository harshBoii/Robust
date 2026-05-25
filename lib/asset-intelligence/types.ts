import { z } from 'zod';

export const topWinningAssetSchema = z.object({
  assetId: z.string(),
  mediaType: z.enum(['VIDEO', 'IMAGE', 'DOCUMENT']),
  downloadUrl: z.string().url(),
});

export type TopWinningAsset = z.infer<typeof topWinningAssetSchema>;

export const analyzeAssetInputSchema = z.object({
  assetId: z.string(),
  mediaType: z.enum(['VIDEO', 'IMAGE', 'DOCUMENT']),
});

export const analyzeRequestSchema = z.object({
  assets: z.array(analyzeAssetInputSchema).min(1).max(10),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export type ProcessFromApiPayload = {
  api_url: string;
  asset_Id: string;
  asset_type: 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  scene_preset: string;
};

export const intelWebhookPayloadSchema = z
  .object({
    assetId: z.string().min(1),
    companyId: z.string().min(1).optional(),
    language: z.string().optional().nullable(),
    contentType: z.string().optional().nullable(),
    durationSeconds: z.coerce.number().optional().nullable(),
    theme: z.string().optional().nullable(),
    sentiment: z.string().optional().nullable(),
    intensityScore: z.coerce.number().optional().nullable(),
    spiritualElements: z.boolean().optional(),
    titlePrimary: z.string().optional().nullable(),
    shortSummary: z.string().optional().nullable(),
    longDescription: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    tone: z.array(z.string()).optional(),
    topics: z.array(z.string()).optional(),
    targetAudience: z.array(z.string()).optional(),
    bestPlatforms: z.array(z.string()).optional(),
    visualContext: z.array(z.string()).optional(),
    videoGenres: z.array(z.string()).optional(),
    titleVariants: z.unknown().optional(),
    chapters: z.unknown().optional(),
    shortsHooks: z.unknown().optional(),
    missRobustaInsights: z.unknown().optional(),
    modelVersion: z.string().optional().nullable(),
    confidence: z.coerce.number().optional().nullable(),
    processedAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

export type IntelWebhookPayload = z.infer<typeof intelWebhookPayloadSchema>;

export type DownloadAssetBlock = {
  id: string;
  title: string;
  filename: string;
  size: number;
  formattedSize: string;
  assetType: string;
};

export type AssetDownloadResponse = {
  success: true;
  asset: DownloadAssetBlock;
  download: {
    url: string;
    expiresIn: number;
    filename: string;
  };
  video?: DownloadAssetBlock;
};
