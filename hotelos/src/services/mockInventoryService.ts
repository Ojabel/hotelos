import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import { statusAfterReceipt, stockLevel } from '@/utils/stock';
import type { InventoryItem, PurchaseOrder, Result, StockMovement, Supplier } from '@/types';
import { delay } from './delay';

/** MOCK SERVICE — backend integration point for stock, suppliers and purchasing. */
const nextId = (ids: string[], prefix: string, w = 3) => `${prefix}${String(Math.max(0, ...ids.map((i) => Number(i.replace(prefix, '')) || 0)) + 1).padStart(w, '0')}`;
const yyMM = () => today().slice(2, 4) + today().slice(5, 7);
const hasLiveOrder = (itemId: string, pos: PurchaseOrder[]) => pos.some((p) => (p.status === 'draft' || p.status === 'ordered' || p.status === 'partially_received') && p.lines.some((l) => l.itemId === itemId));

// ---------- items ----------
export type ItemInput = Omit<InventoryItem, 'id' | 'stock'> & { id?: string; stock?: number };

export async function saveItem(input: ItemInput): Promise<Result<InventoryItem>> {
  await delay(250);
  const s = useHotelStore.getState();
  if (!input.name.trim()) return { ok: false, error: 'Enter a name.' };
  if (!input.sku.trim()) return { ok: false, error: 'Enter a SKU.' };
  if (!input.unit.trim()) return { ok: false, error: 'Enter a unit (e.g. pcs, kg).' };
  if (!(input.unitCost > 0)) return { ok: false, error: 'Unit cost must be above zero.' };
  if (!(input.reorderLevel >= 0) || !(input.reorderQty > 0)) return { ok: false, error: 'Reorder level cannot be negative and reorder quantity must be above zero.' };
  if (!s.suppliers.some((x) => x.id === input.supplierId)) return { ok: false, error: 'Choose a supplier.' };
  if (s.inventory.some((i) => i.id !== input.id && i.hotelId === input.hotelId && i.sku.toLowerCase() === input.sku.trim().toLowerCase())) return { ok: false, error: 'This SKU already exists at this property.' };
  const opening = Math.max(0, Math.round(input.stock ?? 0));
  const item: InventoryItem = { ...input, id: input.id ?? nextId(s.inventory.map((i) => i.id), 'inv-'), name: input.name.trim(), sku: input.sku.trim().toUpperCase(), stock: input.id ? s.inventory.find((i) => i.id === input.id)!.stock : opening };
  s.setInventory((is) => (input.id ? is.map((i) => (i.id === input.id ? item : i)) : [...is, item]));
  if (!input.id && opening > 0) s.setMovements((ms) => [{ id: nextId(ms.map((m) => m.id), 'mv-', 4), itemId: item.id, hotelId: item.hotelId, date: today(), change: opening, type: 'adjustment', reason: 'Opening stock', by: 'System' }, ...ms]);
  return { ok: true, value: item };
}

export async function deleteItem(id: string): Promise<Result<true>> {
  await delay(250);
  const s = useHotelStore.getState();
  const item = s.inventory.find((i) => i.id === id);
  if (!item) return { ok: false, error: 'Item not found.' };
  if (hasLiveOrder(id, s.purchaseOrders)) return { ok: false, error: `${item.name} is on a live purchase order.` };
  if (item.stock > 0) return { ok: false, error: `${item.name} still has ${item.stock} ${item.unit} in stock. Write it off with a stock adjustment first.` };
  s.setInventory((is) => is.filter((i) => i.id !== id));
  return { ok: true, value: true };
}

/** Record a movement and move the stock level with it. Stock can never go below zero. */
export async function recordMovement(input: { itemId: string; type: StockMovement['type']; quantity: number; reason: string; by?: string; reference?: string }): Promise<Result<StockMovement>> {
  await delay(200);
  const s = useHotelStore.getState();
  const item = s.inventory.find((i) => i.id === input.itemId);
  if (!item) return { ok: false, error: 'Item not found.' };
  if (!Number.isFinite(input.quantity) || input.quantity === 0) return { ok: false, error: 'Enter a quantity other than zero.' };
  if (input.type !== 'adjustment' && input.quantity < 0) return { ok: false, error: 'Enter a positive quantity.' };
  if (!input.reason.trim()) return { ok: false, error: 'Give a reason.' };
  const change = input.type === 'usage' ? -Math.abs(input.quantity) : input.type === 'delivery' ? Math.abs(input.quantity) : input.quantity;
  if (item.stock + change < 0) return { ok: false, error: `Only ${item.stock} ${item.unit} in stock.` };
  const move: StockMovement = { id: nextId(s.movements.map((m) => m.id), 'mv-', 4), itemId: item.id, hotelId: item.hotelId, date: today(), change, type: input.type, reason: input.reason.trim(), reference: input.reference, by: input.by ?? 'Staff' };
  s.setInventory((is) => is.map((i) => (i.id === item.id ? { ...i, stock: i.stock + change } : i)));
  s.setMovements((ms) => [move, ...ms]);
  const after = item.stock + change;
  if (stockLevel({ stock: after, reorderLevel: item.reorderLevel }) !== 'ok' && stockLevel(item) === 'ok') s.log(`${item.name} is now ${after === 0 ? 'out of stock' : 'below its reorder level'}`, 'system');
  return { ok: true, value: move };
}

