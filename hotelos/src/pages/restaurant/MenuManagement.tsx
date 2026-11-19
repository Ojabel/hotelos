import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { deleteMenuItem, saveMenuItem, setMenuAvailability } from '@/services/mockRestaurantService';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { MenuCategory, MenuItem } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { RestaurantShell } from './RestaurantShell';

const CATS: MenuCategory[] = ['Starters', 'Mains', 'Desserts', 'Beverages'];

export default function MenuManagement() {
  const menu = useHotelStore((s) => s.menu);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => menu.filter((m) => (cat === 'all' || m.category === cat) && (!q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()))), [menu, cat, q]);
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const r = await deleteMenuItem(deleting.id);
    setBusy(false);
    if (r.ok) toast.success('Item removed', deleting.name); else toast.error('Could not remove item', r.error);
    setDeleting(null);
  };

  const toggle = (m: MenuItem) => (
    <button type="button" role="switch" aria-checked={m.available} aria-label={`${m.name} available`} onClick={() => setMenuAvailability(m.id, !m.available)} className={cn('relative h-6 w-11 rounded-full transition-colors', m.available ? 'bg-success' : 'bg-line')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', m.available ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
  const actions = (m: MenuItem) => (<div className="flex justify-end gap-1"><Button variant="ghost" size="sm" aria-label={`Edit ${m.name}`} onClick={stop(() => setEditing(m))}><Pencil className="h-4 w-4" aria-hidden /></Button><Button variant="ghost" size="sm" aria-label={`Delete ${m.name}`} onClick={stop(() => setDeleting(m))}><Trash2 className="h-4 w-4 text-danger" aria-hidden /></Button></div>);

  const cols: Column<MenuItem>[] = [
    { key: 'name', header: 'Item', sortValue: (m) => m.name, render: (m) => <div><p className="font-medium">{m.name}</p><p className="text-meta text-slate">{m.description}</p></div> },
    { key: 'cat', header: 'Category', sortValue: (m) => m.category, render: (m) => <Badge>{m.category}</Badge> },
    { key: 'prep', header: 'Prep', sortValue: (m) => m.prepMinutes, render: (m) => `${m.prepMinutes} min` },
    { key: 'price', header: 'Price', align: 'right', sortValue: (m) => m.price, render: (m) => formatCurrency(m.price) },
    { key: 'avail', header: 'Available', render: toggle },
    { key: 'a', header: '', align: 'right', render: actions },
  ];

  return (
    <RestaurantShell title="Menu" description={`${menu.length} items · ${menu.filter((m) => !m.available).length} unavailable`} actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden />Add item</Button>}>
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1.5fr_1fr]">
          <div className="space-y-1.5"><label htmlFor="menu-q" className="block text-meta font-medium">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="menu-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item name" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Category" value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...CATS.map((c) => ({ value: c, label: c }))]} />
        </div>
        <DataTable caption="Menu items" rows={rows} columns={cols} rowKey={(m) => m.id} pageSize={10} initialSort={{ key: 'cat', dir: 'asc' }} empty={<EmptyState icon={UtensilsCrossed} title="No items found" />}
          mobileCard={(m) => (<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{m.name}</p><p className="text-meta text-slate">{m.category} · {m.prepMinutes} min</p></div><p className="font-medium tnum">{formatCurrency(m.price)}</p></div><div className="flex items-center justify-between">{toggle(m)}{actions(m)}</div></div>)} />
      </Card>
      <ItemDialog item={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={Boolean(deleting)} title={`Remove ${deleting?.name}?`} confirmLabel="Remove item" danger loading={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>Items on open orders cannot be removed. Mark them unavailable instead.</ConfirmDialog>
    </RestaurantShell>
  );
}

function ItemDialog({ item, onClose }: { item: MenuItem | 'new' | null; onClose: () => void }) {
  return item ? <ItemBody key={item === 'new' ? 'new' : item.id} item={item === 'new' ? undefined : item} onClose={onClose} /> : null;
}

function ItemBody({ item, onClose }: { item?: MenuItem; onClose: () => void }) {
  const [f, setF] = useState({ name: item?.name ?? '', category: item?.category ?? ('Mains' as MenuCategory), description: item?.description ?? '', price: String(item?.price ?? ''), prep: String(item?.prepMinutes ?? 15), available: item?.available ?? true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveMenuItem({ id: item?.id, name: f.name, category: f.category, description: f.description, price: Number(f.price), prepMinutes: Number(f.prep), available: f.available });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(item ? 'Item updated' : 'Item added', r.value.name);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={item ? `Edit ${item.name}` : 'Add menu item'} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="menu-form" loading={busy}>{item ? 'Save changes' : 'Add item'}</Button></>}>
      <form id="menu-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as MenuCategory })} options={CATS.map((c) => ({ value: c, label: c }))} />
          <Input label="Price" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <Input label="Prep (min)" type="number" min={1} value={f.prep} onChange={(e) => setF({ ...f, prep: e.target.value })} />
        </div>
        <Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <label className="flex items-center gap-2 text-body"><input type="checkbox" className="h-4 w-4 accent-forest" checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} />Available to order</label>
      </form>
    </Dialog>
  );
}
