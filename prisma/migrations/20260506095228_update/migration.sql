-- CreateEnum
CREATE TYPE "PublishJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ad_publish_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "metaIntegrationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "adPresetId" TEXT,
    "scheduleId" TEXT,
    "status" "PublishJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "metaCreativeDbId" TEXT,
    "metaAdDbId" TEXT,
    "duplicatedFromAdId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_publish_jobs_companyId_status_idx" ON "ad_publish_jobs"("companyId", "status");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_scheduledAt_status_idx" ON "ad_publish_jobs"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_scheduleId_idx" ON "ad_publish_jobs"("scheduleId");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_metaIntegrationId_idx" ON "ad_publish_jobs"("metaIntegrationId");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_campaignId_idx" ON "ad_publish_jobs"("campaignId");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_adSetId_idx" ON "ad_publish_jobs"("adSetId");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_assetId_idx" ON "ad_publish_jobs"("assetId");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_adPresetId_idx" ON "ad_publish_jobs"("adPresetId");

-- CreateIndex
CREATE INDEX "ad_publish_jobs_metaAdDbId_idx" ON "ad_publish_jobs"("metaAdDbId");

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "meta_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "meta_ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_adPresetId_fkey" FOREIGN KEY ("adPresetId") REFERENCES "ad_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ad_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_publish_jobs" ADD CONSTRAINT "ad_publish_jobs_metaAdDbId_fkey" FOREIGN KEY ("metaAdDbId") REFERENCES "meta_ads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
