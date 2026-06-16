-- CreateEnum
CREATE TYPE "CompanyJobType" AS ENUM ('META_AUTO_ADS', 'BOUNTY_PAGE_GENERATION', 'BOUNTY_TOPIC_SCAN', 'RADAR_PROMPT_REFRESH');

-- CreateEnum
CREATE TYPE "JobFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CompanyJobRunStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "last_microservice_job_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "company_job_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_type" "CompanyJobType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "JobFrequency" NOT NULL DEFAULT 'WEEKLY',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "qstash_schedule_id" VARCHAR(255),
    "last_run_at" TIMESTAMPTZ(3),
    "next_run_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_job_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_job_runs" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_type" "CompanyJobType" NOT NULL,
    "status" "CompanyJobRunStatus" NOT NULL DEFAULT 'SUCCESS',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "company_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_job_configs_company_id_idx" ON "company_job_configs"("company_id");

-- CreateIndex
CREATE INDEX "company_job_configs_enabled_next_run_at_idx" ON "company_job_configs"("enabled", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "company_job_configs_company_id_job_type_key" ON "company_job_configs"("company_id", "job_type");

-- CreateIndex
CREATE INDEX "company_job_runs_company_id_job_type_started_at_idx" ON "company_job_runs"("company_id", "job_type", "started_at" DESC);

-- CreateIndex
CREATE INDEX "company_job_runs_config_id_idx" ON "company_job_runs"("config_id");

-- AddForeignKey
ALTER TABLE "company_job_configs" ADD CONSTRAINT "company_job_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_job_runs" ADD CONSTRAINT "company_job_runs_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "company_job_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
