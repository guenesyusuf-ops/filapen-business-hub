import { ShopifyAnalyticsClient } from '@/components/channels/shopify/ShopifyAnalyticsClient';

export const metadata = {
  title: 'Shopify Analytics - Filapen',
  description: 'Shopify Admin Analytics Dashboard — Umsatz, Bestellungen, Produkte, Retouren',
};

export default function ShopifyAnalyticsPage() {
  return <ShopifyAnalyticsClient />;
}
