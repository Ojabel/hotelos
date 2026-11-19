import { create } from 'zustand';
import { mockCharges } from '@/data/mockCharges';
import { mockExpenses } from '@/data/mockExpenses';
import { mockGuestNotes } from '@/data/mockGuestNotes';
import { mockGuests } from '@/data/mockGuests';
import { mockHousekeepingTasks, mockInspections, mockSupplyNotes } from '@/data/mockHousekeeping';
import { mockInventory, mockMovements, mockPurchaseOrders, mockSuppliers } from '@/data/mockInventory';
import { mockMaintenanceRequests } from '@/data/mockMaintenance';
import { mockMenu, mockOrders, mockTables } from '@/data/mockRestaurant';
import { mockStaff } from '@/data/mockStaff';
import { mockAdjustments, mockAttendance, mockLeave, mockPayrollRuns, mockRoster } from '@/data/mockWorkforce';
import { mockPayments } from '@/data/mockPayments';
import { mockRefunds } from '@/data/mockRefunds';
import { mockReservations } from '@/data/mockReservations';
import { mockRooms } from '@/data/mockRooms';
import { ROLE_LABELS, type ActivityItem, type Expense, type FolioCharge, type Guest, type GuestNote, type AttendanceRecord, type HousekeepingTask, type InspectionRecord, type InventoryItem, type LeaveRequest, type MaintenanceRequest, type PayrollAdjustment, type PayrollRun, type PurchaseOrder, type ShiftAssignment, type StockMovement, type Supplier, type MenuItem, type Payment, type Refund, type Reservation, type RestaurantOrder, type RestaurantTable, type Room, type StaffMember, type SupplyNote } from '@/types';
import { netPaidFor } from '@/utils/folio';
import { appendAuditEntry } from '@/services/mockAuditLog';
import { useAppStore } from '@/store/useAppStore';
import { createJSONStorage, persist } from 'zustand/middleware';
import { backendMode } from '@/services/api/backendMode';

/**
 * Local operational state shared across modules and persisted for the frontend demonstration.
 * Backend integration point: replace with API-backed queries.
 */
interface Data {
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  payments: Payment[];
  charges: FolioCharge[];
  refunds: Refund[];
  expenses: Expense[];
  guestNotes: GuestNote[];
  staff: StaffMember[];
  housekeepingTasks: HousekeepingTask[];
  inspections: InspectionRecord[];
  supplyNotes: SupplyNote[];
  maintenanceRequests: MaintenanceRequest[];
  menu: MenuItem[];
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  roster: ShiftAssignment[];
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  adjustments: PayrollAdjustment[];
  payrollRuns: PayrollRun[];
  activity: ActivityItem[];
}

interface HotelState extends Data {
  setRooms: (fn: (rooms: Room[]) => Room[]) => void;
  setReservations: (fn: (r: Reservation[]) => Reservation[]) => void;
  setGuests: (fn: (g: Guest[]) => Guest[]) => void;
  setPayments: (fn: (p: Payment[]) => Payment[]) => void;
  setCharges: (fn: (c: FolioCharge[]) => FolioCharge[]) => void;
  setRefunds: (fn: (r: Refund[]) => Refund[]) => void;
  setExpenses: (fn: (e: Expense[]) => Expense[]) => void;
  setGuestNotes: (fn: (n: GuestNote[]) => GuestNote[]) => void;
  setTasks: (fn: (t: HousekeepingTask[]) => HousekeepingTask[]) => void;
  setInspections: (fn: (i: InspectionRecord[]) => InspectionRecord[]) => void;
  setSupplyNotes: (fn: (n: SupplyNote[]) => SupplyNote[]) => void;
  setMaintenance: (fn: (m: MaintenanceRequest[]) => MaintenanceRequest[]) => void;
  setMenu: (fn: (m: MenuItem[]) => MenuItem[]) => void;
  setTables: (fn: (t: RestaurantTable[]) => RestaurantTable[]) => void;
  setOrders: (fn: (o: RestaurantOrder[]) => RestaurantOrder[]) => void;
  setStaff: (fn: (s: StaffMember[]) => StaffMember[]) => void;
  setSuppliers: (fn: (s: Supplier[]) => Supplier[]) => void;
  setInventory: (fn: (i: InventoryItem[]) => InventoryItem[]) => void;
  setMovements: (fn: (m: StockMovement[]) => StockMovement[]) => void;
  setPurchaseOrders: (fn: (p: PurchaseOrder[]) => PurchaseOrder[]) => void;
  setRoster: (fn: (r: ShiftAssignment[]) => ShiftAssignment[]) => void;
  setAttendance: (fn: (a: AttendanceRecord[]) => AttendanceRecord[]) => void;
  setLeave: (fn: (l: LeaveRequest[]) => LeaveRequest[]) => void;
  setAdjustments: (fn: (a: PayrollAdjustment[]) => PayrollAdjustment[]) => void;
  setPayrollRuns: (fn: (r: PayrollRun[]) => PayrollRun[]) => void;
  addGuest: (g: Guest) => void;
  addPayment: (p: Payment) => void;
  log: (text: string, kind: ActivityItem['kind']) => void;
  /** Restore the original seed data (used by tests and a future "reset demo" action). */
  reset: () => void;
}

