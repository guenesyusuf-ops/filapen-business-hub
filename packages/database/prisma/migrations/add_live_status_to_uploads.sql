-- Add live status columns to creator_uploads table
ALTER TABLE "creator_uploads" ADD COLUMN IF NOT EXISTS "live_status" VARCHAR(20);
ALTER TABLE "creator_uploads" ADD COLUMN IF NOT EXISTS "live_date" DATE;
ALTER TABLE "creator_uploads" ADD COLUMN IF NOT EXISTS "live_approved_at" TIMESTAMPTZ;
ALTER TABLE "creator_uploads" ADD COLUMN IF NOT EXISTS "live_approved_by" UUID;

-- Add index for live status queries
CREATE INDEX IF NOT EXISTS "creator_uploads_org_id_live_status_idx" ON "creator_uploads"("org_id", "live_status");
