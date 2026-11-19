import { useMemo, useState, type FormEvent } from 'react';
import { Trash2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { DocumentDialog } from '@/components/billing/Documents';
import { addAdjustment, advancePayroll, removeAdjustment } from '@/services/mockWorkforceService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { PayrollRun, StaffMember } from '@/types';
import { computePayslip, isPayable, type Payslip } from '@/utils/payroll';
import { formatCurrency } from '@/utils/format';
import { StaffShell } from './StaffShell';

const TONE = { draft: 'warning', approved: 'info', paid: 'success' } as const;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function Payroll() {
  const hotelId = useAppStore((s) => s.hotelId);
  const runs = useHotelStore((s) => s.payrollRuns);
  const staff = useHotelStore((s) => s.staff);
  const attendance = useHotelStore((s) => s.attendance);
  const leave = useHotelStore((s) => s.leave);
  const adjustments = useHotelStore((s) => s.adjustments);
  const [month, setMonth] = useState(runs[runs.length - 1].month);
  const [slip, setSlip] = useState<{ staff: StaffMember; payslip: Payslip } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = runs.find((r) => r.month === month) as PayrollRun;
  const people = useMemo(() => staff.filter((p) => isPayable(p, month) && (hotelId === 'all' || p.hotelId === hotelId)), [staff, month, hotelId]);
  const lines = useMemo(() => people.map((p) => ({ staff: p, payslip: computePayslip(p, month, attendance, leave, adjustments) })), [people, month, attendance, leave, adjustments]);
  const sum = (f: (p: Payslip) => number) => lines.reduce((s, l) => s + f(l.payslip), 0);
  const monthAdjustments = adjustments.filter((a) => a.month === month && people.some((p) => p.id === a.staffId));

  const advance = async (to: 'approved' | 'paid') => {
    setBusy(true);
    const r = await advancePayroll(month, to);
    setBusy(false);
    if (r.ok) toast.success(to === 'approved' ? 'Payroll approved' : 'Payroll marked as paid', 'Simulated — no money moved.'); else toast.error('Could not update payroll', r.error);
  };

  const cols: Column<{ staff: StaffMember; payslip: Payslip }>[] = [
    { key: 'name', header: 'Employee', sortValue: (l) => l.staff.name, render: (l) => <div><p className="font-medium">{l.staff.name}</p><p className="text-meta text-slate">{l.staff.title}</p></div> },
    { key: 'basic', header: 'Basic', align: 'right', sortValue: (l) => l.payslip.basic, render: (l) => formatCurrency(l.payslip.basic) },
    { key: 'gross', header: 'Gross', align: 'right', sortValue: (l) => l.payslip.gross, render: (l) => formatCurrency(l.payslip.gross) },
    { key: 'ded', header: 'Deductions', align: 'right', sortValue: (l) => l.payslip.gross - l.payslip.net, render: (l) => formatCurrency(l.payslip.gross - l.payslip.net) },
    { key: 'abs', header: 'Absent days', align: 'right', render: (l) => l.payslip.absenceDays },
    { key: 'net', header: 'Net pay', align: 'right', sortValue: (l) => l.payslip.net, render: (l) => <span className="font-medium">{formatCurrency(l.payslip.net)}</span> },
  ];

  return (
    <StaffShell title="Payroll" description="Illustrative payroll interface — nothing is paid and rates are demo values."
      actions={<div className="w-48"><Select label="Month" hideLabel value={month} onChange={(e) => setMonth(e.target.value)} options={runs.map((r) => ({ value: r.month, label: monthLabel(r.month) }))} /></div>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-3"><p className="text-card font-semibold">{monthLabel(month)}</p><Badge tone={TONE[run.status]}>{run.status === 'draft' ? 'Draft' : run.status === 'approved' ? 'Approved' : 'Paid (simulated)'}</Badge></div>
        <div className="flex gap-2">{run.status === 'draft' && <Button loading={busy} onClick={() => advance('approved')}>Approve payroll</Button>}{run.status === 'approved' && <Button loading={busy} onClick={() => advance('paid')}>Mark as paid</Button>}</div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Employees paid" value={String(lines.length)} />
        <StatCard label="Gross pay" value={formatCurrency(sum((p) => p.gross))} />
        <StatCard label="Deductions" value={formatCurrency(sum((p) => p.gross - p.net))} hint="Pension, PAYE, absence, other" />
        <StatCard label="Net pay" value={formatCurrency(sum((p) => p.net))} />
      </section>

      <Card className="mt-4 sm:mt-6">
        <DataTable caption="Payslips" rows={lines} columns={cols} rowKey={(l) => l.staff.id} pageSize={10} initialSort={{ key: 'name', dir: 'asc' }} onRowClick={(l) => setSlip(l)} empty={<EmptyState icon={Wallet} title="No employees on this payroll" />}
          mobileCard={(l) => (<button type="button" onClick={() => setSlip(l)} className="block w-full p-4 text-left"><div className="flex items-center justify-between gap-2"><p className="font-medium">{l.staff.name}</p><p className="font-medium tnum">{formatCurrency(l.payslip.net)}</p></div><p className="text-meta text-slate">Gross {formatCurrency(l.payslip.gross)} · {l.payslip.absenceDays} absent days</p></button>)} />
      </Card>

      <Card className="mt-4 sm:mt-6">
        <CardHeader title="Adjustments" action={run.status === 'draft' ? <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Add adjustment</Button> : <span className="text-meta text-slate">Locked</span>} />
        {monthAdjustments.length === 0 ? <p className="px-5 py-6 text-body text-slate">No bonuses or deductions this month.</p> : (
          <ul className="divide-y divide-line">{monthAdjustments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="text-body font-medium">{staff.find((p) => p.id === a.staffId)?.name}</p><p className="text-meta text-slate">{a.label}</p></div>
              <div className="flex items-center gap-2"><span className={`font-medium tnum ${a.amount < 0 ? 'text-danger' : 'text-success'}`}>{a.amount > 0 ? '+' : ''}{formatCurrency(a.amount)}</span>
                {run.status === 'draft' && <Button variant="ghost" size="sm" aria-label={`Remove adjustment ${a.label}`} onClick={async () => { const r = await removeAdjustment(a.id); if (!r.ok) toast.error('Could not remove', r.error); }}><Trash2 className="h-4 w-4 text-danger" aria-hidden /></Button>}</div></li>
          ))}</ul>
        )}
      </Card>

      {adding && <AdjustmentDialog month={month} people={people} onClose={() => setAdding(false)} />}
      <DocumentDialog open={Boolean(slip)} title="Payslip preview" onClose={() => setSlip(null)}>{slip && <PayslipDocument month={month} staff={slip.staff} p={slip.payslip} />}</DocumentDialog>
    </StaffShell>
  );
}

