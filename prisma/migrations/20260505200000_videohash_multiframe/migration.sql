-- Bump videoHash to fit multi-frame hashes (3 frames * 16 chars + 2 colons = 50, padded to 80)
ALTER TABLE "assets" ALTER COLUMN "videoHash" TYPE VARCHAR(80);

-- Clear stale single-frame hashes so they get recomputed with multi-frame logic
-- UPDATE "assets" SET "videoHash" = NULL WHERE "videoHash" IS NOT NULL;
