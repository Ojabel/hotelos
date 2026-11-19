import type { InventoryItem, PurchaseOrder, StockMovement, Supplier } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';

const d = (o: number) => addDays(DEMO_TODAY, o);
const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const yyMM = DEMO_TODAY.slice(2, 4) + DEMO_TODAY.slice(5, 7);

const sup = (n: number, name: string, category: string, contact: string, leadDays: number, status: Supplier['status'] = 'active'): Supplier => ({
  id: `sup-${pad(n)}`, name, category, contact, leadDays, status,
  phone: `+234 80${n} ${pad(300 + n * 41)} ${pad(2000 + n * 137, 4)}`,
  email: `sales@${name.toLowerCase().replace(/[^a-z]/g, '')}.example`,
});

export const mockSuppliers: Supplier[] = [
  sup(1, 'Crown Linens', 'Linen', 'Bola Adesanya', 4),
  sup(2, 'CleanPro Nigeria', 'Cleaning', 'Ngozi Eke', 2),
  sup(3, 'Guest Amenities Co.', 'Toiletries', 'Dapo Ajayi', 3),
  sup(4, 'Mile 12 Fresh Produce', 'Food & Beverage', 'Mama Nkechi', 1),
  sup(5, 'Premium Meats Ltd', 'Food & Beverage', 'Idris Lawal', 1),
  sup(6, 'Bevco Distributors', 'Food & Beverage', 'Tayo Sanni', 3),
  sup(7, 'Brightline Electricals', 'Maintenance', 'Okon Bassey', 5),
  sup(8, 'AquaPure Pools', 'Maintenance', 'Zainab Hassan', 6, 'inactive'),
];

type Spec = [string, string, InventoryItem['category'], string, number, number, number, number, string, string];
// id, name, category, unit, reorderLevel, reorderQty, unitCost, targetStock, supplier, hotel
const SPECS: Spec[] = [
  ['Bath towels', 'LIN-BT', 'Linen', 'pcs', 120, 200, 4500, 95, 'sup-001', 'h-vi'],
  ['Bed sheets (queen)', 'LIN-SQ', 'Linen', 'pcs', 80, 120, 7800, 140, 'sup-001', 'h-vi'],
  ['Shower gel 30ml', 'TOI-SG', 'Toiletries', 'pcs', 300, 600, 180, 210, 'sup-003', 'h-vi'],
  ['Shampoo 30ml', 'TOI-SH', 'Toiletries', 'pcs', 300, 600, 170, 520, 'sup-003', 'h-vi'],
  ['Bath soap', 'TOI-BS', 'Toiletries', 'pcs', 400, 800, 90, 760, 'sup-003', 'h-vi'],
  ['Glass cleaner', 'CLN-GC', 'Cleaning', 'litre', 20, 40, 2200, 34, 'sup-002', 'h-vi'],
  ['All-purpose cleaner', 'CLN-AP', 'Cleaning', 'litre', 25, 40, 1800, 18, 'sup-002', 'h-vi'],
  ['LED light bulbs', 'MNT-LB', 'Maintenance', 'pcs', 40, 100, 1500, 62, 'sup-007', 'h-vi'],
  ['Rice', 'FNB-RC', 'Food & Beverage', 'kg', 100, 200, 1450, 230, 'sup-004', 'h-vi'],
  ['Chicken', 'FNB-CH', 'Food & Beverage', 'kg', 60, 120, 3800, 41, 'sup-005', 'h-vi'],
  ['Cooking oil', 'FNB-OL', 'Food & Beverage', 'litre', 40, 60, 2600, 88, 'sup-004', 'h-vi'],
  ['Bottled water 75cl', 'FNB-WT', 'Food & Beverage', 'pcs', 200, 600, 380, 640, 'sup-006', 'h-vi'],
  ['Coffee beans', 'FNB-CF', 'Food & Beverage', 'kg', 15, 20, 9500, 26, 'sup-006', 'h-vi'],
  ['Pool towels', 'LIN-PT', 'Linen', 'pcs', 60, 150, 3800, 0, 'sup-001', 'h-epe'],
  ['Pool chlorine', 'MNT-PC', 'Maintenance', 'kg', 30, 50, 5200, 24, 'sup-008', 'h-epe'],
  ['Bottled water 75cl', 'FNB-WT', 'Food & Beverage', 'pcs', 100, 300, 380, 280, 'sup-006', 'h-epe'],
];

