-- CreateEnum
CREATE TYPE "BountySpreadPlatform" AS ENUM ('WEBSITE_BLOG', 'THIRD_PARTY_BLOG', 'REDDIT', 'X', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "BountyContentStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('X', 'LINKEDIN', 'REDDIT');

-- AlterTable
ALTER TABLE "citation_bounties" ADD COLUMN     "spreadPlatforms" JSONB;

-- CreateTable
CREATE TABLE "bounty_contents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bountyId" TEXT NOT NULL,
    "platform" "BountySpreadPlatform" NOT NULL,
    "status" "BountyContentStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(500),
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "publishedUrl" VARCHAR(1000),
    "externalPostId" VARCHAR(255),
    "approvedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "errorMessage" TEXT,
    "generationContext" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bounty_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_integrations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accountHandle" VARCHAR(255),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bounty_contents_companyId_idx" ON "bounty_contents"("companyId");

-- CreateIndex
CREATE INDEX "bounty_contents_bountyId_idx" ON "bounty_contents"("bountyId");

-- CreateIndex
CREATE INDEX "bounty_contents_platform_idx" ON "bounty_contents"("platform");

-- CreateIndex
CREATE INDEX "bounty_contents_status_idx" ON "bounty_contents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_contents_bountyId_platform_key" ON "bounty_contents"("bountyId", "platform");

-- CreateIndex
CREATE INDEX "social_integrations_companyId_idx" ON "social_integrations"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "social_integrations_companyId_provider_key" ON "social_integrations"("companyId", "provider");

-- AddForeignKey
ALTER TABLE "bounty_contents" ADD CONSTRAINT "bounty_contents_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "citation_bounties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_contents" ADD CONSTRAINT "bounty_contents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_integrations" ADD CONSTRAINT "social_integrations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
