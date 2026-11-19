import type { MenuItem, OrderLine, RestaurantOrder, RestaurantTable } from '@/types';
import { DEMO_TODAY } from '@/utils/demoClock';

const m = (n: number, name: string, category: MenuItem['category'], price: number, prepMinutes: number, description: string, available = true): MenuItem => ({ id: `mn-${String(n).padStart(3, '0')}`, name, category, price, prepMinutes, description, available });

export const mockMenu: MenuItem[] = [
  m(1, 'Goat Meat Pepper Soup', 'Starters', 6500, 12, 'Traditional spiced broth with scent leaf.'),
  m(2, 'Suya Skewers', 'Starters', 5500, 15, 'Grilled beef with yaji spice and onions.'),
  m(3, 'Prawn Cocktail', 'Starters', 8500, 8, 'Tiger prawns, avocado and Marie Rose sauce.'),
  m(4, 'Garden Salad', 'Starters', 4500, 6, 'Seasonal leaves, tomato, cucumber, house dressing.'),
  m(5, 'Jollof Rice & Grilled Chicken', 'Mains', 9500, 20, 'Smoky party jollof with charcoal-grilled chicken.'),
  m(6, 'Ofada Rice & Ayamase', 'Mains', 10500, 25, 'Local rice with green pepper stew.'),
  m(7, 'Pan-seared Sea Bass', 'Mains', 16500, 22, 'Lemon butter, sautéed greens, plantain.'),
  m(8, 'Beef Fillet', 'Mains', 19500, 25, '250g fillet, peppercorn sauce, truffle mash.'),
  m(9, 'Vegetable Stir-fry', 'Mains', 7500, 12, 'Wok vegetables with ginger and soy.'),
  m(10, 'Club Sandwich', 'Mains', 8000, 12, 'Chicken, egg, bacon, fries.'),
  m(11, 'Chocolate Fondant', 'Desserts', 6000, 14, 'Warm centre, vanilla ice cream.'),
  m(12, 'Fruit Platter', 'Desserts', 4500, 5, 'Seasonal tropical fruit.', false),
  m(13, 'Zobo Cooler', 'Beverages', 2500, 2, 'Chilled hibiscus infusion.'),
  m(14, 'Fresh Orange Juice', 'Beverages', 3000, 3, 'Cold-pressed.'),
  m(15, 'Americano', 'Beverages', 2800, 3, 'Double shot, hot water.'),
  m(16, 'Still Water', 'Beverages', 1200, 1, '750ml bottle.'),
  m(17, 'House Red Wine (glass)', 'Beverages', 7500, 2, 'South African Cabernet Sauvignon.'),
  m(18, 'Local Lager', 'Beverages', 3500, 1, 'Chilled 600ml.'),
];

const t = (hotelId: string, number: string, seats: number, area: RestaurantTable['area'], status: RestaurantTable['status'] = 'free'): RestaurantTable => ({ id: `tb-${hotelId === 'h-vi' ? 'vi' : 'epe'}-${number.toLowerCase()}`, hotelId, number, seats, area, status });

export const mockTables: RestaurantTable[] = [
  t('h-vi', 'T1', 2, 'Indoor'), t('h-vi', 'T2', 2, 'Indoor', 'cleaning'), t('h-vi', 'T3', 4, 'Indoor'), t('h-vi', 'T4', 4, 'Indoor', 'reserved'),
  t('h-vi', 'T5', 4, 'Terrace'), t('h-vi', 'T6', 6, 'Terrace'), t('h-vi', 'T7', 6, 'Indoor'), t('h-vi', 'T8', 2, 'Bar'), t('h-vi', 'T9', 8, 'Indoor'), t('h-vi', 'T10', 4, 'Terrace'),
  t('h-epe', 'E1', 4, 'Terrace'), t('h-epe', 'E2', 4, 'Terrace'), t('h-epe', 'E3', 6, 'Indoor'), t('h-epe', 'E4', 2, 'Bar'), t('h-epe', 'E5', 8, 'Indoor'), t('h-epe', 'E6', 4, 'Indoor'),
];

