-- AlterTable
ALTER TABLE "adset_presets" ADD COLUMN     "attributionSpec" JSONB DEFAULT '[]',
ADD COLUMN     "billingEvent" VARCHAR(64),
ADD COLUMN     "destinationType" VARCHAR(64),
ADD COLUMN     "isDefaultCreative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optimizationGoal" VARCHAR(100),
ADD COLUMN     "pacingType" VARCHAR(32),
ADD COLUMN     "pinnedCampaignId" TEXT,
ADD COLUMN     "promotedObject" JSONB DEFAULT '{}';

-- CreateIndex
CREATE INDEX "adset_presets_pinnedCampaignId_idx" ON "adset_presets"("pinnedCampaignId");

-- AddForeignKey
ALTER TABLE "adset_presets" ADD CONSTRAINT "adset_presets_pinnedCampaignId_fkey" FOREIGN KEY ("pinnedCampaignId") REFERENCES "meta_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
