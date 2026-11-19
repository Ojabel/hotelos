import type { Guest } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';

const PEOPLE: Array<[string, string]> = [
  ['Adaeze Okonkwo', 'Nigerian'], ['Tunde Bakare', 'Nigerian'], ['Folake Adeyemi', 'Nigerian'], ['Emeka Nwosu', 'Nigerian'],
  ['Zainab Bello', 'Nigerian'], ['Chidi Eze', 'Nigerian'], ['Ngozi Umeh', 'Nigerian'], ['Ibrahim Danjuma', 'Nigerian'],
  ['Kemi Adebayo', 'Nigerian'], ['Segun Ogunleye', 'Nigerian'], ['Amaka Obi', 'Nigerian'], ['Yusuf Garba', 'Nigerian'],
  ['Bisi Olawale', 'Nigerian'], ['Oluwaseun Coker', 'Nigerian'], ['Hauwa Sani', 'Nigerian'], ['Ifeanyi Anozie', 'Nigerian'],
  ['Temitope Alade', 'Nigerian'], ['Nkechi Okafor', 'Nigerian'], ['Damilola Fashola', 'Nigerian'], ['Uche Madu', 'Nigerian'],
  ['Sarah Mitchell', 'British'], ['James Whitfield', 'British'], ['Claire Dubois', 'French'], ['Lars Henriksen', 'Danish'],
  ['Priya Raman', 'Indian'], ['Arjun Mehta', 'Indian'], ['Kofi Mensah', 'Ghanaian'], ['Ama Owusu', 'Ghanaian'],
  ['Fatima El-Amin', 'Egyptian'], ['Daniel Kimani', 'Kenyan'], ['Grace Wanjiru', 'Kenyan'], ['Thabo Nkosi', 'South African'],
  ['Hannah Becker', 'German'], ['Marco Rossi', 'Italian'], ['Li Wei', 'Chinese'], ['Akiko Tanaka', 'Japanese'],
  ['Michael Carter', 'American'], ['Jessica Lang', 'American'], ['Omar Haddad', 'Lebanese'], ['Sofia Alvarez', 'Spanish'],
];

const ID_TYPES: Guest['idType'][] = ['Passport', 'National ID', "Driver's licence"];
const PREFS = ['High floor', 'Quiet room', 'Extra pillows', 'Early breakfast', 'Late check-out', 'Airport pickup', 'Feather-free bedding', 'Twin beds'];
const VIP_INDEXES = new Set([2, 7, 13, 21, 30]);

const pad = (n: number, w = 3) => String(n).padStart(w, '0');

export const mockGuests: Guest[] = PEOPLE.map(([fullName, nationality], i) => ({
  id: `g-${pad(i + 1)}`,
  fullName,
  email: `${fullName.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, '.')}@mail.example`,
  phone: `+234 80${(i % 9) + 1} ${pad(100 + ((i * 37) % 900))} ${pad(1000 + ((i * 113) % 9000), 4)}`,
  nationality,
  vip: VIP_INDEXES.has(i),
  idType: ID_TYPES[i % ID_TYPES.length],
  idNumber: `•••• ${pad(1000 + ((i * 271) % 9000), 4)}`,
  preferences: [PREFS[i % PREFS.length], PREFS[(i * 3 + 1) % PREFS.length]].filter((p, idx, a) => a.indexOf(p) === idx),
  createdAt: addDays(DEMO_TODAY, -(30 + i * 9)),
}));