// ---------- suppliers ----------
export async function saveSupplier(input: Omit<Supplier, 'id'> & { id?: string }): Promise<Result<Supplier>> {
  await delay(250);
  const s = useHotelStore.getState();
  if (!input.name.trim()) return { ok: false, error: 'Enter the supplier name.' };
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!(input.leadDays >= 0)) return { ok: false, error: 'Lead time cannot be negative.' };
  if (s.suppliers.some((x) => x.id !== input.id && x.name.toLowerCase() === input.name.trim().toLowerCase())) return { ok: false, error: 'A supplier with this name already exists.' };
  if (input.id && input.status === 'inactive' && s.purchaseOrders.some((p) => p.supplierId === input.id && (p.status === 'ordered' || p.status === 'partially_received'))) return { ok: false, error: 'This supplier has orders awaiting delivery. Receive or cancel them first.' };
  const supplier: Supplier = { ...input, id: input.id ?? nextId(s.suppliers.map((x) => x.id), 'sup-'), name: input.name.trim() };
  s.setSuppliers((xs) => (input.id ? xs.map((x) => (x.id === input.id ? supplier : x)) : [...xs, supplier]));
  return { ok: true, value: supplier };
}

// ---------- purchase orders ----------
export interface PoInput { hotelId: string; supplierId: string; expectedDate: string; lines: Array<{ itemId: string; qty: number }>; notes?: string }

function buildLines(input: PoInput): Result<PurchaseOrder['lines']> {
  const { inventory, suppliers } = useHotelStore.getState();
  const supplier = suppliers.find((x) => x.id === input.supplierId);
  if (!supplier) return { ok: false, error: 'Choose a supplier.' };
  if (supplier.status !== 'active') return { ok: false, error: `${supplier.name} is inactive.` };
  const lines = input.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) return { ok: false, error: 'Add at least one item.' };
  const out: PurchaseOrder['lines'] = [];
  for (const l of lines) {
    const item = inventory.find((i) => i.id === l.itemId);
    if (!item || item.hotelId !== input.hotelId) return { ok: false, error: 'An item does not belong to this property.' };
    if (item.supplierId !== input.supplierId) return { ok: false, error: `${item.name} is supplied by a different vendor.` };
    if (!Number.isInteger(l.qty)) return { ok: false, error: 'Quantities must be whole numbers.' };
    out.push({ itemId: item.id, qty: l.qty, unitCost: item.unitCost, received: 0 });
  }
  return { ok: true, value: out };
}

export async function createPurchaseOrder(input: PoInput): Promise<Result<PurchaseOrder>> {
  await delay(300);
  const s = useHotelStore.getState();
  if (input.expectedDate < today()) return { ok: false, error: 'Expected delivery cannot be in the past.' };
  const lines = buildLines(input);
  if (!lines.ok) return lines;
  const n = nextId(s.purchaseOrders.map((p) => p.id), 'po-');
  const po: PurchaseOrder = { id: n, reference: `PO-${yyMM()}-${n.replace('po-', '')}`, hotelId: input.hotelId, supplierId: input.supplierId, status: 'draft', createdAt: today(), expectedDate: input.expectedDate, lines: lines.value, notes: input.notes?.trim() || undefined };
  s.setPurchaseOrders((ps) => [po, ...ps]);
  s.log(`Purchase order ${po.reference} drafted`, 'system');
  return { ok: true, value: po };
}

