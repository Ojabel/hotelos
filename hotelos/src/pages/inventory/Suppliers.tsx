import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { saveSupplier } from '@/services/mockInventoryService';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { Supplier } from '@/types';
import { InventoryShell } from './InventoryShell';

export default function Suppliers() {
  const suppliers = useHotelStore((s) => s.suppliers);
  const items = useHotelStore((s) => s.inventory);
  const pos = useHotelStore((s) => s.purchaseOrders);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const counts = useMemo(() => new Map(suppliers.map((s) => [s.id, { items: items.filter((i) => i.supplierId === s.id).length, open: pos.filter((p) => p.supplierId === s.id && ['ordered', 'partially_received'].includes(p.status)).length }])), [suppliers, items, pos]);

  const cols: Column<Supplier>[] = [
    { key: 'name', header: 'Supplier', sortValue: (s) => s.name, render: (s) => <div><p className="font-medium">{s.name}</p><p className="text-meta text-slate">{s.category}</p></div> },
    { key: 'contact', header: 'Contact', render: (s) => <div><p>{s.contact}</p><p className="text-meta text-slate">{s.phone}</p></div> },
    { key: 'email', header: 'Email', render: (s) => <span className="text-slate">{s.email}</span> },
    { key: 'lead', header: 'Lead time', align: 'right', sortValue: (s) => s.leadDays, render: (s) => `${s.leadDays} days` },
    { key: 'items', header: 'Items', align: 'right', render: (s) => counts.get(s.id)?.items },
    { key: 'open', header: 'Open orders', align: 'right', render: (s) => counts.get(s.id)?.open },
    { key: 'status', header: 'Status', render: (s) => <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { key: 'a', header: '', align: 'right', render: (s) => <Button variant="ghost" size="sm" aria-label={`Edit ${s.name}`} onClick={(e) => { e.stopPropagation(); setEditing(s); }}><Pencil className="h-4 w-4" aria-hidden /></Button> },
  ];

  return (
    <InventoryShell title="Suppliers" description={`${suppliers.filter((s) => s.status === 'active').length} active vendors`} actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden />Add supplier</Button>}>
      <Card>
        <DataTable caption="Suppliers" rows={suppliers} columns={cols} rowKey={(s) => s.id} pageSize={10} initialSort={{ key: 'name', dir: 'asc' }} empty={<EmptyState icon={Truck} title="No suppliers yet" />}
          mobileCard={(s) => (<div className="space-y-1 p-4"><div className="flex items-start justify-between gap-2"><p className="font-medium">{s.name}</p><Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status === 'active' ? 'Active' : 'Inactive'}</Badge></div><p className="text-meta text-slate">{s.category} · {s.contact} · {s.phone}</p><Button variant="secondary" size="sm" onClick={() => setEditing(s)}>Edit</Button></div>)} />
      </Card>
      {editing && <SupplierDialog key={editing === 'new' ? 'new' : editing.id} supplier={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </InventoryShell>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const [f, setF] = useState({ name: supplier?.name ?? '', category: supplier?.category ?? '', contact: supplier?.contact ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', leadDays: String(supplier?.leadDays ?? 3), status: supplier?.status ?? ('active' as Supplier['status']) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveSupplier({ id: supplier?.id, name: f.name, category: f.category, contact: f.contact, phone: f.phone, email: f.email, leadDays: Number(f.leadDays), status: f.status });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(supplier ? 'Supplier updated' : 'Supplier added', r.value.name);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={supplier ? `Edit ${supplier.name}` : 'Add supplier'} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="sup-form" loading={busy}>{supplier ? 'Save changes' : 'Add supplier'}</Button></>}>
      <form id="sup-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={f.name} onChange={set('name')} />
          <Input label="Category" value={f.category} onChange={set('category')} placeholder="e.g. Linen" />
          <Input label="Contact person" value={f.contact} onChange={set('contact')} />
          <Input label="Phone" type="tel" value={f.phone} onChange={set('phone')} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} />
          <Input label="Lead time (days)" type="number" min={0} value={f.leadDays} onChange={set('leadDays')} />
        </div>
        <Select label="Status" value={f.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      </form>
    </Dialog>
  );
}
