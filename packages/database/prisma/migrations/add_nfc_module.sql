-- ============================================================================
-- NFC4you Module — Batches, Bands, Activations, Audit Log
--
-- - Bänder werden in Batches generiert (6-stelliger Code)
-- - Aktivierung legt eine Activation an (Kunden-Daten + optionale PIN)
-- - Public-Scan ohne Auth, nur Edit braucht PIN
-- - Komplettes Audit-Log fuer DSGVO
-- ============================================================================

-- Batches
CREATE TABLE IF NOT EXISTS nfc_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  name         varchar(255),
  count        integer NOT NULL,
  created_by_id uuid,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfc_batches_org ON nfc_batches (org_id);
CREATE INDEX IF NOT EXISTS idx_nfc_batches_org_created ON nfc_batches (org_id, created_at DESC);

-- Bands
CREATE TABLE IF NOT EXISTS nfc_bands (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  batch_id        uuid NOT NULL REFERENCES nfc_batches(id) ON DELETE CASCADE,
  code            varchar(32) NOT NULL UNIQUE,
  status          varchar(32) NOT NULL DEFAULT 'inactive',
  activated_at    timestamptz,
  last_scan_at    timestamptz,
  scan_count      integer NOT NULL DEFAULT 0,
  assigned_email  varchar(320),
  assigned_at     timestamptz,
  assignment_note varchar(255),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfc_bands_org ON nfc_bands (org_id);
CREATE INDEX IF NOT EXISTS idx_nfc_bands_org_status ON nfc_bands (org_id, status);
CREATE INDEX IF NOT EXISTS idx_nfc_bands_batch ON nfc_bands (batch_id);
CREATE INDEX IF NOT EXISTS idx_nfc_bands_org_lastscan ON nfc_bands (org_id, last_scan_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfc_bands_assigned_email ON nfc_bands (assigned_email);

-- Activations (Kunden-Daten)
CREATE TABLE IF NOT EXISTS nfc_activations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id                     uuid NOT NULL UNIQUE REFERENCES nfc_bands(id) ON DELETE CASCADE,
  org_id                      uuid NOT NULL,
  first_name                  varchar(120),
  last_name                   varchar(120),
  phone                       varchar(64),
  phone2                      varchar(64),
  notes                       text,
  street                      varchar(255),
  zip                         varchar(32),
  city                        varchar(120),
  email                       varchar(320),
  edit_pin_hash               varchar(120),
  edit_pin_set_at             timestamptz,
  edit_pin_failed_attempts    integer NOT NULL DEFAULT 0,
  edit_pin_locked_until       timestamptz,
  pin_reset_token_hash        varchar(120),
  pin_reset_token_expires_at  timestamptz,
  consent_given_at            timestamptz NOT NULL,
  consent_version             varchar(32),
  activation_ip               varchar(64),
  activation_ua               text,
  inactivity_reminder_sent_at timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfc_activations_org ON nfc_activations (org_id);
CREATE INDEX IF NOT EXISTS idx_nfc_activations_org_created ON nfc_activations (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfc_activations_email ON nfc_activations (email);

-- Audit-Log
CREATE TABLE IF NOT EXISTS nfc_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  band_id     uuid,
  type        varchar(64) NOT NULL,
  actor_id    uuid,
  ip_address  varchar(64),
  user_agent  text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_org_created ON nfc_audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_band_created ON nfc_audit_log (band_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_org_type_created ON nfc_audit_log (org_id, type, created_at DESC);
