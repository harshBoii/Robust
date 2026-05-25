-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('PRODUCT', 'SERVICE', 'OTHER');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "linkedin_url" VARCHAR(1000);

-- CreateTable
CREATE TABLE "brand_entities" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "canonical_name" VARCHAR(255) NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entity_type" VARCHAR(64),
    "one_liner" TEXT,
    "about" TEXT,
    "industry" VARCHAR(255),
    "category" VARCHAR(255),
    "headquarters_city" VARCHAR(255),
    "headquarters_country" VARCHAR(255),
    "founded_year" INTEGER,
    "employee_range" VARCHAR(64),
    "business_model" VARCHAR(64),
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "branding" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brand_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "brand_entity_id" TEXT NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "offering_type" "OfferingType" NOT NULL DEFAULT 'PRODUCT',
    "url" VARCHAR(1000),
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "use_cases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "differentiators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_entities_company_id_key" ON "brand_entities"("company_id");

-- CreateIndex
CREATE INDEX "offerings_company_id_idx" ON "offerings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_brand_entity_id_slug_key" ON "offerings"("brand_entity_id", "slug");

-- AddForeignKey
ALTER TABLE "brand_entities" ADD CONSTRAINT "brand_entities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_brand_entity_id_fkey" FOREIGN KEY ("brand_entity_id") REFERENCES "brand_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
