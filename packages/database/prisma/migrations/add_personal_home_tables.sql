-- Home dashboard: personal notes + personal calendar events (per-user)

CREATE TABLE IF NOT EXISTS personal_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  content    text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  color      varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_notes_user
  ON personal_notes (user_id, pinned, created_at DESC);

CREATE TABLE IF NOT EXISTS personal_calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       varchar(255) NOT NULL,
  description text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  all_day     boolean NOT NULL DEFAULT false,
  reminder_at timestamptz,
  color       varchar(20),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_calendar_user_time
  ON personal_calendar_events (user_id, starts_at);
