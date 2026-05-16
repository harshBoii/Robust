-- Allow OAuth-first: connect Facebook before choosing ad account / page.
ALTER TABLE "MetaIntegration" ALTER COLUMN "adAccountId" DROP NOT NULL;
ALTER TABLE "MetaIntegration" ALTER COLUMN "fbPageId" DROP NOT NULL;
