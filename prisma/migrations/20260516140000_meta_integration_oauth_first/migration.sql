-- Allow OAuth-first: connect Facebook before choosing ad account / page.
ALTER TABLE "meta_integrations" ALTER COLUMN "adAccountId" DROP NOT NULL;
ALTER TABLE "meta_integrations" ALTER COLUMN "fbPageId" DROP NOT NULL;
