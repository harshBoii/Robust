-- CreateTable
CREATE TABLE "shopify_blog_channels" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "handle" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "shopifyBlogGid" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shopify_blog_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_blog_channels_shopifyBlogGid_key" ON "shopify_blog_channels"("shopifyBlogGid");

-- CreateIndex
CREATE INDEX "shopify_blog_channels_shopId_idx" ON "shopify_blog_channels"("shopId");

-- CreateIndex
CREATE INDEX "shopify_blog_channels_companyId_idx" ON "shopify_blog_channels"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_blog_channels_shopId_handle_key" ON "shopify_blog_channels"("shopId", "handle");

-- AddForeignKey
ALTER TABLE "shopify_blog_channels" ADD CONSTRAINT "shopify_blog_channels_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_blog_channels" ADD CONSTRAINT "shopify_blog_channels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
