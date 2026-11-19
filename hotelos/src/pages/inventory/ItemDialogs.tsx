import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { mockHotels } from '@/data/mockHotels';
import { recordMovement, saveItem } from '@/services/mockInventoryService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { InventoryItem, StockMovement } from '@/types';
import { FINANCIAL_ROLES } from '@/routes/nav';

const CATEGORIES: InventoryItem['category'][] = ['Food & Beverage', 'Housekeeping', 'Linen', 'Toiletries', 'Maintenance', 'Cleaning'];
export const ITEM_CATEGORIES = CATEGORIES;

export function ItemDialog({ item, onClose }: { item: InventoryItem | 'new' | null; onClose: () => void }) {
  return item ? <ItemBody key={item === 'new' ? 'new' : item.id} item={item === 'new' ? undefined : item} onClose={onClose} /> : null;
}

function ItemBody({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const globalHotel = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canManageFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const suppliers = useHotelStore((s) => s.suppliers.filter((x) => x.status === 'active' || x.id === item?.supplierId));
  const [f, setF] = useState({ hotelId: item?.hotelId ?? (globalHotel === 'all' ? 'h-vi' : globalHotel), name: item?.name ?? '', sku: item?.sku ?? '', category: item?.category ?? ('Food & Beverage' as InventoryItem['category']), unit: item?.unit ?? 'pcs', reorderLevel: String(item?.reorderLevel ?? 0), reorderQty: String(item?.reorderQty ?? 0), unitCost: String(item?.unitCost ?? ''), supplierId: item?.supplierId ?? suppliers[0]?.id ?? '', stock: '0' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveItem({ id: item?.id, hotelId: f.hotelId, name: f.name, sku: f.sku, category: f.category, unit: f.unit, reorderLevel: Number(f.reorderLevel), reorderQty: Number(f.reorderQty), unitCost: canManageFinancials ? Number(f.unitCost) : item?.unitCost ?? 0, supplierId: f.supplierId, stock: Number(f.stock) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(item ? 'Item updated' : 'Item added', r.value.name);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="lg" title={item ? `Edit ${item.name}` : 'Add inventory item'} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="item-form" loading={busy}>{item ? 'Save changes' : 'Add item'}</Button></>}>
      <form id="item-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Property" value={f.hotelId} onChange={set('hotelId')} disabled={Boolean(item)} options={mockHotels.map((h) => ({ value: h.id, label: h.name }))} />
          <Select label="Category" value={f.category} onChange={set('category')} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <Input label="Name" value={f.name} onChange={set('name')} />
          <Input label="SKU" value={f.sku} onChange={set('sku')} />
          <Input label="Unit" value={f.unit} onChange={set('unit')} hint="pcs, kg, litre, box…" />
          {canManageFinancials && <Input label="Unit cost" type="number" min={0} value={f.unitCost} onChange={set('unitCost')} />}
          <Input label="Reorder level" type="number" min={0} value={f.reorderLevel} onChange={set('reorderLevel')} />
          <Input label="Reorder quantity" type="number" min={1} value={f.reorderQty} onChange={set('reorderQty')} />
          <Select label="Supplier" value={f.supplierId} onChange={set('supplierId')} options={suppliers.map((x) => ({ value: x.id, label: x.name }))} />
          {!item && <Input label="Opening stock" type="number" min={0} value={f.stock} onChange={set('stock')} />}
        </div>
      </form>
    </Dialog>
  );
}

export function AdjustDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  return item ? <AdjustBody key={item.id} item={item} onClose={onClose} /> : null;
}

function AdjustBody({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [type, setType] = useState<StockMovement['type']>('usage');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await recordMovement({ itemId: item.id, type, quantity: Number(qty), reason, by: 'Stock room' });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Stock updated', `${item.name}: ${r.value.change > 0 ? '+' : ''}${r.value.change} ${item.unit}`);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="sm" title={`Adjust ${item.name}`} description={`In stock: ${item.stock} ${item.unit}`} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="adj-form" loading={busy}>Record movement</Button></>}>
      <form id="adj-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as StockMovement['type'])} options={[{ value: 'usage', label: 'Usage / issue out' }, { value: 'delivery', label: 'Delivery in' }, { value: 'adjustment', label: 'Count adjustment (+/−)' }]} />
        <Input label="Quantity" type="number" value={qty} onChange={(e) => setQty(e.target.value)} hint={type === 'adjustment' ? 'Use a negative number to remove stock' : undefined} />
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Dialog>
  );
}