const find = (name: string) => mockMenu.find((x) => x.name === name)!;
const line = (name: string, qty: number): OrderLine => { const i = find(name); return { menuItemId: i.id, name: i.name, price: i.price, qty }; };

const o = (n: number, p: Omit<RestaurantOrder, 'id' | 'reference' | 'createdAt'>): RestaurantOrder => ({ id: `ord-${String(n).padStart(4, '0')}`, reference: `ORD-${String(n).padStart(4, '0')}`, createdAt: DEMO_TODAY, ...p });

export const mockOrders: RestaurantOrder[] = [
  o(1, { hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t3', guestName: 'Okafor party', covers: 3, lines: [line('Jollof Rice & Grilled Chicken', 2), line('Suya Skewers', 1), line('Zobo Cooler', 3)], status: 'preparing', payment: 'open', time: '12:40' }),
  o(2, { hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t5', guestName: 'Walk-in', covers: 4, lines: [line('Beef Fillet', 2), line('Pan-seared Sea Bass', 1), line('Garden Salad', 2), line('House Red Wine (glass)', 2)], status: 'new', payment: 'open', time: '12:52' }),
  o(3, { hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t1', guestName: 'Walk-in', covers: 2, lines: [line('Club Sandwich', 2), line('Americano', 2)], status: 'ready', payment: 'open', time: '12:35' }),
  o(4, { hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t7', guestName: 'Mitchell family', covers: 4, lines: [line('Ofada Rice & Ayamase', 2), line('Pan-seared Sea Bass', 1), line('Chocolate Fondant', 2), line('Fresh Orange Juice', 2)], status: 'served', payment: 'open', time: '11:50' }),
  o(5, { hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t2', guestName: 'Walk-in', covers: 2, lines: [line('Vegetable Stir-fry', 2), line('Still Water', 2)], status: 'served', payment: 'paid', method: 'cash', time: '11:10' }),
  o(6, { hotelId: 'h-vi', type: 'dine_in', tableId: 'tb-vi-t8', guestName: 'Walk-in', covers: 1, lines: [line('Local Lager', 2), line('Suya Skewers', 1)], status: 'served', payment: 'paid', method: 'pos', time: '10:30' }),
  o(7, { hotelId: 'h-vi', type: 'room_service', roomId: 'rm-101', reservationId: 'res-001', guestName: 'Adaeze Okonkwo', lines: [line('Club Sandwich', 1), line('Americano', 2), line('Fresh Orange Juice', 1)], status: 'new', payment: 'open', time: '12:55', notes: 'No mayonnaise.' }),
  o(8, { hotelId: 'h-vi', type: 'room_service', roomId: 'rm-102', reservationId: 'res-002', guestName: 'Tunde Bakare', lines: [line('Goat Meat Pepper Soup', 1), line('Jollof Rice & Grilled Chicken', 1)], status: 'preparing', payment: 'open', time: '12:30' }),
  o(9, { hotelId: 'h-vi', type: 'room_service', roomId: 'rm-401', reservationId: 'res-012', guestName: 'Yusuf Garba', lines: [line('Beef Fillet', 1), line('House Red Wine (glass)', 1)], status: 'ready', payment: 'open', time: '12:15' }),
  o(10, { hotelId: 'h-vi', type: 'room_service', roomId: 'rm-203', reservationId: 'res-006', guestName: 'Chidi Eze', lines: [line('Garden Salad', 1), line('Still Water', 1)], status: 'served', payment: 'open', time: '10:45' }),
  o(11, { hotelId: 'h-epe', type: 'dine_in', tableId: 'tb-epe-e2', guestName: 'Walk-in', covers: 3, lines: [line('Ofada Rice & Ayamase', 2), line('Local Lager', 2)], status: 'preparing', payment: 'open', time: '12:20' }),
];
