import type { InventoryItem, PurchaseOrder, PurchaseStatus } from '@/types';

export type StockLevel = 'ok' | 'low' | 'out';

export const stockLevel = (i: Pick<InventoryItem, 'stock' | 'reorderLevel'>): StockLevel => (i.stock <= 0 ? 'out' : i.stock <= i.reorderLevel ? 'low' : 'ok');
export const stockValue = (i: Pick<InventoryItem, 'stock' | 'unitCost'>) => i.stock * i.unitCost;
export const poTotal = (po: Pick<PurchaseOrder, 'lines'>) => po.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
export const poOutstanding = (po: Pick<PurchaseOrder, 'lines'>) => po.lines.reduce((s, l) => s + (l.qty - l.received), 0);

/** Quantity still on order and not yet delivered, per item, across live purchase orders. */
export function onOrderQty(itemId: string, pos: PurchaseOrder[]): number {
  return pos.filter((p) => p.status === 'ordered' || p.status === 'partially_received').reduce((s, p) => s + p.lines.filter((l) => l.itemId === itemId).reduce((a, l) => a + (l.qty - l.received), 0), 0);
}

/** Status after a delivery: everything in → received, something in → partial. */
export function statusAfterReceipt(lines: PurchaseOrder['lines']): PurchaseStatus {
  if (lines.every((l) => l.received >= l.qty)) return 'received';
  return lines.some((l) => l.received > 0) ? 'partially_received' : 'ordered';
}
