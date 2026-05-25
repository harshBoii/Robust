/*
  Warnings:

  - A unique constraint covering the columns `[assetId]` on the table `asset_intelligence` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "IntelligenceStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "intelligenceStatus" "IntelligenceStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "asset_intelligence_assetId_key" ON "asset_intelligence"("assetId");

-- CreateIndex
CREATE INDEX "assets_intelligenceStatus_idx" ON "assets"("intelligenceStatus");
