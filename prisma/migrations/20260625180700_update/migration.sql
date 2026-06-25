-- CreateEnum
CREATE TYPE "CustomProductType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "CustomProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

-- CreateTable
CREATE TABLE "custom_products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(255),
    "product_type" "CustomProductType" NOT NULL DEFAULT 'SERVICE',
    "status" "CustomProductStatus" NOT NULL DEFAULT 'DRAFT',
    "tagline" VARCHAR(500),
    "key_benefits" JSONB DEFAULT '[]',
    "target_audience" TEXT,
    "keywords" JSONB DEFAULT '[]',
    "tone_notes" TEXT,
    "media_urls" JSONB DEFAULT '[]',
    "faqs" JSONB DEFAULT '[]',
    "certifications" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "custom_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_products_company_id_idx" ON "custom_products"("company_id");

-- CreateIndex
CREATE INDEX "custom_products_company_id_status_idx" ON "custom_products"("company_id", "status");

-- AddForeignKey
ALTER TABLE "custom_products" ADD CONSTRAINT "custom_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
