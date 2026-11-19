import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { OrderStatusBadge } from '@/components/ui/StatusBadge';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { advanceOrder, cancelOrder, chargeOrderToRoom, orderTotal, payOrder, updateOrderLines } from '@/services/mockRestaurantService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { PaymentMethod, RestaurantOrder } from '@/types';
import { formatCurrency } from '@/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import { MenuPicker, toLines } from './MenuPicker';
import { FINANCIAL_ROLES } from '@/routes/nav';

const ADVANCE_LABEL = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' } as const;

export function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useHotelStore((s) => s.orders.find((o) => o.id === orderId));
  return order ? <Body key={order.id} order={order} onClose={onClose} /> : null;
}

function Body({ order, onClose }: { order: RestaurantOrder; onClose: () => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canManageFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const table = useHotelStore((s) => s.tables.find((t) => t.id === order.tableId));
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === order.roomId));
  const reservations = useHotelStore((s) => s.reservations);
  const rooms = useHotelStore((s) => s.rooms);
  const guests = useHotelStore((s) => s.guests);
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState(order.notes ?? '');
  const [method, setMethod] = useState<PaymentMethod>('pos');
  const [stay, setStay] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inHouse = reservations.filter((r) => r.hotelId === order.hotelId && r.status === 'checked_in').map((r) => ({ r, rm: rooms.find((x) => x.id === r.roomId)!, g: guests.find((x) => x.id === r.guestId)! }));
  const total = orderTotal(order);
  const settled = order.payment !== 'open';
  const where = order.type === 'dine_in' ? `Table ${table?.number}` : `Room ${room?.number}`;

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError('');
    toast.success(msg, order.reference);
  };

  const startEdit = () => { setQty(Object.fromEntries(order.lines.map((l) => [l.menuItemId, l.qty]))); setEditing(true); };

  return (
    <>
      <Dialog open={!cancelling} onClose={onClose} variant="drawer" title={`${order.reference} · ${where}`} description={`${order.guestName}${order.covers ? ` · ${order.covers} guests` : ''} · ${order.time}`}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><OrderStatusBadge status={order.status} /><Badge tone={order.type === 'dine_in' ? 'neutral' : 'champagne'}>{order.type === 'dine_in' ? 'Dine-in' : 'Room service'}</Badge>{canManageFinancials && order.payment === 'paid' && <Badge tone="success">Paid · {PAYMENT_METHOD_LABEL[order.method ?? 'cash']}</Badge>}{canManageFinancials && order.payment === 'charged_to_room' && <Badge tone="info">Charged to room</Badge>}</div>
          {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}

          {editing ? (
            <div className="space-y-3">
              <MenuPicker quantities={qty} onChange={setQty} />
              <Textarea label="Kitchen notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex gap-2"><Button loading={busy} onClick={() => run(async () => { const r = await updateOrderLines(order.id, toLines(qty), notes); if (r.ok) setEditing(false); return r; }, 'Order updated')}>Save changes</Button><Button variant="secondary" onClick={() => setEditing(false)}>Discard</Button></div>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line rounded border border-line">{order.lines.map((l) => <li key={l.menuItemId} className="flex justify-between px-3 py-2 text-body"><span>{l.qty} × {l.name}</span>{canManageFinancials && <span className="tnum">{formatCurrency(l.price * l.qty)}</span>}</li>)}{canManageFinancials && <li className="flex justify-between bg-ivory/60 px-3 py-2 font-semibold"><span>Total</span><span className="tnum">{formatCurrency(total)}</span></li>}</ul>
              {order.notes && <p className="rounded bg-ivory px-3 py-2 text-body text-slate">{order.notes}</p>}
            </>
          )}

          {!editing && order.status !== 'cancelled' && (
            <div className="space-y-4 border-t border-line pt-4">
              {order.status in ADVANCE_LABEL && <div className="flex flex-wrap gap-2"><Button loading={busy} onClick={() => run(() => advanceOrder(order.id), 'Order updated')}>{ADVANCE_LABEL[order.status as keyof typeof ADVANCE_LABEL]}</Button>{order.status === 'new' && <Button variant="secondary" onClick={startEdit}>Edit items</Button>}{(order.status === 'new' || order.status === 'preparing') && <Button variant="ghost" onClick={() => setCancelling(true)}>Cancel order</Button>}</div>}
              {canManageFinancials && order.status === 'served' && !settled && (
                <div className="space-y-3">
                  {order.type === 'dine_in' && <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Select label="Settle at table" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} /><Button loading={busy} onClick={() => run(() => payOrder(order.id, method), 'Order settled')}>Settle {formatCurrency(total)}</Button></div>}
                  {order.type === 'dine_in' ? (
                    inHouse.length > 0 && <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Select label="Or charge to an in-house guest" value={stay} onChange={(e) => setStay(e.target.value)} options={[{ value: '', label: 'Choose a room…' }, ...inHouse.map(({ r, rm, g }) => ({ value: r.id, label: `${rm.number} — ${g.fullName}` }))]} /><Button variant="secondary" loading={busy} disabled={!stay} onClick={() => run(() => chargeOrderToRoom(order.id, stay), 'Charged to room')}>Charge to room</Button></div>
                  ) : (
                    <div className="flex flex-wrap gap-2"><Button loading={busy} onClick={() => run(() => chargeOrderToRoom(order.id), 'Charged to room folio')}>Charge {formatCurrency(total)} to room {room?.number}</Button></div>
                  )}
                </div>
              )}
              {canManageFinancials && order.status === 'served' && settled && <p className="text-body text-slate">This order is complete.</p>}
            </div>
          )}
        </div>
      </Dialog>
      <ConfirmDialog open={cancelling} title="Cancel this order?" confirmLabel="Cancel order" danger loading={busy} onConfirm={async () => { setBusy(true); const r = await cancelOrder(order.id); setBusy(false); setCancelling(false); if (r.ok) { toast.info('Order cancelled', order.reference); onClose(); } else setError(r.error); }} onClose={() => setCancelling(false)}>The kitchen will stop work on {order.reference}. This cannot be undone.</ConfirmDialog>
    </>
  );
}
