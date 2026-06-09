-- CreateEnum
CREATE TYPE "RivalScrapeStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- DropForeignKey
ALTER TABLE "company_rivals" DROP CONSTRAINT "company_rivals_rivalCompanyId_fkey";

-- DropIndex
DROP INDEX "company_rivals_companyId_rivalCompanyId_key";

-- DropIndex
DROP INDEX "company_rivals_rivalCompanyId_idx";

-- AlterTable
ALTER TABLE "company_rivals" ADD COLUMN     "brandName" VARCHAR(255) NOT NULL,
ADD COLUMN     "country" VARCHAR(10) NOT NULL DEFAULT 'IN',
ADD COLUMN     "pageName" VARCHAR(255) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL,
ALTER COLUMN "rivalCompanyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "rival_scrape_runs" (
    "id" TEXT NOT NULL,
    "companyRivalId" TEXT NOT NULL,
    "status" "RivalScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rival_scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rival_ads" (
    "id" TEXT NOT NULL,
    "scrapeRunId" TEXT NOT NULL,
    "libraryId" VARCHAR(50) NOT NULL,
    "startDate" VARCHAR(50),
    "adStatus" VARCHAR(20) NOT NULL,
    "cta" VARCHAR(100),
    "adCopy" TEXT,
    "rawText" TEXT,
    "daysRunning" INTEGER,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videos" JSONB NOT NULL DEFAULT '[]',
    "landing_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnail_url" VARCHAR(1000),
    "analysis" TEXT,
    "image_visible" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rival_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rival_intelligence_summaries" (
    "id" TEXT NOT NULL,
    "scrape_run_id" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rival_intelligence_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rival_scrape_runs_companyRivalId_idx" ON "rival_scrape_runs"("companyRivalId");

-- CreateIndex
CREATE INDEX "rival_ads_scrapeRunId_idx" ON "rival_ads"("scrapeRunId");

-- CreateIndex
CREATE UNIQUE INDEX "rival_intelligence_summaries_scrape_run_id_key" ON "rival_intelligence_summaries"("scrape_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_rivals_companyId_pageName_key" ON "company_rivals"("companyId", "pageName");

-- AddForeignKey
ALTER TABLE "company_rivals" ADD CONSTRAINT "company_rivals_rivalCompanyId_fkey" FOREIGN KEY ("rivalCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rival_scrape_runs" ADD CONSTRAINT "rival_scrape_runs_companyRivalId_fkey" FOREIGN KEY ("companyRivalId") REFERENCES "company_rivals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rival_ads" ADD CONSTRAINT "rival_ads_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "rival_scrape_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rival_intelligence_summaries" ADD CONSTRAINT "rival_intelligence_summaries_scrape_run_id_fkey" FOREIGN KEY ("scrape_run_id") REFERENCES "rival_scrape_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