/** One draft per supplier for every item at or below its reorder level that is not already on order. */
export async function draftFromLowStock(hotelId: string): Promise<Result<PurchaseOrder[]>> {
  await delay(300);
  const s = useHotelStore.getState();
  const needs = s.inventory.filter((i) => (hotelId === 'all' || i.hotelId === hotelId) && stockLevel(i) !== 'ok' && !hasLiveOrder(i.id, s.purchaseOrders));
  if (needs.length === 0) return { ok: false, error: 'Nothing needs reordering, or it is already on a live purchase order.' };
  const groups = new Map<string, InventoryItem[]>();
  for (const i of needs) { const k = `${i.hotelId}|${i.supplierId}`; groups.set(k, [...(groups.get(k) ?? []), i]); }
  const created: PurchaseOrder[] = [];
  for (const [key, items] of groups) {
    const [h, sup] = key.split('|');
    const supplier = s.suppliers.find((x) => x.id === sup)!;
    if (supplier.status !== 'active') continue;
    const r = await createPurchaseOrder({ hotelId: h, supplierId: sup, expectedDate: addLead(supplier.leadDays), lines: items.map((i) => ({ itemId: i.id, qty: i.reorderQty })), notes: 'Raised from low-stock alert.' });
    if (r.ok) created.push(r.value);
  }
  return created.length ? { ok: true, value: created } : { ok: false, error: 'The suppliers for these items are inactive.' };
}
const addLead = (days: number) => { const [y, m, d] = today().split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10); };

export async function sendPurchaseOrder(id: string): Promise<Result<PurchaseOrder>> {
  await delay(250);
  const s = useHotelStore.getState();
  const po = s.purchaseOrders.find((p) => p.id === id);
  if (!po) return { ok: false, error: 'Purchase order not found.' };
  if (po.status !== 'draft') return { ok: false, error: 'Only drafts can be sent.' };
  if (s.suppliers.find((x) => x.id === po.supplierId)?.status !== 'active') return { ok: false, error: 'The supplier is inactive.' };
  const updated = { ...po, status: 'ordered' as const };
  s.setPurchaseOrders((ps) => ps.map((p) => (p.id === id ? updated : p)));
  s.log(`Purchase order ${po.reference} sent to supplier (simulated)`, 'system');
  return { ok: true, value: updated };
}

export async function receivePurchaseOrder(id: string, receipts: Record<string, number>): Promise<Result<PurchaseOrder>> {
  await delay(300);
  const s = useHotelStore.getState();
  const po = s.purchaseOrders.find((p) => p.id === id);
  if (!po) return { ok: false, error: 'Purchase order not found.' };
  if (po.status !== 'ordered' && po.status !== 'partially_received') return { ok: false, error: 'Only orders awaiting delivery can be received.' };
  const entries = Object.entries(receipts).filter(([, q]) => q !== 0);
  if (entries.length === 0) return { ok: false, error: 'Enter the quantity received for at least one item.' };
  for (const [itemId, q] of entries) {
    const line = po.lines.find((l) => l.itemId === itemId);
    if (!line) return { ok: false, error: 'That item is not on this order.' };
    if (!Number.isInteger(q) || q < 0) return { ok: false, error: 'Received quantities must be whole numbers above zero.' };
    if (q > line.qty - line.received) return { ok: false, error: `Only ${line.qty - line.received} still outstanding for this line.` };
  }
  const lines = po.lines.map((l) => ({ ...l, received: l.received + (receipts[l.itemId] ?? 0) }));
  const updated: PurchaseOrder = { ...po, lines, status: statusAfterReceipt(lines) };
  s.setPurchaseOrders((ps) => ps.map((p) => (p.id === id ? updated : p)));
  for (const [itemId, q] of entries) await recordMovement({ itemId, type: 'delivery', quantity: q, reason: `Delivery against ${po.reference}`, reference: po.reference, by: 'Receiving' });
  s.log(`${po.reference} ${updated.status === 'received' ? 'fully received' : 'partly received'}`, 'system');
  return { ok: true, value: updated };
}

export async function cancelPurchaseOrder(id: string): Promise<Result<PurchaseOrder>> {
  await delay(250);
  const s = useHotelStore.getState();
  const po = s.purchaseOrders.find((p) => p.id === id);
  if (!po) return { ok: false, error: 'Purchase order not found.' };
  if (po.status !== 'draft' && po.status !== 'ordered') return { ok: false, error: po.status === 'partially_received' ? 'Part of this order has been delivered, so it cannot be cancelled.' : `A ${po.status} order cannot be cancelled.` };
  const updated = { ...po, status: 'cancelled' as const };
  s.setPurchaseOrders((ps) => ps.map((p) => (p.id === id ? updated : p)));
  return { ok: true, value: updated };
}
