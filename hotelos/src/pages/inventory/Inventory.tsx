import { useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Search, SlidersHorizontal, Trash2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { hotelShortName } from '@/data/mockHotels';
import { deleteItem, draftFromLowStock } from '@/services/mockInventoryService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { InventoryItem } from '@/types';
import { formatCurrency } from '@/utils/format';
import { onOrderQty, stockLevel, stockValue } from '@/utils/stock';
import { AdjustDialog, ITEM_CATEGORIES, ItemDialog } from './ItemDialogs';
import { InventoryShell } from './InventoryShell';
import { FINANCIAL_ROLES } from '@/routes/nav';

const LEVEL = { ok: { label: 'In stock', tone: 'success' }, low: { label: 'Low stock', tone: 'warning' }, out: { label: 'Out of stock', tone: 'danger' } } as const;

export default function Inventory() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const allItems = useHotelStore((s) => s.inventory);
  const suppliers = useHotelStore((s) => s.suppliers);
  const pos = useHotelStore((s) => s.purchaseOrders);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => allItems.filter((i) => hotelId === 'all' || i.hotelId === hotelId), [allItems, hotelId]);
  const filtered = useMemo(() => items.filter((i) => (category === 'all' || i.category === category) && (level === 'all' || stockLevel(i) === level) && (!q.trim() || `${i.name} ${i.sku}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, q, category, level]);
  const alerts = items.filter((i) => stockLevel(i) !== 'ok').sort((a, b) => a.stock / Math.max(1, a.reorderLevel) - b.stock / Math.max(1, b.reorderLevel));
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  const clear = () => { setQ(''); setCategory('all'); setLevel('all'); };

  const draft = async () => {
    setBusy(true);
    const r = await draftFromLowStock(hotelId);
    setBusy(false);
    if (r.ok) toast.success(`${r.value.length} purchase order${r.value.length === 1 ? '' : 's'} drafted`, 'Review them under Purchase orders.'); else toast.info('No purchase orders drafted', r.error);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const r = await deleteItem(deleting.id);
    setBusy(false);
    if (r.ok) toast.success('Item deleted', deleting.name); else toast.error('Could not delete item', r.error);
    setDeleting(null);
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const actions = (i: InventoryItem) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" aria-label={`Adjust stock of ${i.name}`} onClick={stop(() => setAdjusting(i))}><SlidersHorizontal className="h-4 w-4" aria-hidden /></Button>
      <Button variant="ghost" size="sm" aria-label={`Edit ${i.name}`} onClick={stop(() => setEditing(i))}><Pencil className="h-4 w-4" aria-hidden /></Button>
      <Button variant="ghost" size="sm" aria-label={`Delete ${i.name}`} onClick={stop(() => setDeleting(i))}><Trash2 className="h-4 w-4 text-danger" aria-hidden /></Button>
    </div>
  );

  const cols: Column<InventoryItem>[] = [
    { key: 'name', header: 'Item', sortValue: (i) => i.name, render: (i) => <div><p className="font-medium">{i.name}{hotelId === 'all' && <span className="ml-2 text-meta font-normal text-slate">{hotelShortName(i.hotelId)}</span>}</p><p className="text-meta text-slate">{i.sku}</p></div> },
    { key: 'cat', header: 'Category', sortValue: (i) => i.category, render: (i) => i.category },
    { key: 'stock', header: 'In stock', align: 'right', sortValue: (i) => i.stock / Math.max(1, i.reorderLevel), render: (i) => <span>{i.stock.toLocaleString()} {i.unit}</span> },
    { key: 'level', header: 'Level', render: (i) => <Badge tone={LEVEL[stockLevel(i)].tone}>{LEVEL[stockLevel(i)].label}</Badge> },
    { key: 'reorder', header: 'Reorder at', align: 'right', render: (i) => i.reorderLevel.toLocaleString() },
    { key: 'ordered', header: 'On order', align: 'right', render: (i) => onOrderQty(i.id, pos) || '—' },
    ...(canViewFinancials ? [
      { key: 'cost', header: 'Unit cost', align: 'right' as const, sortValue: (i: InventoryItem) => i.unitCost, render: (i: InventoryItem) => formatCurrency(i.unitCost) },
      { key: 'value', header: 'Value', align: 'right' as const, sortValue: stockValue, render: (i: InventoryItem) => formatCurrency(stockValue(i)) },
    ] : []),
    { key: 'sup', header: 'Supplier', render: (i) => <span className="text-slate">{supplierName(i.supplierId)}</span> },
    { key: 'a', header: '', align: 'right', render: actions },
  ];

  return (
    <InventoryShell title="Inventory" description={canViewFinancials ? 'Stock levels, reorder alerts and valuation' : 'Stock levels and reorder alerts'} actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden />Add item</Button>}>
      <section className={`grid grid-cols-2 gap-3 sm:gap-4 ${canViewFinancials ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <StatCard label="Items tracked" value={String(items.length)} />
        <StatCard label="Need reordering" value={String(alerts.length)} hint={`${alerts.filter((i) => i.stock === 0).length} out of stock`} />
        {canViewFinancials && <StatCard label="Stock value" value={formatCurrency(items.reduce((s, i) => s + stockValue(i), 0))} />}
        <StatCard label="Orders in progress" value={String(pos.filter((p) => (hotelId === 'all' || p.hotelId === hotelId) && ['ordered', 'partially_received'].includes(p.status)).length)} />
      </section>

      <Card className="mt-4 sm:mt-6">
        <CardHeader title="Low-stock alerts" action={<Button size="sm" onClick={draft} loading={busy} disabled={alerts.length === 0}>Draft purchase orders</Button>} />
        {alerts.length === 0 ? <p className="px-5 py-6 text-body text-slate">Everything is above its reorder level.</p> : (
          <ul className="divide-y divide-line">
            {alerts.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3"><AlertTriangle className={`h-4 w-4 ${i.stock === 0 ? 'text-danger' : 'text-warning'}`} aria-hidden /><div><p className="text-body font-medium">{i.name}</p><p className="text-meta text-slate">{i.stock} {i.unit} left · reorder at {i.reorderLevel}{onOrderQty(i.id, pos) > 0 ? ` · ${onOrderQty(i.id, pos)} on order` : ''}</p></div></div>
                <Badge tone={LEVEL[stockLevel(i)].tone}>{LEVEL[stockLevel(i)].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 sm:mt-6">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5"><label htmlFor="inv-q" className="block text-meta font-medium">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="inv-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or SKU" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...ITEM_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
          <Select label="Stock level" value={level} onChange={(e) => setLevel(e.target.value)} options={[{ value: 'all', label: 'All levels' }, { value: 'low', label: 'Low' }, { value: 'out', label: 'Out of stock' }, { value: 'ok', label: 'In stock' }]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Inventory items" rows={filtered} columns={cols} rowKey={(i) => i.id} pageSize={10} initialSort={{ key: 'stock', dir: 'asc' }} empty={<EmptyState icon={Package} title="No items match" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(i) => (<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{i.name}</p><p className="text-meta text-slate">{i.sku} · {supplierName(i.supplierId)}</p></div><Badge tone={LEVEL[stockLevel(i)].tone}>{LEVEL[stockLevel(i)].label}</Badge></div><p className="text-body tnum">{i.stock} {i.unit} <span className="text-slate">· reorder at {i.reorderLevel}</span></p>{actions(i)}</div>)} />
      </Card>

      <ItemDialog item={editing} onClose={() => setEditing(null)} />
      <AdjustDialog item={adjusting} onClose={() => setAdjusting(null)} />
      <ConfirmDialog open={Boolean(deleting)} title={`Delete ${deleting?.name}?`} confirmLabel="Delete item" danger loading={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>Items with stock on hand or on a live purchase order cannot be deleted.</ConfirmDialog>
    </InventoryShell>
  );
}
