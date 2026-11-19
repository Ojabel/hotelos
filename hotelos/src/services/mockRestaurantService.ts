import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import type { MenuItem, OrderStatus, PaymentMethod, RestaurantOrder, RestaurantTable, Result } from '@/types';
import { delay } from './delay';
import { addCharge } from './mockPaymentService';

/** MOCK SERVICE — backend integration point for the restaurant and room service. */
export const orderTotal = (o: Pick<RestaurantOrder, 'lines'>) => o.lines.reduce((s, l) => s + l.price * l.qty, 0);
export const isOpenOrder = (o: RestaurantOrder) => o.status !== 'cancelled' && o.payment === 'open';
const nextNum = (ids: string[], prefix: string) => Math.max(0, ...ids.map((i) => Number(i.replace(prefix, '')) || 0)) + 1;

/** "occupied" is derived: a dine-in table with an open, uncancelled order. */
export function tableState(table: RestaurantTable, orders: RestaurantOrder[]): 'free' | 'reserved' | 'cleaning' | 'occupied' {
  return orders.some((o) => o.tableId === table.id && o.type === 'dine_in' && isOpenOrder(o)) ? 'occupied' : table.status;
}

// ---------- menu ----------
export async function saveMenuItem(input: Omit<MenuItem, 'id'> & { id?: string }): Promise<Result<MenuItem>> {
  await delay(250);
  if (!input.name.trim()) return { ok: false, error: 'Enter a name.' };
  if (!Number.isFinite(input.price) || input.price <= 0) return { ok: false, error: 'Enter a price above zero.' };
  if (!Number.isFinite(input.prepMinutes) || input.prepMinutes < 1) return { ok: false, error: 'Preparation time must be at least one minute.' };
  const s = useHotelStore.getState();
  if (s.menu.some((m) => m.id !== input.id && m.name.toLowerCase() === input.name.trim().toLowerCase())) return { ok: false, error: 'An item with this name already exists.' };
  const item: MenuItem = { ...input, id: input.id ?? `mn-${String(nextNum(s.menu.map((m) => m.id), 'mn-')).padStart(3, '0')}`, name: input.name.trim(), price: Math.round(input.price) };
  s.setMenu((ms) => (input.id ? ms.map((m) => (m.id === input.id ? item : m)) : [...ms, item]));
  return { ok: true, value: item };
}

export function setMenuAvailability(id: string, available: boolean) {
  useHotelStore.getState().setMenu((ms) => ms.map((m) => (m.id === id ? { ...m, available } : m)));
}

export async function deleteMenuItem(id: string): Promise<Result<true>> {
  await delay(250);
  const s = useHotelStore.getState();
  const item = s.menu.find((m) => m.id === id);
  if (!item) return { ok: false, error: 'Item not found.' };
  if (s.orders.some((o) => isOpenOrder(o) && o.lines.some((l) => l.menuItemId === id))) return { ok: false, error: `${item.name} is on an open order. Mark it unavailable instead.` };
  s.setMenu((ms) => ms.filter((m) => m.id !== id));
  return { ok: true, value: true };
}

// ---------- orders ----------
export interface OrderInput {
  hotelId: string;
  type: 'dine_in' | 'room_service';
  tableId?: string;
  roomId?: string;
  guestName?: string;
  covers?: number;
  lines: Array<{ menuItemId: string; qty: number }>;
  notes?: string;
}

function buildLines(lines: OrderInput['lines']): Result<RestaurantOrder['lines']> {
  const { menu } = useHotelStore.getState();
  if (lines.length === 0 || lines.every((l) => l.qty <= 0)) return { ok: false, error: 'Add at least one item.' };
  const out: RestaurantOrder['lines'] = [];
  for (const l of lines.filter((x) => x.qty > 0)) {
    const item = menu.find((m) => m.id === l.menuItemId);
    if (!item) return { ok: false, error: 'An item on this order no longer exists.' };
    if (!item.available) return { ok: false, error: `${item.name} is not available right now.` };
    if (!Number.isInteger(l.qty)) return { ok: false, error: 'Quantities must be whole numbers.' };
    out.push({ menuItemId: item.id, name: item.name, price: item.price, qty: l.qty });
  }
  return { ok: true, value: out };
}

export async function createOrder(input: OrderInput): Promise<Result<RestaurantOrder>> {
  await delay(300);
  const s = useHotelStore.getState();
  const built = buildLines(input.lines);
  if (!built.ok) return built;
  let tableId: string | undefined, roomId: string | undefined, reservationId: string | undefined, guestName = input.guestName?.trim() || 'Walk-in';

  if (input.type === 'dine_in') {
    const table = s.tables.find((t) => t.id === input.tableId);
    if (!table || table.hotelId !== input.hotelId) return { ok: false, error: 'Choose a table at this property.' };
    if (tableState(table, s.orders) === 'occupied') return { ok: false, error: `Table ${table.number} already has an open order.` };
    if (table.status === 'cleaning') return { ok: false, error: `Table ${table.number} is being cleaned.` };
    if (!input.covers || input.covers < 1) return { ok: false, error: 'Enter the number of guests.' };
    if (input.covers > table.seats) return { ok: false, error: `Table ${table.number} seats ${table.seats}.` };
    tableId = table.id;
  } else {
    const stay = s.reservations.find((r) => r.roomId === input.roomId && r.status === 'checked_in');
    if (!stay) return { ok: false, error: 'Room service is only available to in-house guests.' };
    roomId = stay.roomId; reservationId = stay.id; guestName = s.guests.find((g) => g.id === stay.guestId)?.fullName ?? guestName;
  }

  const n = nextNum(s.orders.map((o) => o.id), 'ord-');
  const order: RestaurantOrder = { id: `ord-${String(n).padStart(4, '0')}`, reference: `ORD-${String(n).padStart(4, '0')}`, hotelId: input.hotelId, type: input.type, tableId, roomId, reservationId, guestName, covers: input.type === 'dine_in' ? input.covers : undefined, lines: built.value, status: 'new', payment: 'open', notes: input.notes?.trim() || undefined, createdAt: today(), time: 'Just now' };
  s.setOrders((os) => [order, ...os]);
  s.log(`${order.reference} placed (${input.type === 'dine_in' ? `table ${s.tables.find((t) => t.id === tableId)?.number}` : `room ${s.rooms.find((r) => r.id === roomId)?.number}`})`, 'system');
  return { ok: true, value: order };
}

