-- WM Notifications Table
CREATE TABLE IF NOT EXISTS wm_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  task_id    UUID,
  project_id UUID,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wm_notifications_user_read ON wm_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_wm_notifications_created ON wm_notifications(created_at DESC);
