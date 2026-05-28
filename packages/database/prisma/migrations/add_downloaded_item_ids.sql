-- Pro Empfaenger tracken welche Items er heruntergeladen hat.
-- Cleanup darf erst stattfinden wenn ALLE Items eines Transfers von
-- diesem Empfaenger heruntergeladen wurden (sonst gehen Bulk-Downloads
-- kaputt: erste Datei loescht R2 → Datei 2..N kriegt 404).
ALTER TABLE file_transfer_recipients
  ADD COLUMN IF NOT EXISTS downloaded_item_ids uuid[] NOT NULL DEFAULT '{}';
