-- AlterTable
ALTER TABLE "company_job_configs" ADD COLUMN "schedule" JSONB NOT NULL DEFAULT '{"hour":14,"minute":30,"dayOfWeek":1,"dayOfMonth":1,"timezone":"Asia/Kolkata"}';
