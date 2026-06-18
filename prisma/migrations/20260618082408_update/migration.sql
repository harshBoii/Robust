-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "access_requested_at" TIMESTAMPTZ(3),
ADD COLUMN     "access_review_note" TEXT,
ADD COLUMN     "access_reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "access_status" "AccessStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "onboarding_plan" JSONB,
ADD COLUMN     "onboarding_step" VARCHAR(64);