const SEED_ACTIVITY: ActivityItem[] = [
  { id: 'a1', at: '08:05', text: 'Housekeeping assigned room 106 for cleaning', kind: 'room' },
  { id: 'a2', at: '07:40', text: 'Room 205 marked dirty', kind: 'room' },
  { id: 'a3', at: 'Yesterday', text: 'Deposit received for reservation HOS-2611-011', kind: 'payment' },
  { id: 'a4', at: '6 Nov', text: 'Adaeze Okonkwo checked in to room 101', kind: 'booking' },
  { id: 'a5', at: '5 Nov', text: 'Reservation for room 206 marked no-show and released', kind: 'booking' },
];

/** `paid` on a reservation always mirrors collected payments minus processed refunds. */
const initial = (): Data => ({
  rooms: mockRooms,
  reservations: mockReservations.map((r) => ({ ...r, paid: netPaidFor(r.id, mockPayments, mockRefunds) })),
  guests: mockGuests,
  payments: mockPayments,
  charges: mockCharges,
  refunds: mockRefunds,
  expenses: mockExpenses,
  guestNotes: mockGuestNotes,
  staff: mockStaff,
  housekeepingTasks: mockHousekeepingTasks,
  inspections: mockInspections,
  supplyNotes: mockSupplyNotes,
  maintenanceRequests: mockMaintenanceRequests,
  menu: mockMenu,
  tables: mockTables,
  orders: mockOrders,
  suppliers: mockSuppliers,
  inventory: mockInventory,
  movements: mockMovements,
  purchaseOrders: mockPurchaseOrders,
  roster: mockRoster,
  attendance: mockAttendance,
  leave: mockLeave,
  adjustments: mockAdjustments,
  payrollRuns: mockPayrollRuns,
  activity: SEED_ACTIVITY,
});

let activityCounter = 100;

const operationalStorage = {
  getItem: (name: string) => typeof localStorage === 'undefined' ? null : localStorage.getItem(name),
  setItem: (name: string, value: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(name, value); },
  removeItem: (name: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(name); },
};

