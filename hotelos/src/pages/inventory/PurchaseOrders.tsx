import { useMemo, useState, type FormEvent } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Detail } from '@/components/ui/Detail';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { hotelShortName, mockHotels } from '@/data/mockHotels';
import { cancelPurchaseOrder, createPurchaseOrder, receivePurchaseOrder, sendPurchaseOrder } from '@/services/mockInventoryService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { PurchaseOrder, PurchaseStatus, Tone } from '@/types';
import { addDays, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { poOutstanding, poTotal } from '@/utils/stock';
import { InventoryShell } from './InventoryShell';
import { FINANCIAL_ROLES } from '@/routes/nav';

const STATUS: Record<PurchaseStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' }, ordered: { label: 'Ordered', tone: 'info' }, partially_received: { label: 'Partly received', tone: 'warning' }, received: { label: 'Received', tone: 'success' }, cancelled: { label: 'Cancelled', tone: 'danger' },
};
const PoBadge = ({ status }: { status: PurchaseStatus }) => <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;

export default function PurchaseOrders() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const all = useHotelStore((s) => s.purchaseOrders);
  const suppliers = useHotelStore((s) => s.suppliers);
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => all.filter((p) => (hotelId === 'all' || p.hotelId === hotelId) && (status === 'all' || p.status === status)), [all, hotelId, status]);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  const selected = all.find((p) => p.id === openId) ?? null;

  const cols: Column<PurchaseOrder>[] = [
    { key: 'ref', header: 'Order', sortValue: (p) => p.reference, render: (p) => <span className="font-medium">{p.reference}</span> },
    { key: 'sup', header: 'Supplier', sortValue: (p) => supplierName(p.supplierId), render: (p) => supplierName(p.supplierId) },
    ...(hotelId === 'all' ? [{ key: 'h', header: 'Property', render: (p: PurchaseOrder) => hotelShortName(p.hotelId) } as Column<PurchaseOrder>] : []),
    { key: 'date', header: 'Raised', sortValue: (p) => p.createdAt + p.id, render: (p) => formatDate(p.createdAt, false) },
    { key: 'exp', header: 'Expected', sortValue: (p) => p.expectedDate, render: (p) => formatDate(p.expectedDate, false) },
    { key: 'lines', header: 'Lines', align: 'right', render: (p) => p.lines.length },
    ...(canViewFinancials ? [{ key: 'total', header: 'Total', align: 'right' as const, sortValue: poTotal, render: (p: PurchaseOrder) => formatCurrency(poTotal(p)) }] : []),
    { key: 'status', header: 'Status', render: (p) => <PoBadge status={p.status} /> },
  ];

  return (
      <InventoryShell title="Purchase orders" description="Raise, send and receive supplier orders" actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New purchase order</Button>}>
      <Card>
        <div className="max-w-xs border-b border-line p-4"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...(Object.keys(STATUS) as PurchaseStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))]} /></div>
        <DataTable caption="Purchase orders" rows={rows} columns={cols} rowKey={(p) => p.id} pageSize={10} initialSort={{ key: 'date', dir: 'desc' }} onRowClick={(p) => setOpenId(p.id)} empty={<EmptyState icon={ShoppingCart} title="No purchase orders" />}
          mobileCard={(p) => (<button type="button" onClick={() => setOpenId(p.id)} className="block w-full p-4 text-left"><div className="flex items-center justify-between gap-2"><p className="font-medium">{p.reference}</p><PoBadge status={p.status} /></div><p className="text-meta text-slate">{supplierName(p.supplierId)}{canViewFinancials ? ` · ${formatCurrency(poTotal(p))}` : ''} · due {formatDate(p.expectedDate, false)}</p></button>)} />
      </Card>
      {selected && <PoDrawer key={selected.id} po={selected} onClose={() => setOpenId(null)} />}
      {creating && <NewPoDialog onClose={() => setCreating(false)} onCreated={(id) => setOpenId(id)} />}
    </InventoryShell>
  );
}

