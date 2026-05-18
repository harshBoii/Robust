-- CreateTable
CREATE TABLE "assistant_creative_usage" (
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assistant_creative_usage_pkey" PRIMARY KEY ("companyId","date")
);

-- AddForeignKey
ALTER TABLE "assistant_creative_usage" ADD CONSTRAINT "assistant_creative_usage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
