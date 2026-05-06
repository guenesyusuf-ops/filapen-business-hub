-- Whiteboard-Ordner: Boards koennen optional in Ordnern liegen.
-- Eine Ebene tief, kein Verschachteln.
-- Loesch-Recht (Boards UND Ordner): nur Ersteller oder org-owner.

CREATE TABLE IF NOT EXISTS whiteboard_folders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  created_by_id UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whiteboard_folders_org_idx ON whiteboard_folders (org_id);

ALTER TABLE whiteboards
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES whiteboard_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS whiteboards_folder_idx ON whiteboards (folder_id);
