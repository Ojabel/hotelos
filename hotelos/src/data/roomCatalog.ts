import type { RoomCategory } from '@/types';

export const ROOM_CATEGORIES: RoomCategory[] = [
  { id: 'cat-std', name: 'Standard Room', description: 'Quiet, well-appointed room for solo travellers and couples.', basePrice: 65000, capacity: 2, bedConfiguration: '1 Queen bed', amenities: ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Work desk'] },
  { id: 'cat-sup', name: 'Superior Room', description: 'Larger room with a seating area and city or garden views.', basePrice: 85000, capacity: 2, bedConfiguration: '1 King bed', amenities: ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Minibar', 'Seating area'] },
  { id: 'cat-dlx', name: 'Deluxe King', description: 'Spacious king room with premium bedding and a rain shower.', basePrice: 120000, capacity: 3, bedConfiguration: '1 King bed + sofa bed', amenities: ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Minibar', 'Rain shower', 'Coffee machine'] },
  { id: 'cat-fam', name: 'Family Room', description: 'Two-bed layout designed for families travelling together.', basePrice: 140000, capacity: 4, bedConfiguration: '2 Queen beds', amenities: ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Minibar', 'Connecting option'] },
  { id: 'cat-exe', name: 'Executive Suite', description: 'Separate living room, executive lounge access and late check-out.', basePrice: 185000, capacity: 3, bedConfiguration: '1 King bed + living room', amenities: ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Minibar', 'Lounge access', 'Bathtub'] },
  { id: 'cat-pres', name: 'Presidential Suite', description: 'Top-floor suite with private dining area and butler service.', basePrice: 450000, capacity: 4, bedConfiguration: '1 King bed + 1 twin room', amenities: ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Minibar', 'Butler service', 'Private dining', 'Bathtub'] },
];

export const categoryById = (id: string) => ROOM_CATEGORIES.find((c) => c.id === id)!;

/** Physical inventory: 22 rooms at Victoria Island, 8 at Epe. */
export interface RoomSpec {
  number: string;
  hotelId: string;
  floor: number;
  categoryId: string;
}

const vi = (number: string, categoryId: string): RoomSpec => ({
  number,
  hotelId: 'h-vi',
  floor: Math.floor(Number(number) / 100),
  categoryId,
});
const epe = (number: string, categoryId: string): RoomSpec => ({ number, hotelId: 'h-epe', floor: 1, categoryId });

export const ROOM_SPECS: RoomSpec[] = [
  vi('101', 'cat-std'), vi('102', 'cat-std'), vi('103', 'cat-std'), vi('104', 'cat-sup'), vi('105', 'cat-sup'), vi('106', 'cat-fam'),
  vi('201', 'cat-sup'), vi('202', 'cat-sup'), vi('203', 'cat-dlx'), vi('204', 'cat-dlx'), vi('205', 'cat-fam'), vi('206', 'cat-dlx'),
  vi('301', 'cat-dlx'), vi('302', 'cat-dlx'), vi('303', 'cat-exe'), vi('304', 'cat-exe'), vi('305', 'cat-exe'), vi('306', 'cat-fam'),
  vi('401', 'cat-pres'), vi('402', 'cat-exe'), vi('403', 'cat-exe'), vi('404', 'cat-pres'),
  epe('B1', 'cat-sup'), epe('B2', 'cat-sup'), epe('B3', 'cat-sup'), epe('B4', 'cat-sup'),
  epe('B5', 'cat-dlx'), epe('B6', 'cat-dlx'), epe('B7', 'cat-fam'), epe('B8', 'cat-fam'),
];

export const roomIdFromNumber = (number: string) => `rm-${number.toLowerCase()}`;
