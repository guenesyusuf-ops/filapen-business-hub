'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ship, LogOut, Package, Truck, CheckCircle2, AlertTriangle, X, Boxes, MapPin, Phone } from 'lucide-react';
import { Button, Card, CardBody, Input, Select, StatusPill, EmptyState } from '@/components/ds';
import {
  portalApi, PortalOrder, PortalOrderStatus, PORTAL_STATUS_LABEL, CARRIERS,
  getPartnerToken, getPartnerName, setPartnerSession, clearPartnerSession,
} from '@/lib/dropshipping-portal';

const STATUS_TONE: Record<PortalOrderStatus, 'ok' | 'warn' | 'crit' | 'info' | 'neutral'> = {
  new: 'info', shipped_cn: 'warn', in_de: 'info', delivered: 'ok', on_hold: 'crit',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'shipped_cn', label: 'Shipped (CN)' },
  { key: 'in_de', label: 'In Germany' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'on_hold', label: 'On hold' },
];

function fmtAddr(a: any): string {
  if (!a || typeof a !== 'object') return '';
  return [a.address1, a.address2, [a.zip, a.city].filter(Boolean).join(' '), a.province, a.country]
    .filter(Boolean).join(', ');
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <div className="w-10 h-10 rounded-md bg-[var(--bg-secondary)] shrink-0 grid place-items-center text-[var(--text-tertiary)]"><Boxes size={16} /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-10 h-10 rounded-md object-cover shrink-0 border border-[var(--border-color)]" />;
}

