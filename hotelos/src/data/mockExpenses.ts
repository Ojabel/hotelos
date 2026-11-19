import type { Expense, PaymentMethod } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';

const ROWS: Array<[string, string, string, number]> = [
  ['Utilities', 'Eko Electricity Distribution', 'Electricity — grid and standby', 1850000],
  ['Utilities', 'Lagos Water Corporation', 'Water supply', 260000],
  ['Utilities', 'Diesel Depot Ltd', 'Generator diesel — 3,000 litres', 2400000],
  ['Supplies', 'Crown Linens', 'Bed linen replacement', 780000],
  ['Supplies', 'CleanPro Nigeria', 'Housekeeping consumables', 340000],
  ['Supplies', 'Guest Amenities Co.', 'Toiletries and amenities', 410000],
  ['Food & Beverage', 'Mile 12 Fresh Produce', 'Weekly produce order', 520000],
  ['Food & Beverage', 'Premium Meats Ltd', 'Protein supply', 690000],
  ['Food & Beverage', 'Bevco Distributors', 'Beverage restock', 880000],
  ['Maintenance', 'CoolAir Engineering', 'HVAC servicing — floors 1–2', 450000],
  ['Maintenance', 'PlumbRight', 'Plumbing repairs', 95000],
  ['Maintenance', 'LiftTech Africa', 'Quarterly lift inspection', 320000],
  ['Marketing', 'Meridian Media', 'Online campaign — November', 600000],
  ['Marketing', 'TravelBridge Partners', 'Distribution commission', 380000],
  ['Security', 'Sentinel Guard Services', 'Security contract — monthly', 1250000],
  ['Insurance', 'Heritage Insurance', 'Property insurance instalment', 950000],
  ['IT & Software', 'CloudSuite Ltd', 'Software subscriptions', 210000],
  ['Laundry', 'Fresh Fold Laundry', 'Outsourced linen laundering', 360000],
  ['Staff Welfare', 'Greenfield Catering', 'Staff meals', 280000],
  ['Utilities', 'MTN Business', 'Internet and telephony', 330000],
];
const METHODS: PaymentMethod[] = ['bank_transfer', 'bank_transfer', 'pos', 'cash'];

export const mockExpenses: Expense[] = ROWS.map(([category, vendor, description, amount], i) => ({
  id: `ex-${String(i + 1).padStart(3, '0')}`,
  hotelId: i % 4 === 3 ? 'h-epe' : 'h-vi',
  date: addDays(DEMO_TODAY, -((i * 3) % 29)),
  category, vendor, description, amount,
  method: METHODS[i % METHODS.length],
  status: i % 7 === 6 ? 'pending' : 'paid',
}));
