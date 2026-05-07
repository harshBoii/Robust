-- AlterTable
ALTER TABLE "ad_publish_jobs" ADD COLUMN     "ctaTypeOverride" VARCHAR(100),
ADD COLUMN     "descriptionOverride" TEXT,
ADD COLUMN     "groupKey" VARCHAR(120),
ADD COLUMN     "headlineOverride" VARCHAR(500),
ADD COLUMN     "landingUrlOverride" VARCHAR(2000),
ADD COLUMN     "pixelIdOverride" VARCHAR(100),
ADD COLUMN     "primaryTextOverride" TEXT;
