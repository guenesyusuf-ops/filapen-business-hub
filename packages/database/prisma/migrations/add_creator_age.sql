-- Add age field to creators table
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "age" INTEGER;
