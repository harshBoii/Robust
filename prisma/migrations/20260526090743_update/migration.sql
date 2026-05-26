-- CreateEnum
CREATE TYPE "VideoGenJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "ChatPathType" ADD VALUE 'VIDEO_GEN';

-- CreateTable
CREATE TABLE "video_generation_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "avatarId" VARCHAR(64) NOT NULL DEFAULT 'auto',
    "voiceId" VARCHAR(64) NOT NULL DEFAULT 'auto',
    "heygenStatus" "VideoGenJobStatus" NOT NULL DEFAULT 'PENDING',
    "heygenError" TEXT,
    "heygenVideoId" VARCHAR(255),
    "progressMessage" VARCHAR(500),
    "downloadUrl" VARCHAR(2000),
    "playbackUrl" VARCHAR(2000),
    "thumbnailUrl" VARCHAR(1000),
    "assetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "video_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_generation_jobs_companyId_heygenStatus_idx" ON "video_generation_jobs"("companyId", "heygenStatus");

-- CreateIndex
CREATE INDEX "video_generation_jobs_heygenVideoId_idx" ON "video_generation_jobs"("heygenVideoId");

-- CreateIndex
CREATE INDEX "video_generation_jobs_assetId_idx" ON "video_generation_jobs"("assetId");

-- AddForeignKey
ALTER TABLE "video_generation_jobs" ADD CONSTRAINT "video_generation_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generation_jobs" ADD CONSTRAINT "video_generation_jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
