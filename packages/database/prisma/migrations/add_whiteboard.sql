-- Whiteboard-Modul (Miro-aehnlich, tldraw + Liveblocks)
-- 3 Tabellen:
--   whiteboards          — Boards selbst, JSON-state mit aktuellem tldraw-Snapshot
--   whiteboard_snapshots — Versions-History pro Auto-Save
--   whiteboard_members   — Per-Board Permissions (owner / editor / viewer)

CREATE TABLE IF NOT EXISTS whiteboards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                 VARCHAR(255) NOT NULL,
  description           TEXT,
  thumbnail_url         TEXT,
  state                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  liveblocks_room_id    VARCHAR(100),
  created_by_id         UUID NOT NULL,
  last_edited_by_id     UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whiteboards_org_idx ON whiteboards (org_id);
CREATE INDEX IF NOT EXISTS whiteboards_org_updated_idx ON whiteboards (org_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS whiteboard_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id   UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  state           JSONB NOT NULL,
  captured_by_id  UUID NOT NULL,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whiteboard_snapshots_board_captured_idx
  ON whiteboard_snapshots (whiteboard_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS whiteboard_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id   UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  role            VARCHAR(20) NOT NULL DEFAULT 'editor',
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (whiteboard_id, user_id)
);
CREATE INDEX IF NOT EXISTS whiteboard_members_user_idx ON whiteboard_members (user_id);
