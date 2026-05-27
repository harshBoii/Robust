-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MID_MONTHLY', 'MID_WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "AeoPageType" AS ENUM ('DEFINITION', 'HOW_TO', 'COMPARISON', 'FAQ', 'USE_CASE', 'THOUGHT_LEADERSHIP', 'PILLAR_PAGE');

-- CreateEnum
CREATE TYPE "AeoPageStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BountyStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'HUNTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BountyDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "GeoSourceType" AS ENUM ('FILE', 'TEXT', 'URL');

-- CreateTable
CREATE TABLE "aeo_pages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "pageType" "AeoPageType" NOT NULL DEFAULT 'DEFINITION',
    "status" "AeoPageStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '[]',
    "faq" JSONB NOT NULL DEFAULT '[]',
    "claims" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "knowledgeGraph" JSONB NOT NULL DEFAULT '{}',
    "seoTitle" VARCHAR(500),
    "seoDescription" TEXT,
    "canonicalUrl" VARCHAR(1000),
    "shopifyArticleGid" VARCHAR(255),
    "clusterId" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "llm_prompt_id" TEXT,
    "llm_topic_id" TEXT,

    CONSTRAINT "aeo_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_data_sources" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" "GeoSourceType" NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "assetId" TEXT,
    "rawContent" TEXT,
    "processedContent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "geo_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aeo_generation_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brandEntityId" TEXT,
    "baseUrl" VARCHAR(1000) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "clusterId" VARCHAR(255),
    "existingSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultPageType" "AeoPageType" NOT NULL DEFAULT 'COMPARISON',
    "defaultQuery" TEXT,
    "label" VARCHAR(255),
    "slug" VARCHAR(255),
    "lastGeneratedAeoPageId" TEXT,
    "lastRunAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "aeo_generation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aeo_page_sources" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "assetId" TEXT,
    "intelligenceId" TEXT,
    "contributionScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aeo_page_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_clusters" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "pillarPageId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_rivals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rivalCompanyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_rivals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_citations" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "companyId" TEXT,
    "mentionedName" VARCHAR(255) NOT NULL,
    "rank" INTEGER,
    "context" VARCHAR(100),
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompt_executions" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "response" TEXT NOT NULL,
    "executedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_prompt_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompts" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "topic" VARCHAR(255),
    "topicId" TEXT,
    "reason" TEXT,
    "expectedRevenue" DOUBLE PRECISION,
    "intent" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ishunted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "llm_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompt_revenues" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "monthlyPromptReach" DOUBLE PRECISION,
    "visibilityWeight" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    "cvr" DOUBLE PRECISION,
    "aov" DOUBLE PRECISION,
    "estimatedRevenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "llm_prompt_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_topics" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "companyId" TEXT NOT NULL,

    CONSTRAINT "llm_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompt_rivals_by_model" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "companyName" VARCHAR(255) NOT NULL,
    "rank" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "llm_prompt_rivals_by_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompt_rivals_consensus" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "companyName" VARCHAR(255) NOT NULL,
    "avgRank" DOUBLE PRECISION,
    "mentions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "llm_prompt_rivals_consensus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_radar_metrics" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "shareOfVoice" DOUBLE PRECISION,
    "top3Rate" DOUBLE PRECISION,
    "queryCoverage" DOUBLE PRECISION,
    "avgRank" DOUBLE PRECISION,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "competitorRank" DOUBLE PRECISION,
    "topicAuthority" DOUBLE PRECISION,

    CONSTRAINT "llm_radar_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_prompt_metrics" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "topicId" TEXT,
    "model" VARCHAR(100) NOT NULL,
    "latestRank" INTEGER,
    "isMentioned" BOOLEAN NOT NULL DEFAULT false,
    "estimatedReach" INTEGER,
    "confidence" DOUBLE PRECISION,
    "difficulty" "Difficulty",
    "businessFit" DOUBLE PRECISION,
    "opportunityScore" DOUBLE PRECISION,
    "estimatedRevenue" DOUBLE PRECISION,
    "actionType" VARCHAR(32),
    "rankTrend7d" DOUBLE PRECISION,
    "rankTrend30d" DOUBLE PRECISION,
    "modelGapFlag" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_prompt_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radar_assumptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "cvr" DOUBLE PRECISION NOT NULL DEFAULT 0.025,
    "aovMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "industryPreset" VARCHAR(50),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "radar_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_bounties" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "intent" VARCHAR(255),
    "pageType" "AeoPageType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "difficulty" "BountyDifficulty" NOT NULL DEFAULT 'EASY',
    "estimatedReach" INTEGER,
    "estimatedRevenue" DOUBLE PRECISION,
    "conversionRate" DOUBLE PRECISION,
    "avgOrderValue" DOUBLE PRECISION,
    "suggestedCluster" VARCHAR(255),
    "status" "BountyStatus" NOT NULL DEFAULT 'OPEN',
    "huntedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "aeoPageId" TEXT,
    "generationContext" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "citation_bounties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RelatedAeoPages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelatedAeoPages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "aeo_pages_companyId_idx" ON "aeo_pages"("companyId");

