-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VIDEO', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'ERROR', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('NATIVE', 'YOUTUBE', 'GOOGLE_DRIVE', 'DROPBOX', 'URL');

-- CreateEnum
CREATE TYPE "BulkUploadStatus" AS ENUM ('PROCESSING', 'READY', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "BucketType" AS ENUM ('ASPECT_RATIO', 'DURATION', 'FORMAT', 'ORIENTATION');

-- CreateEnum
CREATE TYPE "AssetWarningType" AS ENUM ('TEXT_OVERLAY_HIGH', 'WRONG_DIMENSIONS', 'LOW_RESOLUTION', 'UNSUPPORTED_FORMAT');

-- CreateEnum
CREATE TYPE "WarningResolution" AS ENUM ('SKIPPED', 'REUPLOADED', 'DELETED');

-- CreateEnum
CREATE TYPE "AdScheduleStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('AUTO_PAUSE', 'FATIGUE_ALERT', 'BUDGET_PACING', 'SPEND_CONCENTRATION', 'WINNER_AMPLIFICATION');

-- CreateEnum
CREATE TYPE "AutoActionType" AS ENUM ('PAUSED', 'NOTIFIED', 'FLAGGED', 'SUGGESTED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "logoUrl" VARCHAR(1000),
    "website" VARCHAR(500),
    "domain" VARCHAR(255),
    "email" VARCHAR(255),
    "userName" VARCHAR(255),
    "password" VARCHAR(255),
    "subscription_id" TEXT,
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "subscription_created_at" TIMESTAMP(3),
    "subscription_updated_at" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_uploads" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "BulkUploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bulk_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_buckets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bulkUploadId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "bucketType" "BucketType" NOT NULL,
    "bucketValue" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bulkUploadId" TEXT,
    "assetBucketId" TEXT,
    "assetType" "AssetType" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "filename" VARCHAR(500) NOT NULL,
    "originalSize" BIGINT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "r2Key" VARCHAR(500) NOT NULL,
    "r2Bucket" VARCHAR(255) NOT NULL,
    "resolution" VARCHAR(20),
    "mimeType" VARCHAR(100),
    "duration" INTEGER,
    "fps" INTEGER,
    "codec" VARCHAR(50),
    "streamId" VARCHAR(255),
    "playbackUrl" VARCHAR(2000),
    "thumbnailUrl" VARCHAR(1000),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploadSource" "UploadSource" NOT NULL DEFAULT 'NATIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_warnings" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "warningType" "AssetWarningType" NOT NULL,
    "detail" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" "WarningResolution",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "uploadId" VARCHAR(255) NOT NULL,
    "key" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "fileType" VARCHAR(200) NOT NULL,
    "totalParts" INTEGER NOT NULL,
    "uploadedParts" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" VARCHAR(50) NOT NULL,
    "companyId" VARCHAR(255),
    "uploadedBy" VARCHAR(255),
    "metadata" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_integrations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "adAccountId" VARCHAR(100) NOT NULL,
    "fbPageId" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "brandVoice" JSONB,
    "topAdExamples" JSONB,
    "audienceInsights" JSONB,
    "avgWinningCtr" DOUBLE PRECISION,
    "contextBuiltAt" TIMESTAMPTZ(3),
    "winning_formula" JSONB,
    "winning_formula_built_at" TIMESTAMPTZ(3),

    CONSTRAINT "meta_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_media" (
    "id" TEXT NOT NULL,
    "metaIntegrationId" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "imageHash" VARCHAR(200),
    "videoId" VARCHAR(100),
    "assetId" TEXT,
    "imageUrl" VARCHAR(1000),
    "videoUrl" VARCHAR(1000),
    "videoStreamId" VARCHAR(100),
    "thumbnailUrl" VARCHAR(1000),
    "r2Key" VARCHAR(500),
    "filename" VARCHAR(500),
    "mimeType" VARCHAR(200),
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_campaigns" (
    "id" TEXT NOT NULL,
    "metaIntegrationId" TEXT NOT NULL,
    "metaCampaignId" VARCHAR(100) NOT NULL,
    "campaignPresetId" TEXT,
    "name" VARCHAR(500) NOT NULL,
    "objective" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "dailyBudget" INTEGER NOT NULL DEFAULT 0,
    "lifetimeBudget" INTEGER,
    "spendCap" BIGINT,
    "specialAdCategory" VARCHAR(100),
    "specialAdCategories" JSONB DEFAULT '[]',
    "bidStrategy" VARCHAR(64),
    "publishedAt" TIMESTAMPTZ(3),
    "reviewStatus" VARCHAR(50),
    "reviewFeedback" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_creatives" (
    "id" TEXT NOT NULL,
    "metaIntegrationId" TEXT NOT NULL,
    "metaCampaignId" TEXT,
    "metaCreativeId" VARCHAR(100),
    "imageHash" VARCHAR(200),
    "videoId" VARCHAR(100),
    "headline" VARCHAR(500) NOT NULL,
    "primaryText" TEXT NOT NULL,
    "description" TEXT,
    "ctaType" VARCHAR(100) NOT NULL,
    "landingUrl" VARCHAR(2000) NOT NULL,
    "imageUrl" VARCHAR(1000),
    "imagePrompt" TEXT,
    "videoUrl" VARCHAR(1000),
    "videoPrompt" TEXT,
    "videoStreamId" VARCHAR(100),
    "thumbnailUrl" VARCHAR(1000),
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "compliancePassed" BOOLEAN NOT NULL DEFAULT false,
    "complianceFlags" JSONB,
    "complianceCheckedAt" TIMESTAMPTZ(3),
    "approvedByUser" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_sets" (
    "id" TEXT NOT NULL,
    "metaIntegrationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adsetPresetId" TEXT,
    "metaAdSetId" VARCHAR(100) NOT NULL,
    "name" VARCHAR(500),
    "status" VARCHAR(50),
    "dailyBudget" INTEGER,
    "lifetimeBudget" INTEGER,
    "bidStrategy" VARCHAR(64),
    "bidAmount" INTEGER,
    "bidConstraints" JSONB DEFAULT '{}',
    "optimizationGoal" VARCHAR(100),
    "billingEvent" VARCHAR(50),
    "targeting" JSONB,
    "startTime" TIMESTAMPTZ(3),
    "endTime" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads" (
    "id" TEXT NOT NULL,
    "metaIntegrationId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "metaCreativeDbId" TEXT,
    "metaAdId" VARCHAR(100) NOT NULL,
    "name" VARCHAR(500),
    "status" VARCHAR(50),
    "presetId" TEXT,
    "scheduleId" TEXT,
    "duplicatedFromId" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "reviewStatus" VARCHAR(50),
    "reviewFeedback" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_metrics" (
    "id" TEXT NOT NULL,
    "metaCampaignId" TEXT NOT NULL,
    "metaAdId" VARCHAR(100) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "cpc" DOUBLE PRECISION,
    "roas" DOUBLE PRECISION,
    "hookRate" DOUBLE PRECISION,
    "daysRunning" INTEGER,
    "statusSignal" VARCHAR(64),
    "actions" JSONB,
    "datePreset" VARCHAR(50) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ad_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "headline" VARCHAR(500),
    "landingPageUrl" VARCHAR(2000),
    "budgetOverride" DOUBLE PRECISION,
    "targetAgeMin" INTEGER,
    "targetAgeMax" INTEGER,
    "targetGenders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetProfessions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pixelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adset_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "dailyBudget" BIGINT,
    "lifetimeBudget" BIGINT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "bidStrategy" VARCHAR(64),
    "bidAmount" BIGINT,
    "bidConstraints" JSONB DEFAULT '{}',
    "targeting" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "adset_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "objective" VARCHAR(64),
    "status" VARCHAR(32),
    "spendCap" BIGINT,
    "dailyBudget" BIGINT,
    "lifetimeBudget" BIGINT,
    "bidStrategy" VARCHAR(64),
    "specialAdCategories" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaign_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_schedules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AdScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_automation_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleType" "RuleType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" DOUBLE PRECISION,
    "window" INTEGER,
    "lastTriggeredAt" TIMESTAMPTZ(3),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_automation_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "adId" VARCHAR(100) NOT NULL,
    "actionTaken" "AutoActionType" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "approved" BOOLEAN,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_automation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventId" TEXT,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_userName_key" ON "companies"("userName");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "bulk_uploads_companyId_idx" ON "bulk_uploads"("companyId");

-- CreateIndex
CREATE INDEX "bulk_uploads_companyId_createdAt_idx" ON "bulk_uploads"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "asset_buckets_companyId_idx" ON "asset_buckets"("companyId");

-- CreateIndex
CREATE INDEX "asset_buckets_bulkUploadId_idx" ON "asset_buckets"("bulkUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_streamId_key" ON "assets"("streamId");

-- CreateIndex
CREATE INDEX "assets_companyId_idx" ON "assets"("companyId");

-- CreateIndex
CREATE INDEX "assets_bulkUploadId_idx" ON "assets"("bulkUploadId");

-- CreateIndex
CREATE INDEX "assets_assetBucketId_idx" ON "assets"("assetBucketId");

-- CreateIndex
CREATE INDEX "assets_assetType_idx" ON "assets"("assetType");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_assetType_companyId_idx" ON "assets"("assetType", "companyId");

-- CreateIndex
CREATE INDEX "assets_createdAt_idx" ON "assets"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "asset_warnings_assetId_idx" ON "asset_warnings"("assetId");

-- CreateIndex
CREATE INDEX "asset_warnings_assetId_resolved_idx" ON "asset_warnings"("assetId", "resolved");

-- CreateIndex
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions"("status");

-- CreateIndex
CREATE INDEX "upload_sessions_uploadedBy_idx" ON "upload_sessions"("uploadedBy");

-- CreateIndex
CREATE INDEX "upload_sessions_companyId_idx" ON "upload_sessions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_integrations_companyId_key" ON "meta_integrations"("companyId");

-- CreateIndex
CREATE INDEX "meta_integrations_companyId_idx" ON "meta_integrations"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_media_assetId_key" ON "meta_media"("assetId");

-- CreateIndex
CREATE INDEX "meta_media_metaIntegrationId_idx" ON "meta_media"("metaIntegrationId");

-- CreateIndex
CREATE INDEX "meta_media_imageHash_idx" ON "meta_media"("imageHash");

-- CreateIndex
CREATE INDEX "meta_media_videoId_idx" ON "meta_media"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_media_metaIntegrationId_imageHash_key" ON "meta_media"("metaIntegrationId", "imageHash");

-- CreateIndex
CREATE UNIQUE INDEX "meta_media_metaIntegrationId_videoId_key" ON "meta_media"("metaIntegrationId", "videoId");

-- CreateIndex
CREATE INDEX "meta_campaigns_metaIntegrationId_idx" ON "meta_campaigns"("metaIntegrationId");

-- CreateIndex
CREATE INDEX "meta_campaigns_metaCampaignId_idx" ON "meta_campaigns"("metaCampaignId");

-- CreateIndex
CREATE INDEX "meta_campaigns_campaignPresetId_idx" ON "meta_campaigns"("campaignPresetId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_campaigns_metaIntegrationId_metaCampaignId_key" ON "meta_campaigns"("metaIntegrationId", "metaCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_creatives_metaCampaignId_key" ON "meta_creatives"("metaCampaignId");

-- CreateIndex
CREATE INDEX "meta_creatives_metaIntegrationId_idx" ON "meta_creatives"("metaIntegrationId");

-- CreateIndex
CREATE INDEX "meta_creatives_metaCreativeId_idx" ON "meta_creatives"("metaCreativeId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_creatives_metaIntegrationId_metaCreativeId_key" ON "meta_creatives"("metaIntegrationId", "metaCreativeId");

-- CreateIndex
CREATE INDEX "meta_ad_sets_campaignId_idx" ON "meta_ad_sets"("campaignId");

-- CreateIndex
CREATE INDEX "meta_ad_sets_metaIntegrationId_idx" ON "meta_ad_sets"("metaIntegrationId");

-- CreateIndex
CREATE INDEX "meta_ad_sets_adsetPresetId_idx" ON "meta_ad_sets"("adsetPresetId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_sets_metaIntegrationId_metaAdSetId_key" ON "meta_ad_sets"("metaIntegrationId", "metaAdSetId");

-- CreateIndex
CREATE INDEX "meta_ads_adSetId_idx" ON "meta_ads"("adSetId");

-- CreateIndex
CREATE INDEX "meta_ads_metaIntegrationId_idx" ON "meta_ads"("metaIntegrationId");

-- CreateIndex
CREATE INDEX "meta_ads_presetId_idx" ON "meta_ads"("presetId");

-- CreateIndex
CREATE INDEX "meta_ads_scheduleId_idx" ON "meta_ads"("scheduleId");

-- CreateIndex
CREATE INDEX "meta_ads_duplicatedFromId_idx" ON "meta_ads"("duplicatedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ads_metaIntegrationId_metaAdId_key" ON "meta_ads"("metaIntegrationId", "metaAdId");

-- CreateIndex
CREATE INDEX "meta_ad_metrics_metaCampaignId_idx" ON "meta_ad_metrics"("metaCampaignId");

-- CreateIndex
CREATE INDEX "meta_ad_metrics_metaAdId_idx" ON "meta_ad_metrics"("metaAdId");

-- CreateIndex
CREATE INDEX "meta_ad_metrics_metaAdId_datePreset_idx" ON "meta_ad_metrics"("metaAdId", "datePreset");

-- CreateIndex
CREATE INDEX "meta_ad_metrics_recordedAt_idx" ON "meta_ad_metrics"("recordedAt" DESC);

-- CreateIndex
CREATE INDEX "ad_presets_companyId_idx" ON "ad_presets"("companyId");

-- CreateIndex
CREATE INDEX "ad_presets_companyId_isDefault_idx" ON "ad_presets"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "adset_presets_companyId_idx" ON "adset_presets"("companyId");

-- CreateIndex
CREATE INDEX "adset_presets_companyId_isDefault_idx" ON "adset_presets"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "campaign_presets_companyId_idx" ON "campaign_presets"("companyId");

-- CreateIndex
CREATE INDEX "campaign_presets_companyId_isDefault_idx" ON "campaign_presets"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "ad_schedules_companyId_idx" ON "ad_schedules"("companyId");

-- CreateIndex
CREATE INDEX "ad_schedules_companyId_status_idx" ON "ad_schedules"("companyId", "status");

-- CreateIndex
CREATE INDEX "ad_schedules_scheduledAt_idx" ON "ad_schedules"("scheduledAt");

-- CreateIndex
CREATE INDEX "ad_automation_rules_companyId_idx" ON "ad_automation_rules"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_automation_rules_companyId_ruleType_key" ON "ad_automation_rules"("companyId", "ruleType");

-- CreateIndex
CREATE INDEX "ad_automation_events_companyId_idx" ON "ad_automation_events"("companyId");

-- CreateIndex
CREATE INDEX "ad_automation_events_ruleId_idx" ON "ad_automation_events"("ruleId");

-- CreateIndex
CREATE INDEX "ad_automation_events_adId_idx" ON "ad_automation_events"("adId");

-- CreateIndex
CREATE INDEX "ad_automation_events_companyId_createdAt_idx" ON "ad_automation_events"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_companyId_idx" ON "notifications"("companyId");

-- CreateIndex
CREATE INDEX "notifications_companyId_isRead_idx" ON "notifications"("companyId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "bulk_uploads" ADD CONSTRAINT "bulk_uploads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_buckets" ADD CONSTRAINT "asset_buckets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_buckets" ADD CONSTRAINT "asset_buckets_bulkUploadId_fkey" FOREIGN KEY ("bulkUploadId") REFERENCES "bulk_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_bulkUploadId_fkey" FOREIGN KEY ("bulkUploadId") REFERENCES "bulk_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetBucketId_fkey" FOREIGN KEY ("assetBucketId") REFERENCES "asset_buckets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_warnings" ADD CONSTRAINT "asset_warnings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_integrations" ADD CONSTRAINT "meta_integrations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_media" ADD CONSTRAINT "meta_media_metaIntegrationId_fkey" FOREIGN KEY ("metaIntegrationId") REFERENCES "meta_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_media" ADD CONSTRAINT "meta_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_campaigns" ADD CONSTRAINT "meta_campaigns_metaIntegrationId_fkey" FOREIGN KEY ("metaIntegrationId") REFERENCES "meta_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_campaigns" ADD CONSTRAINT "meta_campaigns_campaignPresetId_fkey" FOREIGN KEY ("campaignPresetId") REFERENCES "campaign_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_creatives" ADD CONSTRAINT "meta_creatives_metaIntegrationId_fkey" FOREIGN KEY ("metaIntegrationId") REFERENCES "meta_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_creatives" ADD CONSTRAINT "meta_creatives_metaCampaignId_fkey" FOREIGN KEY ("metaCampaignId") REFERENCES "meta_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_sets" ADD CONSTRAINT "meta_ad_sets_metaIntegrationId_fkey" FOREIGN KEY ("metaIntegrationId") REFERENCES "meta_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_sets" ADD CONSTRAINT "meta_ad_sets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "meta_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_sets" ADD CONSTRAINT "meta_ad_sets_adsetPresetId_fkey" FOREIGN KEY ("adsetPresetId") REFERENCES "adset_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_metaIntegrationId_fkey" FOREIGN KEY ("metaIntegrationId") REFERENCES "meta_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "meta_ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_metaCreativeDbId_fkey" FOREIGN KEY ("metaCreativeDbId") REFERENCES "meta_creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "ad_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ad_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_duplicatedFromId_fkey" FOREIGN KEY ("duplicatedFromId") REFERENCES "meta_ads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_presets" ADD CONSTRAINT "ad_presets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adset_presets" ADD CONSTRAINT "adset_presets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_presets" ADD CONSTRAINT "campaign_presets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_schedules" ADD CONSTRAINT "ad_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_automation_rules" ADD CONSTRAINT "ad_automation_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_automation_events" ADD CONSTRAINT "ad_automation_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_automation_events" ADD CONSTRAINT "ad_automation_events_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ad_automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ad_automation_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
