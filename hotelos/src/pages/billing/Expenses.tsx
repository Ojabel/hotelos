import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { hotelShortName, mockHotels } from '@/data/mockHotels';
import { addExpense } from '@/services/mockExpenseService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { Expense, PaymentMethod } from '@/types';
import { today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { PAYMENT_METHOD_LABEL } from '@/utils/status';
import { backendMode, useBackendHotels } from '@/services/api/backendMode';
import { hotelOperationsApi } from '@/services/api/hotelOperations';

const CATEGORIES = ['Utilities', 'Supplies', 'Food & Beverage', 'Maintenance', 'Marketing', 'Security', 'Insurance', 'IT & Software', 'Laundry', 'Staff Welfare', 'Other'];

export default function Expenses() {
  const hotelId = useAppStore((s) => s.hotelId);
  const all = useHotelStore((s) => s.expenses);
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { if (backendMode && hotelId !== 'all') void hotelOperationsApi.listExpenses(hotelId, { category: category === 'all' ? undefined : category, from: from || undefined, to: to || undefined }).then((rows) => useHotelStore.getState().setExpenses(() => rows.map((e) => ({ id: e.id, hotelId: e.hotelId, date: e.expenseDate.slice(0, 10), category: e.category.name, vendor: e.vendor, description: e.description, amount: e.amountMinor / 100, method: ({ CASH: 'cash', BANK_TRANSFER: 'bank_transfer', CARD: 'pos', OTHER: 'online' })[e.method] as PaymentMethod, status: e.status.toLowerCase() as Expense['status'] })))); }, [hotelId, category, from, to]);
  const scoped = useMemo(() => all.filter((e) => hotelId === 'all' || e.hotelId === hotelId), [all, hotelId]);
  const filtered = useMemo(() => backendMode ? scoped : scoped.filter((e) => category === 'all' || e.category === category), [scoped, category]);
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const pending = filtered.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  const cols: Column<Expense>[] = [
    { key: 'date', header: 'Date', sortValue: (e) => e.date, render: (e) => formatDate(e.date, false) },
    { key: 'cat', header: 'Category', sortValue: (e) => e.category, render: (e) => e.category },
    { key: 'vendor', header: 'Vendor', sortValue: (e) => e.vendor, render: (e) => <div><p className="font-medium">{e.vendor}</p><p className="text-meta text-slate">{e.description}</p></div> },
    ...(hotelId === 'all' ? [{ key: 'hotel', header: 'Property', render: (e: Expense) => hotelShortName(e.hotelId) } as Column<Expense>] : []),
    { key: 'method', header: 'Method', render: (e) => PAYMENT_METHOD_LABEL[e.method] },
    { key: 'amount', header: 'Amount', align: 'right', sortValue: (e) => e.amount, render: (e) => formatCurrency(e.amount) },
    { key: 'status', header: 'Status', render: (e) => <Badge tone={e.status === 'paid' ? 'success' : 'warning'}>{e.status === 'paid' ? 'Paid' : 'Awaiting payment'}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Expenses" description="Operating costs for the selected property" actions={<Button onClick={() => setOpen(true)}>Add expense</Button>} />
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total in view" value={formatCurrency(total)} />
        <StatCard label="Awaiting payment" value={formatCurrency(pending)} />
        <StatCard label="Records" value={String(filtered.length)} />
      </section>
      <Card className="mt-4 sm:mt-6">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3"><Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} /><Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <DataTable caption="Expenses" rows={filtered} columns={cols} rowKey={(e) => e.id} pageSize={10} initialSort={{ key: 'date', dir: 'desc' }} empty={<EmptyState icon={Wallet} title="No expenses" />}
          mobileCard={(e) => (<div className="p-4"><div className="flex justify-between gap-2"><p className="font-medium">{e.vendor}</p><p className="font-medium tnum">{formatCurrency(e.amount)}</p></div><p className="text-meta text-slate">{e.category} · {e.description} · {formatDate(e.date, false)}</p></div>)} />
      </Card>
      <ExpenseDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ExpenseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const defaultHotel = useAppStore((s) => s.hotelId);
  const backendHotels = useBackendHotels();
  const [f, setF] = useState({ hotelId: defaultHotel === 'all' ? 'h-vi' : defaultHotel, category: 'Utilities', vendor: '', description: '', amount: '', method: 'bank_transfer' as PaymentMethod, date: today(), status: 'paid' as Expense['status'] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await addExpense({ ...f, amount: Number(f.amount) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Expense recorded', r.value.vendor);
    setError(''); setF({ ...f, vendor: '', description: '', amount: '' });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add expense" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="exp-form" loading={busy}>Save expense</Button></>}>
      <form id="exp-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Property" value={f.hotelId} onChange={set('hotelId')} disabled={backendMode} options={backendMode ? backendHotels.map((h) => ({ value: h.id, label: h.name })) : mockHotels.map((h) => ({ value: h.id, label: h.name }))} />
          <Select label="Category" value={f.category} onChange={set('category')} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <Input label="Vendor" value={f.vendor} onChange={set('vendor')} />
          <Input label="Amount" type="number" min={0} value={f.amount} onChange={set('amount')} />
          <Input label="Date" type="date" max={today()} value={f.date} onChange={set('date')} />
          <Select label="Method" value={f.method} onChange={set('method')} options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
        </div>
        <Input label="Description" value={f.description} onChange={set('description')} />
        <Select label="Status" value={f.status} onChange={set('status')} options={[{ value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Awaiting payment' }]} />
      </form>
    </Dialog>
  );
}
