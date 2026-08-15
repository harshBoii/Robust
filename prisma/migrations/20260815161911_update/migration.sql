-- CreateEnum
CREATE TYPE "ImageThumbnailStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'READY', 'ERROR');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "thumbnailError" TEXT,
ADD COLUMN     "thumbnailGeneratedAt" TIMESTAMPTZ(3),
ADD COLUMN     "thumbnailR2Key" VARCHAR(500),
ADD COLUMN     "thumbnailStatus" "ImageThumbnailStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

-- CreateIndex
CREATE INDEX "assets_assetType_thumbnailStatus_idx" ON "assets"("assetType", "thumbnailStatus");
