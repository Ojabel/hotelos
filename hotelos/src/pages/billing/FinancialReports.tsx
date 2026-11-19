import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { useScopedData } from '@/hooks/useScopedData';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { chartColors } from '@/styles/chartColors';
import type { ChargeCategory, PaymentMethod } from '@/types';
import { addDays, nightsBetween, today } from '@/utils/demoClock';
import { CHARGE_LABELS, computeFolio } from '@/utils/folio';
import { formatCurrency } from '@/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import { backendMode } from '@/services/api/backendMode';

const PRESETS = [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'mtd', label: 'Month to date' }, { value: 'custom', label: 'Custom range' }];

export default function FinancialReports() {
  const t = today();
  const { hotelId, reservations, payments, charges, refunds } = useScopedData();
  const expenses = useHotelStore((s) => s.expenses);
  const [preset, setPreset] = useState('30');
  const [cs, setCs] = useState(addDays(t, -29));
  const [ce, setCe] = useState(t);

  const error = preset === 'custom' && (ce < cs ? 'End date must be on or after the start date.' : nightsBetween(cs, ce) > 366 ? 'Choose a range of one year or less.' : '');
  const [start, end] = preset === 'custom' ? (error ? [addDays(t, -29), t] : [cs, ce]) : preset === 'mtd' ? [t.slice(0, 8) + '01', t] : [addDays(t, -(Number(preset) - 1)), t];

  const data = useMemo(() => {
    const inRange = (d: string) => d >= start && d <= end;
    const revenue: Record<ChargeCategory, number> = { room: 0, restaurant: 0, laundry: 0, room_service: 0, other: 0 };
    for (const r of reservations) {
      if (r.status !== 'checked_in' && r.status !== 'checked_out') continue;
      if (backendMode && !charges.some((charge) => charge.reservationId === r.id)) continue;
      for (const l of computeFolio(r, charges, payments, refunds).lines) if (l.kind === 'charge' && inRange(l.date) && l.date <= t) revenue[l.category!] += l.debit;
    }
    const collected = payments.filter((p) => (p.status === 'paid' || p.status === 'refunded') && inRange(p.date));
    const byMethod = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ m, amount: collected.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) }));
    const refunded = refunds.filter((r) => r.status === 'processed' && inRange(r.requestedAt)).reduce((s, r) => s + r.amount, 0);
    const spend = expenses.filter((e) => (hotelId === 'all' || e.hotelId === hotelId) && inRange(e.date));
    const byCategory = [...spend.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    const totalRevenue = Object.values(revenue).reduce((s, v) => s + v, 0);
    const totalCollected = collected.reduce((s, p) => s + p.amount, 0) - refunded;
    const totalExpenses = spend.reduce((s, e) => s + e.amount, 0);
    return { revenue, byMethod, byCategory, totalRevenue, totalCollected, totalExpenses, refunded };
  }, [start, end, reservations, payments, charges, refunds, expenses, hotelId, t]);

  const revenueRows = (Object.keys(data.revenue) as ChargeCategory[]).map((c) => ({ name: CHARGE_LABELS[c], amount: data.revenue[c] }));

  const exportCsv = () => {
    const lines = [['Section', 'Item', 'Amount'], ...revenueRows.map((r) => ['Revenue', r.name, r.amount]), ...data.byMethod.map((m) => ['Collections', PAYMENT_METHOD_LABEL[m.m], m.amount]), ...data.byCategory.map((c) => ['Expenses', c.category, c.amount])];
    const blob = new Blob([lines.map((l) => l.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hotelos-financial-report-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Report exported', 'CSV downloaded (demo data)');
  };

  return (
    <>
      <PageHeader title="Financial reports" description={`${start} to ${end}`}
        actions={<><div className="w-44"><Select label="Period" hideLabel value={preset} onChange={(e) => setPreset(e.target.value)} options={PRESETS} /></div><Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden />Export CSV</Button></>} />
      {preset === 'custom' && <div className="mb-5 flex flex-wrap items-start gap-3"><div className="w-44"><Input label="From" type="date" value={cs} onChange={(e) => setCs(e.target.value)} /></div><div className="w-44"><Input label="To" type="date" value={ce} onChange={(e) => setCe(e.target.value)} error={error || undefined} /></div></div>}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Revenue posted" value={formatCurrency(data.totalRevenue)} hint="Room and services" />
        <StatCard label="Net collections" value={formatCurrency(data.totalCollected)} hint={`After ${formatCurrency(data.refunded)} refunds`} />
        <StatCard label="Expenses" value={formatCurrency(data.totalExpenses)} />
        <StatCard label="Collections less expenses" value={formatCurrency(data.totalCollected - data.totalExpenses)} />
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Revenue by department" />
          <div className="h-64 p-4" role="img" aria-label="Revenue by department">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={revenueRows} margin={{ left: 0, right: 8, top: 8 }}><CartesianGrid vertical={false} stroke={chartColors.line} /><XAxis dataKey="name" tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} /><YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={48} tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} axisLine={false} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Bar dataKey="amount" name="Revenue" fill={chartColors.forest} radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Collections vs. expenses by method" />
          <ul className="divide-y divide-line">{data.byMethod.map((m) => <li key={m.m} className="flex justify-between px-5 py-3 text-body"><span className="text-slate">{PAYMENT_METHOD_LABEL[m.m]}</span><span className="font-medium tnum">{formatCurrency(m.amount)}</span></li>)}</ul>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Expenses by category" />
          {data.byCategory.length === 0 ? <p className="px-5 py-6 text-body text-slate">No expenses in this period.</p> : (
            <div className="h-64 p-4" role="img" aria-label="Expenses by category"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byCategory} margin={{ left: 0, right: 8, top: 8 }}><CartesianGrid vertical={false} stroke={chartColors.line} /><XAxis dataKey="category" tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} interval={0} angle={-20} height={60} textAnchor="end" /><YAxis tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} width={44} tick={{ fill: chartColors.slate, fontSize: 12 }} tickLine={false} axisLine={false} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Legend /><Bar dataKey="amount" name="Expenses" fill={chartColors.champagne} radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div>
          )}
        </Card>
      </div>
    </>
  );
}