function PoDrawer({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const suppliers = useHotelStore((s) => s.suppliers);
  const items = useHotelStore((s) => s.inventory);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supplier = suppliers.find((s) => s.id === po.supplierId);

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError('');
    toast.success(msg, po.reference);
  };

  const receive = () => run(async () => {
    const parsed = Object.fromEntries(Object.entries(receipts).map(([k, v]) => [k, Number(v) || 0]));
    const r = await receivePurchaseOrder(po.id, parsed);
    if (r.ok) { setReceiving(false); setReceipts({}); }
    return r;
  }, 'Delivery recorded');

  return (
    <>
      <Dialog open={!cancelling} onClose={onClose} variant="drawer" title={po.reference} description={`${supplier?.name} · ${hotelShortName(po.hotelId)}`}>
        <div className="space-y-5">
          <div className="flex items-center gap-2"><PoBadge status={po.status} /></div>
          {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
          <dl className="grid grid-cols-2 gap-4"><Detail label="Raised">{formatDate(po.createdAt, false)}</Detail><Detail label="Expected">{formatDate(po.expectedDate, false)}</Detail>{canViewFinancials && <Detail label="Total"><span className="tnum">{formatCurrency(poTotal(po))}</span></Detail>}<Detail label="Outstanding units">{poOutstanding(po)}</Detail></dl>
          {po.notes && <p className="rounded bg-ivory px-3 py-2 text-body text-slate">{po.notes}</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-body"><caption className="sr-only">Order lines</caption>
            <thead className="text-meta uppercase tracking-wide text-slate"><tr><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Ordered</th><th className="py-2 text-right font-medium">Received</th>{canViewFinancials && <th className="py-2 text-right font-medium">Line total</th>}{receiving && <th className="py-2 text-right font-medium">Receive now</th>}</tr></thead>
            <tbody className="divide-y divide-line">{po.lines.map((l) => {
              const it = items.find((i) => i.id === l.itemId);
              const left = l.qty - l.received;
              return (<tr key={l.itemId}><td className="py-2 pr-2">{it?.name}</td><td className="py-2 text-right tnum">{l.qty}</td><td className="py-2 text-right tnum">{l.received}</td>{canViewFinancials && <td className="py-2 text-right tnum">{formatCurrency(l.qty * l.unitCost)}</td>}
                {receiving && <td className="py-2 pl-2"><input aria-label={`Quantity received for ${it?.name}`} type="number" min={0} max={left} disabled={left === 0} value={receipts[l.itemId] ?? ''} onChange={(e) => setReceipts({ ...receipts, [l.itemId]: e.target.value })} placeholder={String(left)} className="h-9 w-24 rounded border border-line px-2 text-right text-body tnum focus:border-champagne" /></td>}</tr>);
            })}</tbody></table></div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {po.status === 'draft' && <Button loading={busy} onClick={() => run(() => sendPurchaseOrder(po.id), 'Order sent to supplier (simulated)')}>Send to supplier</Button>}
            {(po.status === 'ordered' || po.status === 'partially_received') && !receiving && <Button onClick={() => setReceiving(true)}>Receive delivery</Button>}
            {receiving && <><Button loading={busy} onClick={receive}>Confirm delivery</Button><Button variant="secondary" onClick={() => { setReceiving(false); setError(''); }}>Back</Button></>}
            {(po.status === 'draft' || po.status === 'ordered') && !receiving && <Button variant="ghost" onClick={() => setCancelling(true)}>Cancel order</Button>}
          </div>
        </div>
      </Dialog>
      <ConfirmDialog open={cancelling} title="Cancel this order?" confirmLabel="Cancel order" danger loading={busy} onConfirm={async () => { setBusy(true); const r = await cancelPurchaseOrder(po.id); setBusy(false); setCancelling(false); if (r.ok) toast.info('Order cancelled', po.reference); else setError(r.error); }} onClose={() => setCancelling(false)}>{po.reference} will be marked cancelled. This cannot be undone.</ConfirmDialog>
    </>
  );
}

function NewPoDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const globalHotel = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const suppliers = useHotelStore((s) => s.suppliers.filter((x) => x.status === 'active'));
  const inventory = useHotelStore((s) => s.inventory);
  const [hotel, setHotel] = useState(globalHotel === 'all' ? 'h-vi' : globalHotel);
  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState(addDays(today(), 3));
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const supplier = supplierId || suppliers[0]?.id || '';
  const options = inventory.filter((i) => i.hotelId === hotel && i.supplierId === supplier);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await createPurchaseOrder({ hotelId: hotel, supplierId: supplier, expectedDate: expected, notes, lines: options.map((i) => ({ itemId: i.id, qty: Number(qty[i.id]) || 0 })) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Draft purchase order created', r.value.reference);
    onCreated(r.value.id);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="lg" title="New purchase order" description="Pick a supplier, then the quantities to order." footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="po-form" loading={busy}>Create draft</Button></>}>
      <form id="po-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Property" value={hotel} onChange={(e) => { setHotel(e.target.value); setQty({}); }} options={mockHotels.map((h) => ({ value: h.id, label: h.name }))} />
          <Select label="Supplier" value={supplier} onChange={(e) => { setSupplierId(e.target.value); setQty({}); }} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <Input label="Expected delivery" type="date" min={today()} value={expected} onChange={(e) => setExpected(e.target.value)} />
        </div>
        {options.length === 0 ? <p className="rounded bg-ivory px-3 py-2 text-body text-slate">This supplier has no items at this property yet. Add items in Stock first.</p> : (
          <ul className="divide-y divide-line rounded border border-line">{options.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><div><p className="text-body font-medium">{i.name}</p><p className="text-meta text-slate">{i.stock} {i.unit} in stock{canViewFinancials ? ` · ${formatCurrency(i.unitCost)} each` : ''} · reorder qty {i.reorderQty}</p></div>
              <input aria-label={`Quantity of ${i.name}`} type="number" min={0} value={qty[i.id] ?? ''} placeholder="0" onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} className="h-9 w-24 rounded border border-line px-2 text-right text-body tnum focus:border-champagne" /></li>))}
          </ul>
        )}
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Dialog>
  );
}
