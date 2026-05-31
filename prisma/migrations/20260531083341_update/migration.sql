/*
  Warnings:

  - A unique constraint covering the columns `[zernioAccountId]` on the table `social_integrations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "social_integrations" ADD COLUMN     "zernioAccountId" VARCHAR(255),
ALTER COLUMN "accessToken" DROP NOT NULL;

-- CreateTable
CREATE TABLE "zernio_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "zernioProfileId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "zernio_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zernio_profiles_companyId_key" ON "zernio_profiles"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "zernio_profiles_zernioProfileId_key" ON "zernio_profiles"("zernioProfileId");

-- CreateIndex
CREATE INDEX "zernio_profiles_companyId_idx" ON "zernio_profiles"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "social_integrations_zernioAccountId_key" ON "social_integrations"("zernioAccountId");

-- AddForeignKey
ALTER TABLE "zernio_profiles" ADD CONSTRAINT "zernio_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