export const useHotelStore = create<HotelState>()(persist((set) => ({
  ...initial(),
  setRooms: (fn) => set((s) => ({ rooms: fn(s.rooms) })),
  setReservations: (fn) => set((s) => ({ reservations: fn(s.reservations) })),
  setGuests: (fn) => set((s) => ({ guests: fn(s.guests) })),
  setPayments: (fn) => set((s) => ({ payments: fn(s.payments) })),
  setCharges: (fn) => set((s) => ({ charges: fn(s.charges) })),
  setRefunds: (fn) => set((s) => ({ refunds: fn(s.refunds) })),
  setExpenses: (fn) => set((s) => ({ expenses: fn(s.expenses) })),
  setGuestNotes: (fn) => set((s) => ({ guestNotes: fn(s.guestNotes) })),
  setTasks: (fn) => set((s) => ({ housekeepingTasks: fn(s.housekeepingTasks) })),
  setInspections: (fn) => set((s) => ({ inspections: fn(s.inspections) })),
  setSupplyNotes: (fn) => set((s) => ({ supplyNotes: fn(s.supplyNotes) })),
  setMaintenance: (fn) => set((s) => ({ maintenanceRequests: fn(s.maintenanceRequests) })),
  setMenu: (fn) => set((s) => ({ menu: fn(s.menu) })),
  setTables: (fn) => set((s) => ({ tables: fn(s.tables) })),
  setOrders: (fn) => set((s) => ({ orders: fn(s.orders) })),
  setStaff: (fn) => set((s) => ({ staff: fn(s.staff) })),
  setSuppliers: (fn) => set((s) => ({ suppliers: fn(s.suppliers) })),
  setInventory: (fn) => set((s) => ({ inventory: fn(s.inventory) })),
  setMovements: (fn) => set((s) => ({ movements: fn(s.movements) })),
  setPurchaseOrders: (fn) => set((s) => ({ purchaseOrders: fn(s.purchaseOrders) })),
  setRoster: (fn) => set((s) => ({ roster: fn(s.roster) })),
  setAttendance: (fn) => set((s) => ({ attendance: fn(s.attendance) })),
  setLeave: (fn) => set((s) => ({ leave: fn(s.leave) })),
  setAdjustments: (fn) => set((s) => ({ adjustments: fn(s.adjustments) })),
  setPayrollRuns: (fn) => set((s) => ({ payrollRuns: fn(s.payrollRuns) })),
  addGuest: (g) => set((s) => ({ guests: [g, ...s.guests] })),
  addPayment: (p) => set((s) => ({ payments: [p, ...s.payments] })),
  log: (text, kind) => {
    set((s) => ({ activity: [{ id: `a${++activityCounter}`, at: 'Just now', text, kind }, ...s.activity] }));
    const session = useAppStore.getState().session;
    const lower = text.toLowerCase();
    const module = lower.includes('refund') || lower.includes('payment') || lower.includes('expense') || kind === 'payment' ? 'Billing'
      : lower.includes('housekeep') || lower.includes('clean') || lower.includes('inspection') ? 'Housekeeping'
        : lower.includes('maintenance') || lower.includes('repair') ? 'Maintenance'
          : lower.includes('purchase order') || lower.includes('supplier') ? 'Procurement'
            : lower.includes('stock') || lower.includes('inventory') ? 'Inventory'
              : lower.includes('staff') || lower.includes('payroll') || lower.includes('leave') || lower.includes('attendance') ? 'Staff'
                : lower.includes('guest') ? 'Front desk'
                  : kind === 'booking' ? 'Reservations' : kind === 'room' ? 'Rooms' : 'Administration';
    const action = lower.includes('checked in') ? 'Guest check-in'
      : lower.includes('checked out') ? 'Guest check-out'
        : lower.includes('reservation') && lower.includes('created') ? 'Reservation created'
          : lower.includes('reservation') && lower.includes('modified') ? 'Reservation modified'
            : lower.includes('refund') ? 'Refund updated'
              : lower.includes('payment') ? 'Payment recorded'
                : lower.includes('purchase order') ? 'Purchase order updated'
                  : lower.includes('maintenance') ? 'Maintenance updated'
                    : lower.includes('clean') || lower.includes('housekeep') ? 'Housekeeping updated'
                      : lower.includes('room') ? 'Room status changed' : 'Operational activity';
    appendAuditEntry({ user: session?.name ?? 'Demo user', role: session ? ROLE_LABELS[session.role] : 'Staff member', action, module, description: text, related: 'Demo activity', status: 'Success' });
  },
  reset: () => set(initial()),
}), {
  name: backendMode ? 'hotelos-operational-backend-cache' : 'hotelos-operational-demo',
  storage: createJSONStorage(() => operationalStorage),
  partialize: (s) => ({ rooms: s.rooms, reservations: s.reservations, guests: s.guests, payments: s.payments, charges: s.charges, refunds: s.refunds, expenses: s.expenses, guestNotes: s.guestNotes, staff: s.staff, housekeepingTasks: s.housekeepingTasks, inspections: s.inspections, supplyNotes: s.supplyNotes, maintenanceRequests: s.maintenanceRequests, menu: s.menu, tables: s.tables, orders: s.orders, suppliers: s.suppliers, inventory: s.inventory, movements: s.movements, purchaseOrders: s.purchaseOrders, roster: s.roster, attendance: s.attendance, leave: s.leave, adjustments: s.adjustments, payrollRuns: s.payrollRuns, activity: s.activity }),
}));
