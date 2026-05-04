-- CreateEnum
CREATE TYPE "StreamQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StreamQueuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateTable
CREATE TABLE "stream_queues" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "r2Key" VARCHAR(500) NOT NULL,
    "r2Bucket" VARCHAR(255) NOT NULL,
    "status" "StreamQueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "StreamQueuePriority" NOT NULL DEFAULT 'NORMAL',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "streamId" VARCHAR(255),
    "lastError" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stream_queues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stream_queues_assetId_idx" ON "stream_queues"("assetId");

-- CreateIndex
CREATE INDEX "stream_queues_status_idx" ON "stream_queues"("status");

-- CreateIndex
CREATE INDEX "stream_queues_priority_createdAt_idx" ON "stream_queues"("priority", "createdAt");

-- AddForeignKey
ALTER TABLE "stream_queues" ADD CONSTRAINT "stream_queues_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
