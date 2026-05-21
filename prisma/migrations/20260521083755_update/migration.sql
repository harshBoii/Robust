-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('Shopify');

-- CreateTable
CREATE TABLE "company_integration_cms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "apiKey" VARCHAR(255),
    "apiSecret" TEXT,
    "scopes" TEXT,
    "appUrl" VARCHAR(1000),
    "connectUrl" VARCHAR(1000),
    "expectedShopDomain" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_integration_cms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_shops" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shopDomain" VARCHAR(255) NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scopes" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'installed',
    "uninstalledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shopify_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_products" (
    "id" TEXT NOT NULL,
    "shopifyGid" VARCHAR(255) NOT NULL,
    "shopId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL DEFAULT '',
    "status" VARCHAR(64),
    "handle" VARCHAR(255),
    "totalInventory" INTEGER,
    "onlineStoreUrl" VARCHAR(1000),
    "description" TEXT,
    "featuredImageUrl" VARCHAR(1000),
    "featuredImageAltText" VARCHAR(500),
    "featuredImageWidth" INTEGER,
    "featuredImageHeight" INTEGER,
    "priceMinAmount" DECIMAL(18,4),
    "priceMaxAmount" DECIMAL(18,4),
    "currencyCode" VARCHAR(16),
    "shopifyCreatedAt" TIMESTAMPTZ(3),
    "shopifyUpdatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shopify_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_integration_cms_expectedShopDomain_key" ON "company_integration_cms"("expectedShopDomain");

-- CreateIndex
CREATE INDEX "company_integration_cms_companyId_idx" ON "company_integration_cms"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_integration_cms_companyId_provider_key" ON "company_integration_cms"("companyId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_shops_shopDomain_key" ON "shopify_shops"("shopDomain");

-- CreateIndex
CREATE INDEX "shopify_shops_companyId_idx" ON "shopify_shops"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_products_shopifyGid_key" ON "shopify_products"("shopifyGid");

-- CreateIndex
CREATE INDEX "shopify_products_companyId_idx" ON "shopify_products"("companyId");

-- CreateIndex
CREATE INDEX "shopify_products_shopId_idx" ON "shopify_products"("shopId");

-- CreateIndex
CREATE INDEX "shopify_products_companyId_shopifyUpdatedAt_idx" ON "shopify_products"("companyId", "shopifyUpdatedAt" DESC);

-- AddForeignKey
ALTER TABLE "company_integration_cms" ADD CONSTRAINT "company_integration_cms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_shops" ADD CONSTRAINT "shopify_shops_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_products" ADD CONSTRAINT "shopify_products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_products" ADD CONSTRAINT "shopify_products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
