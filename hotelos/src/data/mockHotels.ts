import type { Hotel } from '@/types';

export const mockHotels: Hotel[] = [
  {
    id: 'h-vi',
    name: 'Lagoon House Victoria Island',
    city: 'Lagos',
    address: '14 Adetokunbo Ademola Street, Victoria Island, Lagos',
    phone: '+234 1 700 4100',
    email: 'vi@lagoonhouse.example',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    stars: 5,
  },
  {
    id: 'h-epe',
    name: 'Palm Bay Resort Epe',
    city: 'Epe',
    address: '2 Lekki-Epe Expressway, Epe, Lagos',
    phone: '+234 1 700 4200',
    email: 'epe@palmbay.example',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    stars: 4,
  },
];

export const hotelName = (id: string) => mockHotels.find((h) => h.id === id)?.name ?? id;
export const hotelShortName = (id: string) => (id === 'h-vi' ? 'Victoria Island' : id === 'h-epe' ? 'Epe' : id);
