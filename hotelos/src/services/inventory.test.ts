import { beforeEach, describe, expect, it } from 'vitest';
import { useHotelStore } from '@/store/useHotelStore';
import { onOrderQty, poOutstanding, poTotal, stockLevel } from '@/utils/stock';
import { cancelPurchaseOrder, createPurchaseOrder, deleteItem, draftFromLowStock, receivePurchaseOrder, recordMovement, saveItem, sendPurchaseOrder } from './mockInventoryService';

const st = () => useHotelStore.getState();
const item = (id: string) => st().inventory.find((i) => i.id === id)!;
const po = (id: string) => st().purchaseOrders.find((p) => p.id === id)!;

beforeEach(() => st().reset());

describe('stock levels and seed data', () => {
  it('meets the spec volume and flags low and out-of-stock items', () => {
    expect(st().inventory.length).toBeGreaterThanOrEqual(15);
    expect(stockLevel(item('inv-001'))).toBe('low'); // bath towels
    expect(stockLevel(item('inv-014'))).toBe('out'); // pool towels
    expect(stockLevel(item('inv-004'))).toBe('ok');
  });

  it('ties every received purchase-order line to a delivery movement', () => {
    for (const p of st().purchaseOrders) {
      for (const l of p.lines.filter((x) => x.received > 0)) {
        const delivered = st().movements.filter((m) => m.reference === p.reference && m.itemId === l.itemId && m.type === 'delivery').reduce((s, m) => s + m.change, 0);
        expect(delivered).toBe(l.received);
      }
    }
  });

  it('never has negative stock and every item has a supplier', () => {
    for (const i of st().inventory) { expect(i.stock).toBeGreaterThanOrEqual(0); expect(st().suppliers.some((x) => x.id === i.supplierId)).toBe(true); }
  });
});

describe('stock movements', () => {
  it('moves stock with usage, deliveries and signed adjustments', async () => {
    const start = item('inv-004').stock;
    expect((await recordMovement({ itemId: 'inv-004', type: 'usage', quantity: 50, reason: 'Floor 2 restock' })).ok).toBe(true);
    expect(item('inv-004').stock).toBe(start - 50);
    await recordMovement({ itemId: 'inv-004', type: 'delivery', quantity: 100, reason: 'Ad-hoc delivery' });
    expect(item('inv-004').stock).toBe(start + 50);
    await recordMovement({ itemId: 'inv-004', type: 'adjustment', quantity: -10, reason: 'Count variance' });
    expect(item('inv-004').stock).toBe(start + 40);
    expect(st().movements[0].change).toBe(-10);
  });

  it('refuses to take more than is in stock, zero quantities and missing reasons', async () => {
    expect((await recordMovement({ itemId: 'inv-014', type: 'usage', quantity: 1, reason: 'x' })).ok).toBe(false); // 0 in stock
    expect((await recordMovement({ itemId: 'inv-004', type: 'usage', quantity: 0, reason: 'x' })).ok).toBe(false);
    expect((await recordMovement({ itemId: 'inv-004', type: 'usage', quantity: 5, reason: ' ' })).ok).toBe(false);
    expect(item('inv-014').stock).toBe(0);
  });
});

describe('purchase orders', () => {
  it('receives a delivery in parts and completes the order', async () => {
    const before = item('inv-010').stock; // chicken, 120 on order
    expect((await receivePurchaseOrder('po-004', { 'inv-010': 60 })).ok).toBe(true);
    expect(po('po-004').status).toBe('partially_received');
    expect(item('inv-010').stock).toBe(before + 60);
    expect(onOrderQty('inv-010', st().purchaseOrders)).toBe(60);
    expect((await receivePurchaseOrder('po-004', { 'inv-010': 61 })).ok).toBe(false); // over-receipt
    expect((await receivePurchaseOrder('po-004', { 'inv-010': 60 })).ok).toBe(true);
    expect(po('po-004').status).toBe('received');
    expect(poOutstanding(po('po-004'))).toBe(0);
    expect(item('inv-010').stock).toBe(before + 120);
  });

  it('only receives orders that were sent, and sends only drafts', async () => {
    expect((await receivePurchaseOrder('po-006', { 'inv-003': 10 })).ok).toBe(false); // draft
    expect((await sendPurchaseOrder('po-006')).ok).toBe(true);
    expect((await sendPurchaseOrder('po-006')).ok).toBe(false);
    expect((await receivePurchaseOrder('po-006', { 'inv-003': 600, 'inv-004': 600, 'inv-005': 800 })).ok).toBe(true);
    expect(po('po-006').status).toBe('received');
  });

  it('cancels drafts and unsent orders but not partly delivered ones', async () => {
    expect((await cancelPurchaseOrder('po-006')).ok).toBe(true);
    expect((await cancelPurchaseOrder('po-005')).ok).toBe(true);
    expect((await cancelPurchaseOrder('po-003')).ok).toBe(false); // partially received
    expect((await cancelPurchaseOrder('po-001')).ok).toBe(false); // received
  });

  it('totals order value from lines', () => {
    expect(poTotal(po('po-005'))).toBe(40 * 2200 + 40 * 1800);
  });

  it('validates new orders: supplier match, active supplier, no past delivery dates', async () => {
    const base = { hotelId: 'h-vi', supplierId: 'sup-001', expectedDate: '2026-12-01', lines: [{ itemId: 'inv-004', qty: 10 }] };
    expect((await createPurchaseOrder(base)).ok).toBe(false); // shampoo is not a Crown Linens product
    expect((await createPurchaseOrder({ ...base, supplierId: 'sup-008', lines: [{ itemId: 'inv-015', qty: 5 }] })).ok).toBe(false); // inactive
    expect((await createPurchaseOrder({ ...base, supplierId: 'sup-003', expectedDate: '2026-01-01' })).ok).toBe(false);
    const ok = await createPurchaseOrder({ ...base, supplierId: 'sup-003' });
    expect(ok.ok && ok.value.status).toBe('draft');
  });

  it('drafts reorders only for low items not already on a live order, once', async () => {
    const r = await draftFromLowStock('all');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(1);
      expect(r.value[0].supplierId).toBe('sup-001');
      expect(r.value[0].lines).toEqual([{ itemId: 'inv-001', qty: 200, unitCost: 4500, received: 0 }]);
    }
    expect((await draftFromLowStock('all')).ok).toBe(false);
  });
});

describe('items', () => {
  const base = { hotelId: 'h-vi', sku: 'NEW-1', name: 'Hand towels', category: 'Linen' as const, unit: 'pcs', reorderLevel: 50, reorderQty: 100, unitCost: 1200, supplierId: 'sup-001' };

  it('creates items with opening stock logged as a movement and rejects duplicate SKUs', async () => {
    const r = await saveItem({ ...base, stock: 40 });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.stock).toBe(40); expect(st().movements[0].reason).toBe('Opening stock'); }
    expect((await saveItem({ ...base, name: 'Other' })).ok).toBe(false);
  });

  it('will not delete items that are in stock or on a live order', async () => {
    expect((await deleteItem('inv-004')).ok).toBe(false);
    await recordMovement({ itemId: 'inv-004', type: 'usage', quantity: item('inv-004').stock, reason: 'Write-off' });
    await recordMovement({ itemId: 'inv-014', type: 'adjustment', quantity: 5, reason: 'Found' });
    expect((await deleteItem('inv-014')).ok).toBe(false); // on draft po-008 and in stock
    expect((await deleteItem('inv-004')).ok).toBe(false); // still on draft po-006
  });
});
