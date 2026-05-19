-- CreateEnum
CREATE TYPE "AdChatSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdChatMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "ad_chat_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" VARCHAR(255),
    "title" VARCHAR(500) NOT NULL DEFAULT 'New chat',
    "status" "AdChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" VARCHAR(64) NOT NULL DEFAULT 'intent',
    "workflowState" JSONB NOT NULL DEFAULT '{}',
    "bulkUploadId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "AdChatMessageRole" NOT NULL,
    "content" TEXT,
    "widgetType" VARCHAR(64),
    "widgetPayload" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_chat_sessions_companyId_idx" ON "ad_chat_sessions"("companyId");

-- CreateIndex
CREATE INDEX "ad_chat_sessions_companyId_updatedAt_idx" ON "ad_chat_sessions"("companyId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ad_chat_messages_sessionId_idx" ON "ad_chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "ad_chat_messages_sessionId_createdAt_idx" ON "ad_chat_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ad_chat_sessions" ADD CONSTRAINT "ad_chat_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_chat_messages" ADD CONSTRAINT "ad_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ad_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
