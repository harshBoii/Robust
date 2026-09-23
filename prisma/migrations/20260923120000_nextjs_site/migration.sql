-- AlterTable
ALTER TABLE "aeo_pages" ADD COLUMN     "nextjsPublishedAt" TIMESTAMPTZ(3),
ADD COLUMN     "nextjsSiteId" VARCHAR(64);

-- CreateTable
CREATE TABLE "nextjs_sites" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteUrl" VARCHAR(1000) NOT NULL,
    "basePath" VARCHAR(255) NOT NULL DEFAULT '/blog',
    "apiKeyHash" VARCHAR(64) NOT NULL,
    "apiKeyPrefix" VARCHAR(24) NOT NULL,
    "revalidateSecretEnc" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'connected',
    "lastVerifiedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nextjs_sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nextjs_sites_companyId_key" ON "nextjs_sites"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "nextjs_sites_apiKeyHash_key" ON "nextjs_sites"("apiKeyHash");

-- CreateIndex
CREATE INDEX "aeo_pages_nextjsSiteId_nextjsPublishedAt_idx" ON "aeo_pages"("nextjsSiteId", "nextjsPublishedAt" DESC);

-- AddForeignKey
ALTER TABLE "nextjs_sites" ADD CONSTRAINT "nextjs_sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
