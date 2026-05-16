-- DropIndex
DROP INDEX "meta_creatives_metaCampaignId_key";

-- AlterTable
ALTER TABLE "meta_creatives" ADD COLUMN     "assetId" TEXT;

-- CreateIndex
CREATE INDEX "meta_creatives_metaCampaignId_idx" ON "meta_creatives"("metaCampaignId");

-- CreateIndex
CREATE INDEX "meta_creatives_assetId_idx" ON "meta_creatives"("assetId");

-- AddForeignKey
ALTER TABLE "meta_creatives" ADD CONSTRAINT "meta_creatives_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
