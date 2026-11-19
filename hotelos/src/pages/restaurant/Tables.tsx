import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { useAppStore, toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { mockHotels } from '@/data/mockHotels';
import { orderTotal, setTableStatus, tableState } from '@/services/mockRestaurantService';
import type { RestaurantTable } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { NewOrderDialog } from './NewOrderDialog';
import { OrderDrawer } from './OrderDrawer';
import { RestaurantShell } from './RestaurantShell';
import { Badge } from '@/components/ui/Badge';
import { FINANCIAL_ROLES } from '@/routes/nav';

type State = ReturnType<typeof tableState>;
const STYLE: Record<State, string> = { free: 'border-success/50 bg-success/10', occupied: 'border-champagne bg-champagne/25', reserved: 'border-info/50 bg-info/10', cleaning: 'border-warning/60 bg-warning/15' };
const LABEL: Record<State, string> = { free: 'Free', occupied: 'Occupied', reserved: 'Reserved', cleaning: 'Being cleaned' };

export default function Tables() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const tables = useHotelStore((s) => s.tables);
  const orders = useHotelStore((s) => s.orders);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seat, setSeat] = useState<string | undefined>();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => mockHotels.filter((h) => hotelId === 'all' || h.id === hotelId).map((h) => ({ hotel: h, tables: tables.filter((t) => t.hotelId === h.id) })), [hotelId, tables]);
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const open = selected ? orders.find((o) => o.tableId === selected.id && o.type === 'dine_in' && o.status !== 'cancelled' && o.payment === 'open') : undefined;

  const set = async (t: RestaurantTable, status: RestaurantTable['status'], msg: string) => {
    setBusy(true);
    const r = await setTableStatus(t.id, status);
    setBusy(false);
    if (r.ok) toast.success(msg, `Table ${t.number}`); else toast.error('Could not update table', r.error);
  };

  return (
    <RestaurantShell title="Tables" description="Live floor status. Select a table to seat guests or update it.">
      <Card className="mb-4 p-4"><ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">{(Object.keys(STYLE) as State[]).map((s) => <li key={s} className="flex items-center gap-2 text-meta"><span className={cn('h-4 w-4 rounded border', STYLE[s])} aria-hidden />{LABEL[s]}</li>)}</ul></Card>
      <div className="space-y-6">
        {groups.map(({ hotel, tables: ts }) => (
          <Card key={hotel.id}>
            <div className="border-b border-line px-5 py-4"><h2 className="text-card font-semibold">{hotel.name}</h2></div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {ts.map((t) => {
                const st = tableState(t, orders);
                const o = orders.find((x) => x.tableId === t.id && x.type === 'dine_in' && x.status !== 'cancelled' && x.payment === 'open');
                return (
                  <button key={t.id} type="button" onClick={() => setSelectedId(t.id)} aria-label={`Table ${t.number}, ${LABEL[st]}, seats ${t.seats}`} className={cn('rounded-lg border p-3 text-left transition-shadow hover:shadow-card', STYLE[st])}>
                    <span className="flex items-baseline justify-between"><span className="font-heading text-section font-semibold">{t.number}</span><span className="text-meta text-slate">{t.seats} seats</span></span>
                    <span className="block text-meta text-slate">{t.area}</span>
                    <span className="mt-2 block text-meta font-medium">{o ? `${o.guestName}${canViewFinancials ? ` · ${formatCurrency(orderTotal(o))}` : ''}` : LABEL[st]}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selected) && !seat && !orderId} onClose={() => setSelectedId(null)} variant="drawer" title={selected ? `Table ${selected.number}` : ''} description={selected ? `${selected.area} · seats ${selected.seats}` : undefined}>
        {selected && (() => {
          const st = tableState(selected, orders);
          return (
            <div className="space-y-4">
              <Badge tone={st === 'free' ? 'success' : st === 'occupied' ? 'champagne' : st === 'reserved' ? 'info' : 'warning'}>{LABEL[st]}</Badge>
              {st === 'occupied' && open && <div className="space-y-3"><p className="text-body">{open.guestName}{canViewFinancials ? ` · ${formatCurrency(orderTotal(open))}` : ''}</p><Button onClick={() => setOrderId(open.id)}>View order</Button></div>}
              {(st === 'free' || st === 'reserved') && <div className="flex flex-wrap gap-2"><Button onClick={() => setSeat(selected.id)}>Seat guests and take order</Button>{st === 'free' ? <Button variant="secondary" loading={busy} onClick={() => set(selected, 'reserved', 'Marked reserved')}>Mark reserved</Button> : <Button variant="secondary" loading={busy} onClick={() => set(selected, 'free', 'Reservation released')}>Release reservation</Button>}</div>}
              {st === 'cleaning' && <Button loading={busy} onClick={() => set(selected, 'free', 'Table ready')}>Mark clean — table ready</Button>}
              {st === 'free' && <Button variant="ghost" loading={busy} onClick={() => set(selected, 'cleaning', 'Marked for cleaning')}>Mark for cleaning</Button>}
            </div>
          );
        })()}
      </Dialog>
      <NewOrderDialog open={Boolean(seat)} type="dine_in" presetTableId={seat} onClose={() => setSeat(undefined)} onCreated={() => setSelectedId(null)} />
      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </RestaurantShell>
  );
}
