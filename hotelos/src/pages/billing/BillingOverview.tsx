import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PaymentStatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { useFolioRows } from '@/hooks/useFolioRows';
import { useScopedData } from '@/hooks/useScopedData';
import { useHotelStore } from '@/store/useHotelStore';
import { chartColors } from '@/styles/chartColors';
import { addDays, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import type { PaymentMethod } from '@/types';
import { FolioDrawer } from '@/components/billing/FolioDrawer';
import { useState } from 'react';
import { backendMode } from '@/services/api/backendMode';

export default function BillingOverview() {
  const t = today();
  const { payments, refunds, guestById, hotelId } = useScopedData();
  const expenses = useHotelStore((s) => s.expenses);
  const rows = useFolioRows();
  const [openFolio, setOpenFolio] = useState<string | null>(null);

  const collected = payments.filter((p) => p.status === 'paid' || p.status === 'refunded');
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
  const monthStart = t.slice(0, 8) + '01';
  const todayTotal = sum(collected.filter((p) => p.date === t));
  const monthTotal = sum(collected.filter((p) => p.date >= monthStart && p.date <= t));
  const outstanding = rows.reduce((s, x) => s + Math.max(0, x.folio.balance), 0);
  const pendingRefunds = refunds.filter((r) => r.status === 'pending' || r.status === 'approved');
  const pendingTransfers = backendMode ? [] : payments.filter((p) => p.status === 'pending');
  const monthExpenses = sum(expenses.filter((e) => (hotelId === 'all' || e.hotelId === hotelId) && e.date >= monthStart && e.date <= t));

  const daily = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const date = addDays(t, i - 13);
    return { date, amount: sum(collected.filter((p) => p.date === date)) };
  }), [collected, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const byMethod = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ m, amount: sum(collected.filter((p) => p.method === m && p.date >= monthStart)) }));
  const owing = [...rows].filter((x) => x.folio.balance > 0).sort((a, b) => b.folio.balance - a.folio.balance).slice(0, 6);

  return (
    <>
      <PageHeader title="Billing" description={`Financial overview · ${formatDate(t)}`} actions={<Link to="/billing/payments"><Button>Record payment</Button></Link>} />
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Collected today" value={formatCurrency(todayTotal)} />
        <StatCard label="Collected this month" value={formatCurrency(monthTotal)} />
        <StatCard label="Outstanding on folios" value={formatCurrency(outstanding)} hint={`${rows.filter((x) => x.folio.balance > 0).length} open folios`} />
        <StatCard label="Refunds awaiting action" value={String(pendingRefunds.length)} hint={formatCurrency(sum(pendingRefunds))} />
        {!backendMode && <StatCard label="Transfers pending confirmation" value={String(pendingTransfers.length)} hint={formatCurrency(sum(pendingTransfers))} />}
        <StatCard label="Expenses this month" value={formatCurrency(monthExpenses)} />
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Daily collections" action={<span className="text-meta text-slate">Last 14 days</span>} />
          <div className="h-64 p-4" role="img" aria-label="Daily collections for the last 14 days">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={chartColors.line} />
                <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d, false).slice(0, 6)} minTickGap={20} tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} axisLine={{ stroke: chartColors.line }} />
                <YAxis tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} width={44} tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Collected']} labelFormatter={(l) => formatDate(String(l))} cursor={{ fill: 'rgba(196,165,116,0.12)' }} />
                <Bar dataKey="amount" fill={chartColors.forest} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="This month by method" />
          <ul className="divide-y divide-line">{byMethod.map((x) => <li key={x.m} className="flex justify-between px-5 py-3 text-body"><span className="text-slate">{PAYMENT_METHOD_LABEL[x.m]}</span><span className="font-medium tnum">{formatCurrency(x.amount)}</span></li>)}</ul>
        </Card>
      </div>

      <Card className="mt-4 sm:mt-6">
        <CardHeader title="Largest open balances" action={<Link to="/billing/folios" className="text-meta font-medium text-info hover:underline">All folios</Link>} />
        {owing.length === 0 ? <p className="px-5 py-6 text-body text-slate">No open balances.</p> : (
          <ul className="divide-y divide-line">
            {owing.map(({ r, folio }) => (
              <li key={r.id}><button type="button" onClick={() => setOpenFolio(r.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-ivory/70">
                <span><span className="block text-body font-medium">{guestById.get(r.guestId)?.fullName}</span><span className="text-meta text-slate">{r.reference}</span></span>
                <span className="flex items-center gap-3"><PaymentStatusBadge status={folio.status} /><span className="font-medium tnum">{formatCurrency(folio.balance)}</span></span>
              </button></li>
            ))}
          </ul>
        )}
      </Card>
      <FolioDrawer reservationId={openFolio} onClose={() => setOpenFolio(null)} />
    </>
  );
}
