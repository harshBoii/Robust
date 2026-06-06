-- CreateTable
CREATE TABLE "google_ads_integrations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "customerId" VARCHAR(30),
    "loginCustomerId" VARCHAR(30),
    "conversionActionId" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_ads_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_campaigns" (
    "id" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "googleCampaignId" VARCHAR(100) NOT NULL,
    "campaignPresetId" TEXT,
    "name" VARCHAR(500) NOT NULL,
    "campaignType" VARCHAR(30) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "biddingStrategy" VARCHAR(64),
    "dailyBudgetMicros" BIGINT,
    "totalBudgetMicros" BIGINT,
    "targetCpaMicros" BIGINT,
    "targetRoas" DOUBLE PRECISION,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ad_groups" (
    "id" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "googleAdGroupId" VARCHAR(100) NOT NULL,
    "adGroupPresetId" TEXT,
    "name" VARCHAR(500),
    "status" VARCHAR(50),
    "keywords" JSONB DEFAULT '[]',
    "targeting" JSONB DEFAULT '{}',
    "cpcBidMicros" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_ad_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_asset_groups" (
    "id" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "googleAssetGroupId" VARCHAR(100) NOT NULL,
    "assetGroupPresetId" TEXT,
    "name" VARCHAR(500),
    "status" VARCHAR(50),
    "finalUrl" VARCHAR(2000) NOT NULL,
    "mobileUrl" VARCHAR(2000),
    "path1" VARCHAR(15),
    "path2" VARCHAR(15),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_asset_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_creatives" (
    "id" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "assetId" TEXT,
    "headlines" JSONB NOT NULL DEFAULT '[]',
    "descriptions" JSONB NOT NULL DEFAULT '[]',
    "longHeadline" VARCHAR(500),
    "businessName" VARCHAR(255),
    "finalUrl" VARCHAR(2000),
    "path1" VARCHAR(15),
    "path2" VARCHAR(15),
    "adType" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_media" (
    "id" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "assetId" TEXT,
    "googleAssetResourceName" VARCHAR(200) NOT NULL,
    "assetType" VARCHAR(50) NOT NULL,
    "uploadedCustomerId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads" (
    "id" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "adGroupId" TEXT NOT NULL,
    "googleCreativeDbId" TEXT,
    "googleAdId" VARCHAR(100) NOT NULL,
    "name" VARCHAR(500),
    "status" VARCHAR(50),
    "adType" VARCHAR(40),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ad_metrics" (
    "id" TEXT NOT NULL,
    "googleCampaignId" TEXT NOT NULL,
    "googleAdId" VARCHAR(100) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "cpc" DOUBLE PRECISION,
    "conversions" DOUBLE PRECISION,
    "conversionValue" DOUBLE PRECISION,
    "roas" DOUBLE PRECISION,
    "datePreset" VARCHAR(50) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_ad_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_campaign_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "campaignType" VARCHAR(30) NOT NULL,
    "biddingStrategy" VARCHAR(64),
    "dailyBudgetMicros" BIGINT,
    "totalBudgetMicros" BIGINT,
    "targetCpaMicros" BIGINT,
    "targetRoas" DOUBLE PRECISION,
    "geoTargets" JSONB DEFAULT '[]',
    "languages" JSONB DEFAULT '[]',
    "status" VARCHAR(32),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_campaign_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ad_group_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "keywords" JSONB DEFAULT '[]',
    "targeting" JSONB DEFAULT '{}',
    "cpcBidMicros" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_ad_group_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_asset_group_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "finalUrl" VARCHAR(2000),
    "path1" VARCHAR(15),
    "path2" VARCHAR(15),
    "headlines" JSONB DEFAULT '[]',
    "descriptions" JSONB DEFAULT '[]',
    "longHeadline" VARCHAR(500),
    "businessName" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_asset_group_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ad_publish_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "googleAdsIntegrationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adGroupId" TEXT,
    "assetGroupId" TEXT,
    "assetId" TEXT,
    "googleCreativeDbId" TEXT,
    "campaignType" VARCHAR(30) NOT NULL,
    "status" "PublishJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "googleAdDbId" TEXT,
    "headlinesOverride" JSONB,
    "descriptionsOverride" JSONB,
    "longHeadlineOverride" VARCHAR(500),
    "finalUrlOverride" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_ad_publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_ads_integrations_companyId_key" ON "google_ads_integrations"("companyId");

-- CreateIndex
CREATE INDEX "google_ads_integrations_companyId_idx" ON "google_ads_integrations"("companyId");

-- CreateIndex
CREATE INDEX "google_campaigns_googleAdsIntegrationId_idx" ON "google_campaigns"("googleAdsIntegrationId");

-- CreateIndex
CREATE INDEX "google_campaigns_googleCampaignId_idx" ON "google_campaigns"("googleCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "google_campaigns_googleAdsIntegrationId_googleCampaignId_key" ON "google_campaigns"("googleAdsIntegrationId", "googleCampaignId");

-- CreateIndex
CREATE INDEX "google_ad_groups_campaignId_idx" ON "google_ad_groups"("campaignId");

-- CreateIndex
CREATE INDEX "google_ad_groups_googleAdsIntegrationId_idx" ON "google_ad_groups"("googleAdsIntegrationId");

-- CreateIndex
CREATE UNIQUE INDEX "google_ad_groups_googleAdsIntegrationId_googleAdGroupId_key" ON "google_ad_groups"("googleAdsIntegrationId", "googleAdGroupId");

-- CreateIndex
CREATE INDEX "google_asset_groups_campaignId_idx" ON "google_asset_groups"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "google_asset_groups_googleAdsIntegrationId_googleAssetGroup_key" ON "google_asset_groups"("googleAdsIntegrationId", "googleAssetGroupId");

-- CreateIndex
CREATE INDEX "google_creatives_googleAdsIntegrationId_idx" ON "google_creatives"("googleAdsIntegrationId");

-- CreateIndex
CREATE INDEX "google_creatives_campaignId_idx" ON "google_creatives"("campaignId");

-- CreateIndex
CREATE INDEX "google_media_googleAdsIntegrationId_idx" ON "google_media"("googleAdsIntegrationId");

-- CreateIndex
CREATE INDEX "google_media_assetId_idx" ON "google_media"("assetId");

-- CreateIndex
CREATE INDEX "google_ads_adGroupId_idx" ON "google_ads"("adGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "google_ads_googleAdsIntegrationId_googleAdId_key" ON "google_ads"("googleAdsIntegrationId", "googleAdId");

-- CreateIndex
CREATE INDEX "google_ad_metrics_googleCampaignId_idx" ON "google_ad_metrics"("googleCampaignId");

-- CreateIndex
CREATE INDEX "google_ad_metrics_googleAdId_idx" ON "google_ad_metrics"("googleAdId");

-- CreateIndex
CREATE INDEX "google_ad_metrics_googleAdId_datePreset_idx" ON "google_ad_metrics"("googleAdId", "datePreset");

-- CreateIndex
CREATE INDEX "google_ad_metrics_recordedAt_idx" ON "google_ad_metrics"("recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "google_ad_metrics_googleAdId_datePreset_key" ON "google_ad_metrics"("googleAdId", "datePreset");

-- CreateIndex
CREATE INDEX "google_campaign_presets_companyId_idx" ON "google_campaign_presets"("companyId");

-- CreateIndex
CREATE INDEX "google_campaign_presets_companyId_isDefault_idx" ON "google_campaign_presets"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "google_ad_group_presets_companyId_idx" ON "google_ad_group_presets"("companyId");

-- CreateIndex
CREATE INDEX "google_asset_group_presets_companyId_idx" ON "google_asset_group_presets"("companyId");

-- CreateIndex
CREATE INDEX "google_ad_publish_jobs_companyId_status_idx" ON "google_ad_publish_jobs"("companyId", "status");

-- CreateIndex
CREATE INDEX "google_ad_publish_jobs_scheduledAt_status_idx" ON "google_ad_publish_jobs"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "google_ad_publish_jobs_googleAdsIntegrationId_idx" ON "google_ad_publish_jobs"("googleAdsIntegrationId");

-- CreateIndex
CREATE INDEX "google_ad_publish_jobs_campaignId_idx" ON "google_ad_publish_jobs"("campaignId");

-- AddForeignKey
ALTER TABLE "google_ads_integrations" ADD CONSTRAINT "google_ads_integrations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_campaigns" ADD CONSTRAINT "google_campaigns_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_campaigns" ADD CONSTRAINT "google_campaigns_campaignPresetId_fkey" FOREIGN KEY ("campaignPresetId") REFERENCES "google_campaign_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_groups" ADD CONSTRAINT "google_ad_groups_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_groups" ADD CONSTRAINT "google_ad_groups_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "google_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_groups" ADD CONSTRAINT "google_ad_groups_adGroupPresetId_fkey" FOREIGN KEY ("adGroupPresetId") REFERENCES "google_ad_group_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_asset_groups" ADD CONSTRAINT "google_asset_groups_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_asset_groups" ADD CONSTRAINT "google_asset_groups_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "google_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_asset_groups" ADD CONSTRAINT "google_asset_groups_assetGroupPresetId_fkey" FOREIGN KEY ("assetGroupPresetId") REFERENCES "google_asset_group_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_creatives" ADD CONSTRAINT "google_creatives_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_media" ADD CONSTRAINT "google_media_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads" ADD CONSTRAINT "google_ads_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads" ADD CONSTRAINT "google_ads_adGroupId_fkey" FOREIGN KEY ("adGroupId") REFERENCES "google_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads" ADD CONSTRAINT "google_ads_googleCreativeDbId_fkey" FOREIGN KEY ("googleCreativeDbId") REFERENCES "google_creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_publish_jobs" ADD CONSTRAINT "google_ad_publish_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_publish_jobs" ADD CONSTRAINT "google_ad_publish_jobs_googleAdsIntegrationId_fkey" FOREIGN KEY ("googleAdsIntegrationId") REFERENCES "google_ads_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_publish_jobs" ADD CONSTRAINT "google_ad_publish_jobs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "google_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_publish_jobs" ADD CONSTRAINT "google_ad_publish_jobs_adGroupId_fkey" FOREIGN KEY ("adGroupId") REFERENCES "google_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_publish_jobs" ADD CONSTRAINT "google_ad_publish_jobs_assetGroupId_fkey" FOREIGN KEY ("assetGroupId") REFERENCES "google_asset_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ad_publish_jobs" ADD CONSTRAINT "google_ad_publish_jobs_googleCreativeDbId_fkey" FOREIGN KEY ("googleCreativeDbId") REFERENCES "google_creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