const item = (n: number, sp: Spec): InventoryItem => ({ id: `inv-${pad(n)}`, hotelId: sp[9], sku: sp[1], name: sp[0], category: sp[2], unit: sp[3], stock: 0, reorderLevel: sp[4], reorderQty: sp[5], unitCost: sp[6], supplierId: sp[8] });

const line = (itemId: string, qty: number, received: number, unitCost: number) => ({ itemId, qty, received, unitCost });
const id = (n: number) => `inv-${pad(n)}`;

const po = (n: number, hotelId: string, supplierId: string, status: PurchaseOrder['status'], created: number, expected: number, lines: PurchaseOrder['lines'], notes?: string): PurchaseOrder => ({
  id: `po-${pad(n)}`, reference: `PO-${yyMM}-${pad(n)}`, hotelId, supplierId, status, createdAt: d(created), expectedDate: d(expected), lines, notes,
});

export const mockPurchaseOrders: PurchaseOrder[] = [
  po(1, 'h-vi', 'sup-001', 'received', -16, -12, [line(id(1), 150, 150, 4500), line(id(2), 60, 60, 7800)]),
  po(2, 'h-vi', 'sup-004', 'received', -10, -8, [line(id(9), 200, 200, 1450), line(id(11), 60, 60, 2600)]),
  po(3, 'h-vi', 'sup-006', 'partially_received', -6, -3, [line(id(12), 600, 400, 380), line(id(13), 20, 20, 9500)], 'Balance of water to follow.'),
  po(4, 'h-vi', 'sup-005', 'ordered', -2, 1, [line(id(10), 120, 0, 3800)]),
  po(5, 'h-vi', 'sup-002', 'ordered', -1, 3, [line(id(6), 40, 0, 2200), line(id(7), 40, 0, 1800)]),
  po(6, 'h-vi', 'sup-003', 'draft', 0, 3, [line(id(3), 600, 0, 180), line(id(4), 600, 0, 170), line(id(5), 800, 0, 90)], 'Raised from low-stock alert.'),
  po(7, 'h-epe', 'sup-008', 'ordered', -4, 0, [line(id(15), 50, 0, 5200)]),
  po(8, 'h-epe', 'sup-001', 'draft', 0, 4, [line(id(14), 150, 0, 3800)], 'Pool towels are out of stock.'),
  po(9, 'h-vi', 'sup-007', 'cancelled', -20, -15, [line(id(8), 100, 0, 1500)], 'Superseded by stock on hand.'),
];

/** Opening stock is derived so that opening + all movements equals today's target stock. */
export const { mockInventory, mockMovements } = (() => {
  const items = SPECS.map((sp, i) => item(i + 1, sp));
  const moves: StockMovement[] = [];
  const staff = ['Blessing Ojo', 'Kunle Raji', 'Ifeoma Nwankwo', 'Sani Abubakar'];
  const add = (it: InventoryItem, offset: number, change: number, type: StockMovement['type'], reason: string, reference?: string) =>
    moves.push({ id: `mv-${pad(moves.length + 1, 4)}`, itemId: it.id, hotelId: it.hotelId, date: d(offset), change, type, reason, reference, by: staff[moves.length % staff.length] });

  for (const p of mockPurchaseOrders) {
    for (const l of p.lines) if (l.received > 0) add(items.find((x) => x.id === l.itemId)!, p.status === 'received' ? p.expectedDate === d(-12) ? -12 : -8 : -3, l.received, 'delivery', `Delivery against ${p.reference}`, p.reference);
  }
  items.forEach((it, i) => {
    const target = SPECS[i][7];
    const use = Math.ceil(it.reorderLevel * 0.16) + ((i * 3) % 7);
    [[-2, 'Daily consumption'], [-7, 'Weekly issue'], [-14, 'Weekly issue']].forEach(([o, r]) => add(it, o as number, -use, 'usage', r as string));
    if (i === 2) add(it, -5, -6, 'adjustment', 'Stock count variance');
    const net = moves.filter((m) => m.itemId === it.id).reduce((s, m) => s + m.change, 0);
    const opening = Math.max(0, target - net);
    it.stock = opening + net;
  });
  moves.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  return { mockInventory: items, mockMovements: moves };
})();
