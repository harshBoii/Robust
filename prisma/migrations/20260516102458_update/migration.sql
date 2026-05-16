-- AlterTable
ALTER TABLE "adset_presets" ADD COLUMN     "scheduleCustomEnd" TIMESTAMPTZ(3),
ADD COLUMN     "scheduleDuration" VARCHAR(32);
