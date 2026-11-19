export type LegacyRole = 'general_manager' | 'front_desk' | 'housekeeping' | 'accountant' | 'restaurant';
export type Role = LegacyRole | 'hotel_owner' | 'hotel_administrator' | 'receptionist' | 'housekeeping_manager' | 'maintenance_manager' | 'maintenance_staff' | 'restaurant_manager' | 'inventory_manager' | 'human_resources_manager' | 'staff_member';

export const ROLE_LABELS: Record<Role, string> = {
  hotel_owner: 'Hotel Owner',
  general_manager: 'General Manager',
  hotel_administrator: 'Hotel Administrator',
  front_desk: 'Front Desk',
  receptionist: 'Receptionist',
  housekeeping_manager: 'Housekeeping Manager',
  housekeeping: 'Housekeeping',
  maintenance_manager: 'Maintenance Manager',
  maintenance_staff: 'Maintenance Staff',
  restaurant_manager: 'Restaurant Manager',
  accountant: 'Accountant',
  restaurant: 'Restaurant',
  inventory_manager: 'Inventory Manager',
  human_resources_manager: 'Human Resources Manager',
  staff_member: 'Staff Member',
};

export const LEGACY_ROLE_LABELS: Record<LegacyRole, string> = {
  general_manager: 'General Manager', front_desk: 'Front Desk', housekeeping: 'Housekeeping', accountant: 'Accountant', restaurant: 'Restaurant',
};

export interface Session {
  name: string;
  email: string;
  role: Role;
  remember: boolean;
}

/** ISO calendar date, YYYY-MM-DD */
export type IsoDate = string;

export interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  timezone: string;
  stars: number;
}

export interface RoomCategory {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  capacity: number;
  bedConfiguration: string;
  amenities: string[];
}

export type RoomStatus =
  | 'available'
  | 'reserved'
  | 'occupied'
  | 'dirty'
  | 'cleaning'
  | 'inspected'
  | 'maintenance'
  | 'out_of_service';

export interface Room {
  id: string;
  hotelId: string;
  number: string;
  floor: number;
  categoryId: string;
  status: RoomStatus;
}

export interface Guest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  vip: boolean;
  idType: 'Passport' | 'National ID' | "Driver's licence";
  idNumber: string;
  preferences: string[];
  contactPreference?: 'email' | 'phone' | 'either';
  createdAt: IsoDate;
}

export type ReservationStatus =
  | 'pending'
  | 'expired'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export interface Reservation {
  id: string;
  reference: string;
  guestId: string;
  hotelId: string;
  roomId: string;
  categoryId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  status: ReservationStatus;
  nightlyRate: number;
  total: number;
  deposit: number;
  paid: number;
  createdAt: IsoDate;
  /** Optional expiration for a public demo booking hold. History is retained after expiry. */
  holdExpiresAt?: string;
  /** Room tax configuration captured when this reservation was priced. */
  roomTaxRate?: number;
  roomServiceChargeRate?: number;
  roomTaxInclusive?: boolean;
  notes?: string;
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'champagne';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  tone: Tone;
  to?: string;
}

export type PaymentMethod = 'cash' | 'pos' | 'bank_transfer' | 'online';
export type PaymentStatus = 'paid' | 'partially_paid' | 'pending' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  reference: string;
  reservationId: string;
  guestId: string;
  hotelId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: IsoDate;
  currency?: string;
  receiptId?: string;
  receiptReference?: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  text: string;
  kind: 'booking' | 'room' | 'payment' | 'system';
}

