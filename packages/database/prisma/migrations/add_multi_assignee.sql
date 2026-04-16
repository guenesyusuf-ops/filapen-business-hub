-- Multi-assignee support for WmTask — join table wm_task_assignees
-- The legacy wm_tasks.assignee_id column stays for backwards-compat
-- (mirrors the first assignee) but reads should prefer the join table.

CREATE TABLE IF NOT EXISTS wm_task_assignees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL,
  user_id     uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_assignee
  ON wm_task_assignees (task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_wm_task_assignees_user
  ON wm_task_assignees (user_id);

CREATE INDEX IF NOT EXISTS idx_wm_task_assignees_task
  ON wm_task_assignees (task_id);

-- Backfill: migrate existing single assignees into the join table.
INSERT INTO wm_task_assignees (task_id, user_id, assigned_at)
SELECT id, assignee_id, COALESCE(created_at, now())
FROM wm_tasks
WHERE assignee_id IS NOT NULL
  AND assignee_id IN (SELECT id FROM users)
ON CONFLICT (task_id, user_id) DO NOTHING;
