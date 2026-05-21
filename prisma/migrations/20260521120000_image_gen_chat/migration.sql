-- CreateEnum
CREATE TYPE "ChatPathType" AS ENUM ('ADS', 'IMAGE_GEN');

-- AlterEnum
ALTER TYPE "UploadSource" ADD VALUE 'GENERATED';

-- AlterTable
ALTER TABLE "ad_chat_sessions" ADD COLUMN "pathType" "ChatPathType";