export async function updateOrderLines(orderId: string, lines: OrderInput['lines'], notes?: string): Promise<Result<RestaurantOrder>> {
  await delay(250);
  const s = useHotelStore.getState();
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'new') return { ok: false, error: 'The kitchen has started this order. Place a new order for extra items.' };
  const built = buildLines(lines);
  if (!built.ok) return built;
  const updated = { ...order, lines: built.value, notes: notes?.trim() || undefined };
  s.setOrders((os) => os.map((o) => (o.id === orderId ? updated : o)));
  return { ok: true, value: updated };
}

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: 'preparing', preparing: 'ready', ready: 'served' };

export async function advanceOrder(orderId: string): Promise<Result<RestaurantOrder>> {
  await delay(200);
  const s = useHotelStore.getState();
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  const next = NEXT[order.status];
  if (!next) return { ok: false, error: `A ${order.status} order cannot be advanced.` };
  const updated = { ...order, status: next };
  s.setOrders((os) => os.map((o) => (o.id === orderId ? updated : o)));
  return { ok: true, value: updated };
}

export async function cancelOrder(orderId: string): Promise<Result<RestaurantOrder>> {
  await delay(250);
  const s = useHotelStore.getState();
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'new' && order.status !== 'preparing') return { ok: false, error: 'Only new or preparing orders can be cancelled.' };
  const updated = { ...order, status: 'cancelled' as const };
  s.setOrders((os) => os.map((o) => (o.id === orderId ? updated : o)));
  s.log(`${order.reference} cancelled`, 'system');
  return { ok: true, value: updated };
}

export async function payOrder(orderId: string, method: PaymentMethod): Promise<Result<RestaurantOrder>> {
  await delay(300);
  const s = useHotelStore.getState();
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'served') return { ok: false, error: 'An order can be settled once it has been served.' };
  if (order.payment !== 'open') return { ok: false, error: 'This order has already been settled.' };
  const updated = { ...order, payment: 'paid' as const, method };
  s.setOrders((os) => os.map((o) => (o.id === orderId ? updated : o)));
  if (order.tableId) s.setTables((ts) => ts.map((t) => (t.id === order.tableId ? { ...t, status: 'cleaning' } : t)));
  s.log(`${order.reference} settled (${orderTotal(order).toLocaleString('en-NG')})`, 'payment');
  return { ok: true, value: updated };
}

/** Posts the order to an in-house guest's folio. Dine-in orders need the guest's reservation. */
export async function chargeOrderToRoom(orderId: string, reservationId?: string): Promise<Result<RestaurantOrder>> {
  await delay(300);
  const s = useHotelStore.getState();
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'served') return { ok: false, error: 'Charge an order to a room once it has been served.' };
  if (order.payment !== 'open') return { ok: false, error: order.payment === 'charged_to_room' ? 'This order has already been charged to a room.' : 'This order has already been paid.' };
  const resId = order.type === 'room_service' ? order.reservationId : reservationId;
  if (!resId) return { ok: false, error: 'Choose the in-house guest to charge.' };
  const res = s.reservations.find((r) => r.id === resId);
  if (!res || res.status !== 'checked_in') return { ok: false, error: 'That guest is no longer in-house.' };
  if (res.hotelId !== order.hotelId) return { ok: false, error: 'The guest is staying at a different property.' };

  const charge = await addCharge({ reservationId: resId, category: order.type === 'room_service' ? 'room_service' : 'restaurant', description: `${order.type === 'room_service' ? 'Room service' : 'Restaurant'} — ${order.reference}`, amount: orderTotal(order) });
  if (!charge.ok) return charge;
  const updated = { ...order, payment: 'charged_to_room' as const, chargedReservationId: resId };
  s.setOrders((os) => os.map((o) => (o.id === orderId ? updated : o)));
  if (order.tableId) s.setTables((ts) => ts.map((t) => (t.id === order.tableId ? { ...t, status: 'cleaning' } : t)));
  return { ok: true, value: updated };
}

// ---------- tables ----------
export async function setTableStatus(tableId: string, status: RestaurantTable['status']): Promise<Result<RestaurantTable>> {
  await delay(150);
  const s = useHotelStore.getState();
  const table = s.tables.find((t) => t.id === tableId);
  if (!table) return { ok: false, error: 'Table not found.' };
  if (tableState(table, s.orders) === 'occupied') return { ok: false, error: `Table ${table.number} has an open order. Settle or cancel it first.` };
  const updated = { ...table, status };
  s.setTables((ts) => ts.map((t) => (t.id === tableId ? updated : t)));
  return { ok: true, value: updated };
}