export default function PartnerPortalPage() {
  const [authed, setAuthed] = useState(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(!!getPartnerToken());
    setName(getPartnerName());
  }, []);

  const onLogin = (n: string) => { setAuthed(true); setName(n); };
  const onLogout = () => { clearPartnerSession(); setAuthed(false); setName(null); };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--card-bg)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-600 text-white grid place-items-center"><Ship size={17} /></div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold leading-tight">Filapen Dropshipping</div>
            <div className="text-[12px] text-[var(--text-secondary)] leading-tight">Fulfillment partner portal</div>
          </div>
          {authed && (
            <div className="flex items-center gap-2">
              {name && <span className="text-[13px] text-[var(--text-secondary)] hidden sm:inline">{name}</span>}
              <Button variant="ghost" size="sm" leftIcon={<LogOut size={15} />} onClick={onLogout}>Sign out</Button>
            </div>
          )}
        </div>
      </header>

      {authed ? <OrdersView onAuthLost={onLogout} /> : <LoginView onLogin={onLogin} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

function LoginView({ onLogin }: { onLogin: (name: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) { setError('Please enter email and password.'); return; }
    setLoading(true); setError(null);
    try {
      const r = await portalApi.login(email.trim(), password);
      setPartnerSession(r.token, r.partner.name);
      onLogin(r.partner.name);
    } catch (e: any) {
      setError(e.message === 'Invalid credentials' || /401/.test(e.message) ? 'Wrong email or password.' : (e.message ?? 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div>
            <h1 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">Sign in</h1>
            <p className="m-0 mt-1 text-[14px] text-[var(--text-secondary)]">Access the orders assigned to you.</p>
          </div>
          {error && <div className="rounded-lg border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-3 py-2 text-[13.5px] text-[rgb(var(--color-error))]">{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} autoComplete="current-password" />
          </div>
          <Button variant="primary" loading={loading} onClick={submit}>Sign in</Button>
        </CardBody>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------

type ActionType = 'ship' | 'arrived' | 'hold';

function OrdersView({ onAuthLost }: { onAuthLost: () => void }) {
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<{ order: PortalOrder; type: ActionType } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    try {
      setError(null);
      setOrders(await portalApi.listOrders(s || undefined));
    } catch (e: any) {
      if (/sign in again/i.test(e.message)) { onAuthLost(); return; }
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [onAuthLost]);

  useEffect(() => { load(status); }, [load, status]);

  const markDelivered = async (o: PortalOrder) => {
    setBusyId(o.id);
    try { await portalApi.delivered(o.id); await load(status); }
    catch (e: any) { setError(e.message ?? 'Failed'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              status === f.key ? 'bg-primary-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-primary-500/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">{error}</div>}

      {loading ? (
        <div className="px-4 py-12 text-center text-[14px] text-[var(--text-secondary)]">Loading…</div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<Package size={28} />} title="No orders" description="There are no orders to fulfill right now." />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold">#{o.orderNumber}</span>
                      <StatusPill tone={STATUS_TONE[o.status]}>{PORTAL_STATUS_LABEL[o.status]}</StatusPill>
                      <span className="text-[12.5px] text-[var(--text-secondary)]">{new Date(o.placedAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="mt-1.5 text-[13.5px] text-[var(--text-primary)] font-medium">{o.customerName ?? '—'}</div>
                    <div className="text-[13px] text-[var(--text-secondary)] flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" />{fmtAddr(o.shippingAddress) || '—'}</div>
                    {o.customerPhone && <div className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1.5"><Phone size={14} />{o.customerPhone}</div>}
                  </div>
                </div>

                {/* Items */}
                <div className="flex flex-col gap-1.5 border-t border-[var(--border-color)] pt-3">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2.5">
                      <Thumb url={it.imageUrl} alt={it.sku ?? it.title} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] text-[var(--text-primary)] truncate">{it.title}</div>
                        <div className="text-[12px] text-[var(--text-secondary)] font-mono">{it.sku ?? '—'}</div>
                      </div>
                      <div className="ml-auto text-[14px] font-semibold tabular-nums">×{it.quantity}</div>
                    </div>
                  ))}
                </div>

                {/* Tracking info */}
                {(o.cnTracking || o.deTracking) && (
                  <div className="text-[12.5px] text-[var(--text-secondary)] flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border-color)] pt-2.5">
                    {o.cnTracking && <span>CN tracking: <span className="font-mono text-[var(--text-primary)]">{o.cnTracking}</span></span>}
                    {o.deTracking && <span>DE tracking: <span className="font-mono text-[var(--text-primary)]">{o.deTracking}</span>{o.carrier ? ` (${o.carrier})` : ''}</span>}
                  </div>
                )}
                {o.status === 'on_hold' && o.note && (
                  <div className="text-[13px] text-[rgb(var(--color-error))] border-t border-[var(--border-color)] pt-2.5">Problem: {o.note}</div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t border-[var(--border-color)] pt-3">
                  {(o.status === 'new' || o.status === 'on_hold') && (
                    <Button variant="primary" size="sm" leftIcon={<Truck size={15} />} onClick={() => setAction({ order: o, type: 'ship' })}>Mark as shipped</Button>
                  )}
                  {o.status === 'shipped_cn' && (
                    <Button variant="primary" size="sm" leftIcon={<MapPin size={15} />} onClick={() => setAction({ order: o, type: 'arrived' })}>Arrived in Germany</Button>
                  )}
                  {o.status === 'in_de' && (
                    <Button variant="primary" size="sm" leftIcon={<CheckCircle2 size={15} />} loading={busyId === o.id} onClick={() => markDelivered(o)}>Mark delivered</Button>
                  )}
                  {o.status !== 'delivered' && o.status !== 'on_hold' && (
                    <Button variant="ghost" size="sm" leftIcon={<AlertTriangle size={15} />} onClick={() => setAction({ order: o, type: 'hold' })}>Report problem</Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {action && (
        <ActionModal
          order={action.order}
          type={action.type}
          onClose={() => setAction(null)}
          onDone={async () => { setAction(null); await load(status); }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Action modal
// -----------------------------------------------------------------------------

function ActionModal({ order, type, onClose, onDone }: { order: PortalOrder; type: ActionType; onClose: () => void; onDone: () => void }) {
  const [cn, setCn] = useState('');
  const [de, setDe] = useState('');
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [carrierOther, setCarrierOther] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (type === 'ship' ? 'Mark as shipped' : type === 'arrived' ? 'Arrived in Germany' : 'Report a problem'), [type]);

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      if (type === 'ship') {
        if (!cn.trim()) throw new Error('Please enter the Chinese tracking number.');
        await portalApi.ship(order.id, cn.trim());
      } else if (type === 'arrived') {
        if (!de.trim()) throw new Error('Please enter the German tracking number.');
        const comp = carrier === 'Other' ? carrierOther.trim() : carrier;
        if (!comp) throw new Error('Please enter the carrier.');
        await portalApi.arrived(order.id, de.trim(), comp);
      } else {
        if (!note.trim()) throw new Error('Please describe the problem.');
        await portalApi.hold(order.id, note.trim());
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-[16px] font-semibold">{title} — #{order.orderNumber}</h3>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Button>
            </div>
            {error && <div className="rounded-lg border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-3 py-2 text-[13.5px] text-[rgb(var(--color-error))]">{error}</div>}

            {type === 'ship' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold">Chinese tracking number</label>
                <Input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="e.g. LP00123456789CN" autoFocus />
              </div>
            )}

            {type === 'arrived' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold">German tracking number</label>
                  <Input value={de} onChange={(e) => setDe(e.target.value)} placeholder="e.g. 00340434..." autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold">Carrier</label>
                  <Select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                    {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other…</option>
                  </Select>
                  {carrier === 'Other' && (
                    <Input className="mt-1.5" value={carrierOther} onChange={(e) => setCarrierOther(e.target.value)} placeholder="Carrier name" />
                  )}
                </div>
                <p className="m-0 text-[12.5px] text-[var(--text-secondary)]">The customer will automatically receive the shipping notification with this tracking number.</p>
              </>
            )}

            {type === 'hold' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold">What is the problem?</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] outline-none focus:border-primary-500"
                  placeholder="e.g. out of stock, address incomplete…"
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" loading={loading} onClick={submit}>Confirm</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