export interface MaintenanceRecord {
  id: string;
  roomId: string;
  date: IsoDate;
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  cost: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type ChargeCategory = 'room' | 'restaurant' | 'laundry' | 'room_service' | 'other';

export interface FolioCharge {
  id: string;
  reservationId: string;
  date: IsoDate;
  category: ChargeCategory;
  description: string;
  amount: number;
  currency?: string;
  kind?: 'room' | 'service' | 'adjustment';
  reason?: string;
}

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed';

export interface Refund {
  id: string;
  reference: string;
  reservationId: string;
  guestId: string;
  hotelId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  requestedAt: IsoDate;
  paymentId?: string;
  currency?: string;
}

export interface Expense {
  id: string;
  hotelId: string;
  date: IsoDate;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  status: 'paid' | 'pending';
}

export interface GuestNote {
  id: string;
  guestId: string;
  date: IsoDate;
  author: string;
  kind: 'note' | 'complaint' | 'request';
  text: string;
  resolved?: boolean;
}

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface StaffMember {
  id: string;
  name: string;
  title: string;
  department: Department;
  hotelId: string;
  phone: string;
  email: string;
  status: 'active' | 'on_leave' | 'inactive';
  monthlySalary: number;
  hiredAt: IsoDate;
}

export type Department = 'Management' | 'Front Desk' | 'Housekeeping' | 'Maintenance' | 'Restaurant' | 'Finance' | 'Security';

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'inspected';

export interface HousekeepingTask {
  id: string;
  hotelId: string;
  roomId: string;
  type: 'turnover' | 'daily' | 'deep';
  priority: Priority;
  status: TaskStatus;
  assigneeId?: string;
  date: IsoDate;
  dueAt?: IsoDate;
  completedAt?: IsoDate;
  notes?: string;
}

export interface InspectionRecord {
  id: string;
  taskId: string;
  roomId: string;
  hotelId: string;
  date: IsoDate;
  inspectorId: string;
  result: 'passed' | 'failed';
  score: number;
  notes?: string;
}

export interface SupplyNote {
  id: string;
  hotelId: string;
  item: string;
  level: 'ok' | 'low' | 'out';
  note: string;
  date: IsoDate;
}

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'awaiting_parts' | 'completed' | 'resolved';

export interface MaintenanceRequest {
  id: string;
  hotelId: string;
  roomId?: string;
  location?: string;
  workOrderId?: string;
  dueAt?: IsoDate;
  category: string;
  priority: Priority;
  status: MaintenanceStatus;
  assigneeId?: string;
  title?: string;
  description: string;
  costEstimate: number;
  resolutionNotes?: string;
  /** Takes the room out of sale until the request is resolved. */
  blocksRoom: boolean;
  createdAt: IsoDate;
  resolvedAt?: IsoDate;
}

export type MenuCategory = 'Starters' | 'Mains' | 'Desserts' | 'Beverages';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  price: number;
  available: boolean;
  prepMinutes: number;
}

export interface RestaurantTable {
  id: string;
  hotelId: string;
  number: string;
  seats: number;
  area: 'Indoor' | 'Terrace' | 'Bar';
  /** Stored state; "occupied" is derived from open orders. */
  status: 'free' | 'reserved' | 'cleaning';
}

export interface OrderLine { menuItemId: string; name: string; price: number; qty: number }

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface RestaurantOrder {
  id: string;
  reference: string;
  hotelId: string;
  type: 'dine_in' | 'room_service';
  tableId?: string;
  roomId?: string;
  reservationId?: string;
  guestName: string;
  covers?: number;
  lines: OrderLine[];
  status: OrderStatus;
  payment: 'open' | 'paid' | 'charged_to_room';
  method?: PaymentMethod;
  chargedReservationId?: string;
  notes?: string;
  createdAt: IsoDate;
  time: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: string;
  leadDays: number;
  status: 'active' | 'inactive';
}

export interface InventoryItem {
  id: string;
  hotelId: string;
  sku: string;
  name: string;
  category: 'Food & Beverage' | 'Housekeeping' | 'Linen' | 'Toiletries' | 'Maintenance' | 'Cleaning';
  unit: string;
  stock: number;
  reorderLevel: number;
  reorderQty: number;
  unitCost: number;
  supplierId: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  hotelId: string;
  date: IsoDate;
  /** Signed: deliveries are positive, usage negative, counts may be either. */
  change: number;
  type: 'delivery' | 'usage' | 'adjustment';
  reason: string;
  reference?: string;
  by: string;
}

export type PurchaseStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseLine { itemId: string; qty: number; unitCost: number; received: number }

export interface PurchaseOrder {
  id: string;
  reference: string;
  hotelId: string;
  supplierId: string;
  status: PurchaseStatus;
  createdAt: IsoDate;
  expectedDate: IsoDate;
  lines: PurchaseLine[];
  notes?: string;
}

export type ShiftType = 'morning' | 'afternoon' | 'night';

/** A working shift. No record for a date means the person is off. */
export interface ShiftAssignment { id: string; staffId: string; date: IsoDate; shift: ShiftType }

export interface AttendanceRecord {
  id: string;
  staffId: string;
  date: IsoDate;
  status: 'present' | 'late' | 'absent' | 'leave';
  clockIn?: string;
  clockOut?: string;
}

export type LeaveType = 'annual' | 'sick' | 'unpaid';

export interface LeaveRequest {
  id: string;
  staffId: string;
  type: LeaveType;
  start: IsoDate;
  end: IsoDate;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
}

export interface PayrollAdjustment { id: string; month: string; staffId: string; label: string; amount: number }
export interface PayrollRun { month: string; status: 'draft' | 'approved' | 'paid' }
