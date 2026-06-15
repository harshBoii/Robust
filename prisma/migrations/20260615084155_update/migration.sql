-- AlterEnum
ALTER TYPE "PublishJobStatus" ADD VALUE 'DRAFT';

-- CreateTable
CREATE TABLE "meta_ads_auto_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "auto_mode_default" BOOLEAN NOT NULL DEFAULT false,
    "allow_new_campaign" BOOLEAN NOT NULL DEFAULT true,
    "allow_new_adset" BOOLEAN NOT NULL DEFAULT true,
    "allow_static_generation" BOOLEAN NOT NULL DEFAULT true,
    "media_mode" VARCHAR(32) NOT NULL DEFAULT 'auto_generate',
    "default_artist_id" VARCHAR(32),
    "auto_post" BOOLEAN NOT NULL DEFAULT false,
    "default_daily_budget" INTEGER,
    "default_objective" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_ads_auto_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_ads_auto_configs_company_id_key" ON "meta_ads_auto_configs"("company_id");

-- AddForeignKey
ALTER TABLE "meta_ads_auto_configs" ADD CONSTRAINT "meta_ads_auto_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