-- CreateIndex
CREATE INDEX "aeo_pages_status_idx" ON "aeo_pages"("status");

-- CreateIndex
CREATE INDEX "aeo_pages_pageType_idx" ON "aeo_pages"("pageType");

-- CreateIndex
CREATE INDEX "aeo_pages_clusterId_idx" ON "aeo_pages"("clusterId");

-- CreateIndex
CREATE INDEX "aeo_pages_companyId_status_idx" ON "aeo_pages"("companyId", "status");

-- CreateIndex
CREATE INDEX "aeo_pages_publishedAt_idx" ON "aeo_pages"("publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "aeo_pages_companyId_slug_locale_key" ON "aeo_pages"("companyId", "slug", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "geo_data_sources_assetId_key" ON "geo_data_sources"("assetId");

-- CreateIndex
CREATE INDEX "geo_data_sources_companyId_idx" ON "geo_data_sources"("companyId");

-- CreateIndex
CREATE INDEX "geo_data_sources_sourceType_idx" ON "geo_data_sources"("sourceType");

-- CreateIndex
CREATE INDEX "aeo_generation_profiles_companyId_idx" ON "aeo_generation_profiles"("companyId");

-- CreateIndex
CREATE INDEX "aeo_generation_profiles_brandEntityId_idx" ON "aeo_generation_profiles"("brandEntityId");

-- CreateIndex
CREATE INDEX "aeo_generation_profiles_defaultPageType_idx" ON "aeo_generation_profiles"("defaultPageType");

-- CreateIndex
CREATE INDEX "aeo_page_sources_pageId_idx" ON "aeo_page_sources"("pageId");

-- CreateIndex
CREATE INDEX "aeo_page_sources_assetId_idx" ON "aeo_page_sources"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "content_clusters_pillarPageId_key" ON "content_clusters"("pillarPageId");

-- CreateIndex
CREATE INDEX "content_clusters_companyId_idx" ON "content_clusters"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "content_clusters_companyId_slug_key" ON "content_clusters"("companyId", "slug");

-- CreateIndex
CREATE INDEX "company_rivals_companyId_idx" ON "company_rivals"("companyId");

-- CreateIndex
CREATE INDEX "company_rivals_rivalCompanyId_idx" ON "company_rivals"("rivalCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_rivals_companyId_rivalCompanyId_key" ON "company_rivals"("companyId", "rivalCompanyId");

-- CreateIndex
CREATE INDEX "llm_citations_executionId_idx" ON "llm_citations"("executionId");

-- CreateIndex
CREATE INDEX "llm_citations_companyId_idx" ON "llm_citations"("companyId");

-- CreateIndex
CREATE INDEX "llm_citations_rank_idx" ON "llm_citations"("rank");

-- CreateIndex
CREATE INDEX "llm_prompt_executions_promptId_idx" ON "llm_prompt_executions"("promptId");

-- CreateIndex
CREATE INDEX "llm_prompt_executions_model_idx" ON "llm_prompt_executions"("model");

-- CreateIndex
CREATE INDEX "llm_prompt_executions_executedAt_idx" ON "llm_prompt_executions"("executedAt");

-- CreateIndex
CREATE INDEX "llm_prompts_intent_idx" ON "llm_prompts"("intent");

-- CreateIndex
CREATE INDEX "llm_prompts_topic_idx" ON "llm_prompts"("topic");

-- CreateIndex
CREATE INDEX "llm_prompts_topicId_idx" ON "llm_prompts"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_prompt_revenues_promptId_key" ON "llm_prompt_revenues"("promptId");

-- CreateIndex
CREATE INDEX "llm_prompt_revenues_estimatedRevenue_idx" ON "llm_prompt_revenues"("estimatedRevenue");

-- CreateIndex
CREATE INDEX "llm_topics_companyId_idx" ON "llm_topics"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_topics_companyId_name_key" ON "llm_topics"("companyId", "name");

-- CreateIndex
CREATE INDEX "llm_prompt_rivals_by_model_promptId_idx" ON "llm_prompt_rivals_by_model"("promptId");

-- CreateIndex
CREATE INDEX "llm_prompt_rivals_by_model_model_idx" ON "llm_prompt_rivals_by_model"("model");

-- CreateIndex
CREATE UNIQUE INDEX "llm_prompt_rivals_by_model_promptId_model_companyName_key" ON "llm_prompt_rivals_by_model"("promptId", "model", "companyName");

-- CreateIndex
CREATE INDEX "llm_prompt_rivals_consensus_promptId_idx" ON "llm_prompt_rivals_consensus"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_prompt_rivals_consensus_promptId_companyName_key" ON "llm_prompt_rivals_consensus"("promptId", "companyName");

-- CreateIndex
CREATE INDEX "llm_radar_metrics_companyId_idx" ON "llm_radar_metrics"("companyId");

-- CreateIndex
CREATE INDEX "llm_radar_metrics_model_idx" ON "llm_radar_metrics"("model");

-- CreateIndex
CREATE INDEX "llm_radar_metrics_companyId_calculatedAt_idx" ON "llm_radar_metrics"("companyId", "calculatedAt" DESC);

-- CreateIndex
CREATE INDEX "llm_prompt_metrics_companyId_idx" ON "llm_prompt_metrics"("companyId");

-- CreateIndex
CREATE INDEX "llm_prompt_metrics_promptId_idx" ON "llm_prompt_metrics"("promptId");

-- CreateIndex
CREATE INDEX "llm_prompt_metrics_calculatedAt_idx" ON "llm_prompt_metrics"("calculatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "llm_prompt_metrics_companyId_promptId_model_key" ON "llm_prompt_metrics"("companyId", "promptId", "model");

-- CreateIndex
CREATE UNIQUE INDEX "radar_assumptions_companyId_key" ON "radar_assumptions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "citation_bounties_aeoPageId_key" ON "citation_bounties"("aeoPageId");

-- CreateIndex
CREATE INDEX "citation_bounties_companyId_idx" ON "citation_bounties"("companyId");

-- CreateIndex
CREATE INDEX "citation_bounties_status_idx" ON "citation_bounties"("status");

-- CreateIndex
CREATE INDEX "citation_bounties_confidence_idx" ON "citation_bounties"("confidence");

-- CreateIndex
CREATE INDEX "citation_bounties_difficulty_idx" ON "citation_bounties"("difficulty");

-- CreateIndex
CREATE INDEX "citation_bounties_companyId_status_idx" ON "citation_bounties"("companyId", "status");

-- CreateIndex
CREATE INDEX "citation_bounties_companyId_status_confidence_idx" ON "citation_bounties"("companyId", "status", "confidence");

-- CreateIndex
CREATE INDEX "_RelatedAeoPages_B_index" ON "_RelatedAeoPages"("B");

-- AddForeignKey
ALTER TABLE "aeo_pages" ADD CONSTRAINT "aeo_pages_llm_prompt_id_fkey" FOREIGN KEY ("llm_prompt_id") REFERENCES "llm_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_pages" ADD CONSTRAINT "aeo_pages_llm_topic_id_fkey" FOREIGN KEY ("llm_topic_id") REFERENCES "llm_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_pages" ADD CONSTRAINT "aeo_pages_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "content_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_pages" ADD CONSTRAINT "aeo_pages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_data_sources" ADD CONSTRAINT "geo_data_sources_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_data_sources" ADD CONSTRAINT "geo_data_sources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_generation_profiles" ADD CONSTRAINT "aeo_generation_profiles_brandEntityId_fkey" FOREIGN KEY ("brandEntityId") REFERENCES "brand_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_generation_profiles" ADD CONSTRAINT "aeo_generation_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_generation_profiles" ADD CONSTRAINT "aeo_generation_profiles_lastGeneratedAeoPageId_fkey" FOREIGN KEY ("lastGeneratedAeoPageId") REFERENCES "aeo_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_page_sources" ADD CONSTRAINT "aeo_page_sources_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_page_sources" ADD CONSTRAINT "aeo_page_sources_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "asset_intelligence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeo_page_sources" ADD CONSTRAINT "aeo_page_sources_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "aeo_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_clusters" ADD CONSTRAINT "content_clusters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_clusters" ADD CONSTRAINT "content_clusters_pillarPageId_fkey" FOREIGN KEY ("pillarPageId") REFERENCES "aeo_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_rivals" ADD CONSTRAINT "company_rivals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_rivals" ADD CONSTRAINT "company_rivals_rivalCompanyId_fkey" FOREIGN KEY ("rivalCompanyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_citations" ADD CONSTRAINT "llm_citations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_citations" ADD CONSTRAINT "llm_citations_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "llm_prompt_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_executions" ADD CONSTRAINT "llm_prompt_executions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "llm_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompts" ADD CONSTRAINT "llm_prompts_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "llm_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_revenues" ADD CONSTRAINT "llm_prompt_revenues_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "llm_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_topics" ADD CONSTRAINT "llm_topics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_rivals_by_model" ADD CONSTRAINT "llm_prompt_rivals_by_model_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "llm_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_rivals_consensus" ADD CONSTRAINT "llm_prompt_rivals_consensus_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "llm_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_radar_metrics" ADD CONSTRAINT "llm_radar_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_metrics" ADD CONSTRAINT "llm_prompt_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_metrics" ADD CONSTRAINT "llm_prompt_metrics_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "llm_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_prompt_metrics" ADD CONSTRAINT "llm_prompt_metrics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "llm_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radar_assumptions" ADD CONSTRAINT "radar_assumptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_bounties" ADD CONSTRAINT "citation_bounties_aeoPageId_fkey" FOREIGN KEY ("aeoPageId") REFERENCES "aeo_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_bounties" ADD CONSTRAINT "citation_bounties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedAeoPages" ADD CONSTRAINT "_RelatedAeoPages_A_fkey" FOREIGN KEY ("A") REFERENCES "aeo_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedAeoPages" ADD CONSTRAINT "_RelatedAeoPages_B_fkey" FOREIGN KEY ("B") REFERENCES "aeo_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