function PayslipDocument({ month, staff, p }: { month: string; staff: StaffMember; p: Payslip }) {
  const row = (label: string, v: number, minus = false) => <tr><td className="py-1.5">{label}</td><td className="py-1.5 text-right tnum">{minus ? '−' : ''}{formatCurrency(v)}</td></tr>;
  return (
    <article className="print-area space-y-5 rounded border border-line bg-white p-6 text-body">
      <header className="flex items-start justify-between gap-4 border-b-2 border-forest pb-4"><div><p className="font-heading text-xl font-semibold">HotelOS</p><p className="text-meta text-slate">Demonstration payslip — not a real payment</p></div><div className="text-right"><p className="font-heading text-xl font-semibold uppercase tracking-wide">Payslip</p><p className="text-meta text-slate">{monthLabel(month)}</p></div></header>
      <dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-meta uppercase tracking-wide text-slate">Employee</dt><dd className="font-medium">{staff.name}</dd></div><div><dt className="text-meta uppercase tracking-wide text-slate">Position</dt><dd className="font-medium">{staff.title}</dd></div><div><dt className="text-meta uppercase tracking-wide text-slate">Department</dt><dd className="font-medium">{staff.department}</dd></div></dl>
      <table className="w-full text-left"><thead className="border-b border-line text-meta uppercase tracking-wide text-slate"><tr><th className="py-2 font-medium">Earnings and deductions</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
        <tbody className="divide-y divide-line">{row('Basic salary', p.basic)}{row('Allowance (10% of basic)', p.allowance)}{p.bonuses > 0 && row('Bonuses', p.bonuses)}
          <tr className="font-medium"><td className="py-2">Gross pay</td><td className="py-2 text-right tnum">{formatCurrency(p.gross)}</td></tr>
          {row('Pension (8% of basic)', p.pension, true)}{row('PAYE (illustrative 7%)', p.paye, true)}{p.absenceDeduction > 0 && row(`Absence (${p.absenceDays} day${p.absenceDays === 1 ? '' : 's'})`, p.absenceDeduction, true)}{p.otherDeductions > 0 && row('Other deductions', p.otherDeductions, true)}</tbody>
        <tfoot className="border-t-2 border-forest"><tr><td className="py-2 font-semibold">Net pay</td><td className="py-2 text-right font-semibold tnum">{formatCurrency(p.net)}</td></tr></tfoot></table>
      <p className="text-meta text-slate">Flat demo rates for illustration only; this is not tax or payroll advice.</p>
    </article>
  );
}

function AdjustmentDialog({ month, people, onClose }: { month: string; people: StaffMember[]; onClose: () => void }) {
  const [staffId, setStaffId] = useState(people[0]?.id ?? '');
  const [kind, setKind] = useState<'bonus' | 'deduction'>('bonus');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Math.abs(Number(amount));
    const r = await addAdjustment({ month, staffId, label, amount: kind === 'deduction' ? -n : n });
    if (!r.ok) return setError(r.error);
    toast.success('Adjustment added');
    onClose();
  };
  return (
    <Dialog open onClose={onClose} size="sm" title="Add payroll adjustment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="adj-pay-form">Add</Button></>}>
      <form id="adj-pay-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Select label="Employee" value={staffId} onChange={(e) => setStaffId(e.target.value)} options={people.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as 'bonus' | 'deduction')} options={[{ value: 'bonus', label: 'Bonus / extra pay' }, { value: 'deduction', label: 'Deduction' }]} />
        <Input label="Description" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input label="Amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </form>
    </Dialog>
  );
}
