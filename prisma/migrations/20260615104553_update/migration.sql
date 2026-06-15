-- CreateTable
CREATE TABLE "meta_api_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "method" VARCHAR(16) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "request_url" TEXT NOT NULL,
    "request_payload" JSONB,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "operation" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_api_logs_company_id_created_at_idx" ON "meta_api_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "meta_api_logs_company_id_success_idx" ON "meta_api_logs"("company_id", "success");

-- CreateIndex
CREATE INDEX "meta_api_logs_created_at_idx" ON "meta_api_logs"("created_at");

-- AddForeignKey
ALTER TABLE "meta_api_logs" ADD CONSTRAINT "meta_api_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
