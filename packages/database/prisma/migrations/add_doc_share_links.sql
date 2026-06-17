-- ============================================================================
-- Documents — Public Share-Links fuer externen Read-Only-Zugriff
-- ============================================================================

CREATE TABLE IF NOT EXISTS doc_share_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  folder_id       uuid NOT NULL REFERENCES doc_folders(id) ON DELETE CASCADE,
  token           varchar(64) NOT NULL UNIQUE,
  created_by_id   uuid NOT NULL,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  view_count      integer NOT NULL DEFAULT 0,
  last_viewed_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_share_links_org ON doc_share_links (org_id);
CREATE INDEX IF NOT EXISTS idx_doc_share_links_folder ON doc_share_links (folder_id);
