-- Filapen Send: Datei-Sharing zwischen Team-Mitgliedern
-- Architektur: 1 Sender → N Empfaenger → N Dateien

CREATE TABLE IF NOT EXISTS file_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_transfer_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES file_transfers(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  received_at timestamptz,
  deleted_by_recipient_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (transfer_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS file_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES file_transfers(id) ON DELETE CASCADE,
  file_name varchar(500) NOT NULL,
  file_path varchar(1000),
  mime_type varchar(160),
  file_size bigint NOT NULL,
  storage_key text NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_org ON file_transfers(org_id);
CREATE INDEX IF NOT EXISTS idx_ft_sender ON file_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_ftr_recipient ON file_transfer_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_ftr_transfer ON file_transfer_recipients(transfer_id);
CREATE INDEX IF NOT EXISTS idx_fti_transfer ON file_transfer_items(transfer_id);
