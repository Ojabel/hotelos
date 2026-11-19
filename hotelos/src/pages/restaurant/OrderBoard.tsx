import { useMemo, useState } from 'react';
import { ChevronRight, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderStatusBadge } from '@/components/ui/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { advanceOrder, orderTotal } from '@/services/mockRestaurantService';
import type { OrderStatus, RestaurantOrder } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { OrderDrawer } from './OrderDrawer';

const COLUMNS: Array<{ status: OrderStatus; title: string; action?: string }> = [
  { status: 'new', title: 'New', action: 'Start' }, { status: 'preparing', title: 'Preparing', action: 'Ready' }, { status: 'ready', title: 'Ready', action: 'Serve' }, { status: 'served', title: 'Served — awaiting settlement' },
];

export const summarise = (o: RestaurantOrder) => o.lines.map((l) => `${l.name} ×${l.qty}`).join(', ');

/** Kitchen board for open orders plus history of settled and cancelled ones. */
export function OrderBoard({ type }: { type?: RestaurantOrder['type'] }) {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const orders = useHotelStore((s) => s.orders);
  const tables = useHotelStore((s) => s.tables);
  const rooms = useHotelStore((s) => s.rooms);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const scoped = useMemo(() => orders.filter((o) => (hotelId === 'all' || o.hotelId === hotelId) && (!type || o.type === type)), [orders, hotelId, type]);
  const where = (o: RestaurantOrder) => (o.type === 'dine_in' ? `Table ${tables.find((t) => t.id === o.tableId)?.number}` : `Room ${rooms.find((r) => r.id === o.roomId)?.number}`);
  const board = scoped.filter((o) => o.status !== 'cancelled' && !(o.status === 'served' && o.payment !== 'open'));
  const history = scoped.filter((o) => o.status === 'cancelled' || (o.status === 'served' && o.payment !== 'open'));

  const advance = async (o: RestaurantOrder) => {
    setBusy(o.id);
    const r = await advanceOrder(o.id);
    setBusy(null);
    if (!r.ok) toast.error('Could not update order', r.error);
  };

  const cols: Column<RestaurantOrder>[] = [
    { key: 'ref', header: 'Order', sortValue: (o) => o.reference, render: (o) => <span className="font-medium">{o.reference}</span> },
    { key: 'where', header: 'Where', render: where },
    { key: 'guest', header: 'Guest', render: (o) => o.guestName },
    { key: 'items', header: 'Items', render: (o) => <span className="line-clamp-1 max-w-xs text-slate">{summarise(o)}</span> },
    ...(canViewFinancials ? [
      { key: 'total', header: 'Total', align: 'right' as const, sortValue: orderTotal, render: (o: RestaurantOrder) => formatCurrency(orderTotal(o)) },
      { key: 'outcome', header: 'Outcome', render: (o: RestaurantOrder) => (o.status === 'cancelled' ? <OrderStatusBadge status="cancelled" /> : <Badge tone={o.payment === 'paid' ? 'success' : 'info'}>{o.payment === 'paid' ? 'Paid' : 'Charged to room'}</Badge>) },
    ] : []),
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = board.filter((o) => o.status === col.status);
          return (
            <section key={col.status} aria-label={col.title} className="rounded-lg border border-line bg-white">
              <h2 className="flex items-center justify-between border-b border-line px-4 py-3 text-card font-semibold">{col.title}<span className="rounded-full bg-ivory px-2 py-0.5 text-meta tnum">{list.length}</span></h2>
              <ul className="space-y-2 p-3">
                {list.length === 0 && <li className="px-1 py-4 text-center text-meta text-slate">Nothing here</li>}
                {list.map((o) => (
                  <li key={o.id} className={cn('rounded border border-line p-3', o.status === 'ready' && 'border-success/50 bg-success/5')}>
                    <button type="button" onClick={() => setOpen(o.id)} className="block w-full text-left">
                      <span className="flex items-center justify-between gap-2"><span className="text-body font-semibold">{where(o)}</span><span className="text-meta text-slate">{o.time}</span></span>
                      <span className="block text-meta text-slate">{o.reference} · {o.guestName}</span>
                      <span className="mt-1 line-clamp-2 block text-body">{summarise(o)}</span>
                      {canViewFinancials && <span className="mt-1 block text-meta font-medium tnum">{formatCurrency(orderTotal(o))}</span>}
                    </button>
                    {col.action && <Button size="sm" className="mt-2 w-full" variant="secondary" loading={busy === o.id} onClick={() => advance(o)}>{col.action}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></Button>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <Card className="mt-4 sm:mt-6">
        <div className="border-b border-line px-5 py-4"><h2 className="text-card font-semibold">History</h2></div>
        <DataTable caption="Settled and cancelled orders" rows={history} columns={cols} rowKey={(o) => o.id} pageSize={8} initialSort={{ key: 'ref', dir: 'desc' }} onRowClick={(o) => setOpen(o.id)} empty={<EmptyState icon={UtensilsCrossed} title="No completed orders yet" />} />
      </Card>
      <OrderDrawer orderId={open} onClose={() => setOpen(null)} />
    </>
  );
}
