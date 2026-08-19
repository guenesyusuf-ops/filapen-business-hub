import { PlaceholderCard } from '../_placeholder';

export default function ProduktkostenPage() {
  return (
    <PlaceholderCard
      title="Produktkosten"
      subtitle="Historisierte Produkt- und Amazon-Fulfillment-Kosten"
      phase="Phase 2"
      description="Eine Zeile pro aktivem Shopify-Produkt aus der bestehenden Product-Tabelle. Pflege pro Produkt: Produktkosten pro Stück + Amazon-Fulfillment-Kosten pro Stück, jeweils mit Gültigkeitsdatum. Änderungen ändern nie historische Berechnungen — jede Kostenperiode bleibt für ihre Zeit gültig."
    />
  );
}
