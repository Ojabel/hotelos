import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { orderTotal, tableState } from '@/services/mockRestaurantService';
import { useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { chartColors } from '@/styles/chartColors';
import { today } from '@/utils/demoClock';
import { formatCurrency } from '@/utils/format';
import { RestaurantShell } from './RestaurantShell';
import { summarise } from './OrderBoard';
import { FINANCIAL_ROLES } from '@/routes/nav';

export default function RestaurantOverview() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const allOrders = useHotelStore((s) => s.orders);
  const allTables = useHotelStore((s) => s.tables);
  const menu = useHotelStore((s) => s.menu);

  const orders = useMemo(() => allOrders.filter((o) => (hotelId === 'all' || o.hotelId === hotelId) && o.createdAt === today() && o.status !== 'cancelled'), [allOrders, hotelId]);
  const tables = allTables.filter((t) => hotelId === 'all' || t.hotelId === hotelId);
  const occupied = tables.filter((t) => tableState(t, allOrders) === 'occupied').length;
  const settled = orders.filter((o) => o.payment !== 'open');
  const revenue = settled.reduce((s, o) => s + orderTotal(o), 0);
  const unsettled = orders.filter((o) => o.payment === 'open').reduce((s, o) => s + orderTotal(o), 0);
  const kitchen = orders.filter((o) => ['new', 'preparing', 'ready'].includes(o.status));

  const top = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) for (const l of o.lines) m.set(l.name, (m.get(l.name) ?? 0) + l.qty);
    return [...m].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [orders]);

  return (
    <RestaurantShell title="Restaurant" description="Today’s service" actions={<Link to="/restaurant/orders"><Button>Open kitchen board</Button></Link>}>
      <section className={`grid grid-cols-2 gap-3 sm:gap-4 ${canViewFinancials ? 'xl:grid-cols-4' : 'xl:grid-cols-2'}`}>
        <StatCard label="Orders in the kitchen" value={String(kitchen.length)} hint={`${orders.length} orders today`} />
        <StatCard label="Tables occupied" value={`${occupied} / ${tables.length}`} />
        {canViewFinancials && <><StatCard label="Settled revenue today" value={formatCurrency(revenue)} hint={`${formatCurrency(unsettled)} awaiting settlement`} /><StatCard label="Average order" value={formatCurrency(orders.length ? Math.round(orders.reduce((s, o) => s + orderTotal(o), 0) / orders.length) : 0)} hint={`${menu.filter((m) => !m.available).length} items unavailable`} /></>}
      </section>
      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Most ordered today" />
          <div className="h-64 p-4" role="img" aria-label="Most ordered items today">
            {top.length === 0 ? <p className="text-body text-slate">No orders yet today.</p> : (
              <ResponsiveContainer width="100%" height="100%"><BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid horizontal={false} stroke={chartColors.line} /><XAxis type="number" allowDecimals={false} tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} /><YAxis type="category" dataKey="name" width={150} tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} axisLine={false} /><Tooltip formatter={(v) => [String(v), 'Portions']} cursor={{ fill: 'rgba(196,165,116,0.12)' }} /><Bar dataKey="qty" fill={chartColors.forest} radius={[0, 2, 2, 0]} /></BarChart></ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Right now" />
          {kitchen.length === 0 ? <p className="px-5 py-6 text-body text-slate">The kitchen is clear.</p> : (
            <ul className="divide-y divide-line">{kitchen.slice(0, 6).map((o) => <li key={o.id} className="px-5 py-3"><div className="flex items-center justify-between gap-2"><span className="text-body font-medium">{o.reference}</span><OrderStatusBadge status={o.status} /></div><p className="mt-0.5 line-clamp-1 text-meta text-slate">{summarise(o)}</p><Badge tone={o.type === 'dine_in' ? 'neutral' : 'champagne'} className="mt-1">{o.type === 'dine_in' ? 'Dine-in' : 'Room service'}</Badge></li>)}</ul>
          )}
        </Card>
      </div>
    </RestaurantShell>
  );
}
