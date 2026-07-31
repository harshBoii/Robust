-- CreateEnum
CREATE TYPE "WordPressAuthType" AS ENUM ('APP_PASSWORD', 'MANUAL');

-- CreateEnum
CREATE TYPE "WordPressJsonLdMode" AS ENUM ('PLUGIN', 'INLINE', 'SEO_PLUGIN', 'UNAVAILABLE');

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'WordPress';

-- AlterTable
ALTER TABLE "aeo_pages" ADD COLUMN     "wordpressPostId" INTEGER,
ADD COLUMN     "wordpressSiteId" VARCHAR(64);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "default_blog_destination" VARCHAR(16);

-- CreateTable
CREATE TABLE "wordpress_sites" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteUrl" VARCHAR(1000) NOT NULL,
    "restBase" VARCHAR(1000) NOT NULL,
    "authType" "WordPressAuthType" NOT NULL DEFAULT 'APP_PASSWORD',
    "username" VARCHAR(255) NOT NULL,
    "appPasswordEnc" TEXT NOT NULL,
    "appPasswordUuid" VARCHAR(64),
    "status" VARCHAR(32) NOT NULL DEFAULT 'connected',
    "wpVersion" VARCHAR(32),
    "jsonLdMode" "WordPressJsonLdMode" NOT NULL DEFAULT 'UNAVAILABLE',
    "pluginVersion" VARCHAR(32),
    "seoPlugin" VARCHAR(32),
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "defaultAuthorId" INTEGER,
    "lastVerifiedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "disconnectedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wordpress_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordpress_blog_channels" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "wpCategoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wordpress_blog_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wordpress_sites_companyId_idx" ON "wordpress_sites"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_sites_companyId_siteUrl_key" ON "wordpress_sites"("companyId", "siteUrl");

-- CreateIndex
CREATE INDEX "wordpress_blog_channels_siteId_idx" ON "wordpress_blog_channels"("siteId");

-- CreateIndex
CREATE INDEX "wordpress_blog_channels_companyId_idx" ON "wordpress_blog_channels"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_blog_channels_siteId_slug_key" ON "wordpress_blog_channels"("siteId", "slug");

-- AddForeignKey
ALTER TABLE "wordpress_sites" ADD CONSTRAINT "wordpress_sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordpress_blog_channels" ADD CONSTRAINT "wordpress_blog_channels_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "wordpress_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordpress_blog_channels" ADD CONSTRAINT "wordpress_blog_channels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
