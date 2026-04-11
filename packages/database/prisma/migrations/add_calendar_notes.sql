-- Migration: add_calendar_notes
-- Creates the calendar_notes table used by the Creator Hub dashboard
-- for per-day notes and reminders.

CREATE TABLE IF NOT EXISTS "calendar_notes" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"      UUID NOT NULL,
  "date"        DATE NOT NULL,
  "content"     TEXT NOT NULL,
  "reminder_at" TIMESTAMPTZ,
  "created_by"  VARCHAR(255) NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "calendar_notes_org_id_date_idx"
  ON "calendar_notes" ("org_id", "date");
