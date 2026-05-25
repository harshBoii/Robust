-- CreateTable
CREATE TABLE "asset_intelligence" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "language" VARCHAR(10),
    "contentType" VARCHAR(100),
    "durationSeconds" INTEGER,
    "theme" VARCHAR(255),
    "sentiment" VARCHAR(50),
    "intensityScore" DOUBLE PRECISION,
    "spiritualElements" BOOLEAN NOT NULL DEFAULT false,
    "titlePrimary" VARCHAR(500),
    "shortSummary" TEXT,
    "longDescription" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetAudience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visualContext" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "titleVariants" JSONB DEFAULT '{}',
    "chapters" JSONB DEFAULT '[]',
    "shortsHooks" JSONB DEFAULT '[]',
    "missRobustaInsights" JSONB DEFAULT '[]',
    "modelVersion" VARCHAR(50),
    "confidence" DOUBLE PRECISION,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_intelligence_assetId_idx" ON "asset_intelligence"("assetId");

-- CreateIndex
CREATE INDEX "asset_intelligence_companyId_idx" ON "asset_intelligence"("companyId");

-- CreateIndex
CREATE INDEX "asset_intelligence_language_idx" ON "asset_intelligence"("language");

-- CreateIndex
CREATE INDEX "asset_intelligence_sentiment_idx" ON "asset_intelligence"("sentiment");

-- CreateIndex
CREATE INDEX "asset_intelligence_theme_idx" ON "asset_intelligence"("theme");

-- CreateIndex
CREATE INDEX "asset_intelligence_contentType_idx" ON "asset_intelligence"("contentType");

-- CreateIndex
CREATE INDEX "asset_intelligence_spiritualElements_idx" ON "asset_intelligence"("spiritualElements");

-- CreateIndex
CREATE INDEX "asset_intelligence_processedAt_idx" ON "asset_intelligence"("processedAt" DESC);

-- AddForeignKey
ALTER TABLE "asset_intelligence" ADD CONSTRAINT "asset_intelligence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_intelligence" ADD CONSTRAINT "asset_intelligence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
