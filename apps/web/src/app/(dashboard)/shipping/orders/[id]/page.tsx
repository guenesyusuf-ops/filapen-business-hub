'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MapPin, User, Mail, Phone, CreditCard, Package, Tag, Calendar, Truck, AlertCircle, ExternalLink } from 'lucide-react';
import { shippingApi, fmtDateTime, SHIPMENT_STATUS_LABELS, CARRIER_LABELS, type OrderShipmentStatus } from '@/lib/shipping';
import { PageHeader, Badge, Money, SectionCard, btn } from '@/components/shipping/ShippingUI';

export default function ShippingOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [order, setOrder] = useState<any>(null);
  const [weight, setWeight] = useState<{ totalG: number; unknownCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      shippingApi.getOrder(id),
      shippingApi.orderWeight(id).catch(() => null),
    ])
      .then(([o, w]) => {
        setOrder(o);
        setWeight(w);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Link href="/shipping/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Bestellungen
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          <strong>Fehler beim Laden der Bestellung:</strong> {error}
        </div>
      </div>
    );
  }

  if (!order) return null;

  const addr = order.shippingAddress as any;
  const hasAddress = !!addr && (addr.address1 || addr.street || addr.zip);
  const shipments = order.shipments || [];
  const lineItems = order.lineItems || [];
  const tags = order.tags || [];

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/shipping/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Zurück zu Bestellungen
      </Link>

      <PageHeader
        title={`Bestellung #${order.orderNumber}`}
        subtitle={`${fmtDateTime(order.placedAt)} · ${order.shop?.name || 'Shop'}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {order.status}
            </Badge>
            <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {order.fulfillmentStatus}
            </Badge>
            <Badge color={
              order.financialStatus === 'paid'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }>
              {order.financialStatus}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: items + totals */}
        <div className="lg:col-span-2 space-y-4">
          {/* Line Items */}
          <SectionCard title={`Produkte (${lineItems.length})`} description={weight ? `Gewicht: ${(weight.totalG / 1000).toFixed(2)} kg${weight.unknownCount > 0 ? ` · ${weight.unknownCount} ohne Profil` : ''}` : undefined}>
            {lineItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">Keine Produkte</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {lineItems.map((li: any) => (
                  <div key={li.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{li.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                          {li.sku && <span>SKU: {li.sku}</span>}
                          <span>Menge: {Number(li.quantity)}</span>
                          <span>Einzelpreis: <Money amount={li.unitPrice} currency={order.currency} /></span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      <Money amount={li.lineTotal} currency={order.currency} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Totals */}
          <SectionCard title="Beträge">
            <div className="space-y-2 text-sm">
              <TotalRow label="Zwischensumme" value={order.subtotalPrice} currency={order.currency} />
              {Number(order.totalDiscounts) > 0 && (
                <TotalRow label="Rabatt" value={`-${order.totalDiscounts}`} currency={order.currency} muted />
              )}
              <TotalRow label="Versand" value={order.totalShipping} currency={order.currency} muted />
              <TotalRow label="Steuer" value={order.totalTax} currency={order.currency} muted />
              {Number(order.totalRefunded) > 0 && (
                <TotalRow label="Erstattet" value={`-${order.totalRefunded}`} currency={order.currency} muted />
              )}
              <div className="border-t border-gray-100 dark:border-white/8 pt-2 mt-2">
                <TotalRow label="Gesamt" value={order.totalPrice} currency={order.currency} bold />
              </div>
            </div>
          </SectionCard>

          {/* Shipments */}
          <SectionCard
            title={`Sendungen (${shipments.length})`}
            description={shipments.length === 0 ? 'Noch kein Versandetikett erstellt.' : undefined}
          >
            {shipments.length === 0 ? (
              <div className="py-6 text-center">
                <div className="text-sm text-gray-500 mb-3">Keine Sendung für diese Bestellung.</div>
                <Link href="/shipping/orders" className={btn('primary', 'h-8 px-3 py-1 text-xs')}>
                  <Truck className="h-3.5 w-3.5" /> Label in Übersicht erstellen
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {shipments.map((s: any) => {
                  const st = SHIPMENT_STATUS_LABELS[s.status as OrderShipmentStatus];
                  return (
                    <Link
                      key={s.id}
                      href={`/shipping/shipments/${s.id}`}
                      className="block rounded-lg border border-gray-100 dark:border-white/8 p-3 hover:border-gray-200 dark:hover:border-white/15 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {s.trackingNumber || '— keine Tracking-Nr. —'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {CARRIER_LABELS[s.carrier as keyof typeof CARRIER_LABELS] || s.carrier} · {fmtDateTime(s.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {st && <Badge color={st.color}>{st.label}</Badge>}
                          <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column: customer, address, meta */}
        <div className="space-y-4">
          {/* Customer */}
          <SectionCard title="Kunde">
            <div className="space-y-2 text-sm">
              <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={order.customerName || '—'} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={order.customerEmail || '—'} link={order.customerEmail ? `mailto:${order.customerEmail}` : undefined} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefon" value={order.customerPhone || '—'} link={order.customerPhone ? `tel:${order.customerPhone}` : undefined} />
              {order.isFirstOrder && (
                <div className="mt-2">
                  <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Erstbestellung</Badge>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Shipping Address */}
          <SectionCard title="Lieferadresse">
            {hasAddress ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="text-gray-900 dark:text-white">
                    {(addr.name || addr.firstName || addr.lastName) && (
                      <div>{[addr.firstName, addr.lastName].filter(Boolean).join(' ') || addr.name}</div>
                    )}
                    {addr.company && <div className="text-gray-500">{addr.company}</div>}
                    <div>{addr.address1 || addr.street}</div>
                    {addr.address2 && <div>{addr.address2}</div>}
                    <div>{addr.zip} {addr.city}</div>
                    {addr.province && <div className="text-gray-500">{addr.province}</div>}
                    <div className="text-xs text-gray-500 uppercase mt-1">
                      {addr.country || addr.countryCode || order.countryCode}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                Lieferadresse fehlt — in der Bestellübersicht „Aus Shopify nachladen" klicken.
              </div>
            )}
          </SectionCard>

          {/* Payment & Meta */}
          <SectionCard title="Zahlung & Metadaten">
            <div className="space-y-2 text-sm">
              <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Zahlungsart" value={order.paymentGateway || '—'} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Bestelldatum" value={fmtDateTime(order.placedAt)} />
              {order.sourceName && <InfoRow icon={<Tag className="h-4 w-4" />} label="Kanal" value={order.sourceName} />}
              {tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t: string) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string; link?: string }) {
  const content = (
    <span className={link ? 'text-primary-700 dark:text-primary-300 hover:underline' : 'text-gray-900 dark:text-white'}>
      {value}
    </span>
  );
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="truncate">{link && value !== '—' ? <a href={link}>{content}</a> : content}</div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, currency, bold, muted }: { label: string; value: any; currency: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-gray-900 dark:text-white' : muted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
      <span>{label}</span>
      <Money amount={value} currency={currency} />
    </div>
  );
}
