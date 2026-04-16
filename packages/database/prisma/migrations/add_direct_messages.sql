-- Direct messages between users (1-on-1 chat on /home widget)

CREATE TABLE IF NOT EXISTS direct_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content      text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread
  ON direct_messages (recipient_id, read_at);

CREATE INDEX IF NOT EXISTS idx_dm_thread
  ON direct_messages (sender_id, recipient_id, created_at);
