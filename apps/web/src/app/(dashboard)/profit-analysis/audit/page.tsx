import { PlaceholderCard } from '../_placeholder';

export default function AuditPage() {
  return (
    <PlaceholderCard
      title="Audit Log"
      subtitle="Änderungsverlauf aller finanziellen Datenpunkte"
      phase="Phase 10"
      description={'Nutzt das zentrale AuditLog-Model. Wer hat wann welchen Wert wie geändert — mit altem und neuem Wert. Filter nach Nutzer, Datum, Feld und Entitätstyp. Beispiel: "Max Mustermann änderte den Meta-Ads-Wert vom 17.08.2026 von 1.240 € auf 1.310 €".'}
    />
  );
}
