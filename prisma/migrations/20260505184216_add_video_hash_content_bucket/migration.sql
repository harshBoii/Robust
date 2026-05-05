-- AlterEnum
ALTER TYPE "BucketType" ADD VALUE 'CONTENT';

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "videoHash" VARCHAR(16);
