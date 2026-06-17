-- Composite-Index fuer Bands-Listing — listBands sortiert nach createdAt DESC,
-- bisher kein passender Index → in-memory Sort nach Filter.
CREATE INDEX IF NOT EXISTS "nfc_bands_org_id_created_at_idx"
  ON nfc_bands (org_id, created_at DESC);
