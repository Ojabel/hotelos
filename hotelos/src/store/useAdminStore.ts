import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LegacyRole, Role } from '@/types';
import { ROOM_CATEGORIES } from '@/data/roomCatalog';
import { mockHotels } from '@/data/mockHotels';

export const ADMIN_ROLES = [
  'Hotel Owner', 'General Manager', 'Hotel Administrator', 'Front Desk Manager', 'Receptionist', 'Accountant',
  'Housekeeping Manager', 'Housekeeping Staff', 'Maintenance Manager', 'Maintenance Staff', 'Restaurant Manager',
  'Restaurant Staff', 'Inventory Manager', 'Human Resources Manager', 'Staff Member',
] as const;
export type AdminRoleName = string;
export const MODULES = ['Dashboard', 'Front desk', 'Reservations', 'Rooms', 'Guests', 'Billing', 'Folios', 'Invoices', 'Payments', 'Refunds', 'Housekeeping', 'Maintenance', 'Restaurant', 'Inventory', 'Procurement', 'Expenses', 'Staff', 'Departments', 'Shifts', 'Attendance', 'Payroll', 'Reports', 'Settings', 'Access control', 'Audit logs'] as const;
export type PermissionModule = typeof MODULES[number];
export type PermissionAction = 'View' | 'Create' | 'Edit' | 'Delete' | 'Approve' | 'Export' | 'Manage';
export const ACTIONS: PermissionAction[] = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage'];
export type PermissionMap = Record<string, Partial<Record<PermissionModule, PermissionAction[]>>>;

const all: PermissionMap[string] = Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]));
const manager: PermissionMap[string] = Object.fromEntries(MODULES.map((m) => [m, m === 'Payroll' || m === 'Access control' ? ['View'] : m === 'Settings' ? ['View', 'Edit'] : ['View', 'Create', 'Edit', 'Approve', 'Export']]));
const frontDesk: PermissionMap[string] = Object.fromEntries(MODULES.map((m) => [m, ['Front desk', 'Reservations', 'Rooms', 'Guests'].includes(m) ? ['View', 'Create', 'Edit'] : []]));
const accountant: PermissionMap[string] = Object.fromEntries(MODULES.map((m) => [m, ['Dashboard', 'Billing', 'Folios', 'Invoices', 'Payments', 'Refunds', 'Reports', 'Expenses' as PermissionModule, 'Payroll'].includes(m) ? ['View', 'Create', 'Edit', 'Approve', 'Export'] : m === 'Settings' ? ['View', 'Edit'] : []]));
const housekeeper: PermissionMap[string] = Object.fromEntries(MODULES.map((m) => [m, ['Rooms', 'Housekeeping'].includes(m) ? ['View', 'Edit'] : []]));
const restaurant: PermissionMap[string] = Object.fromEntries(MODULES.map((m) => [m, ['Restaurant', 'Inventory'].includes(m) ? ['View', 'Create', 'Edit'] : []]));
const initialPermissions: PermissionMap = {
  'Hotel Owner': all, 'General Manager': manager, 'Hotel Administrator': manager,
  'Front Desk Manager': frontDesk, Receptionist: frontDesk, Accountant: accountant,
  'Housekeeping Manager': housekeeper, 'Housekeeping Staff': housekeeper,
  'Maintenance Manager': { ...housekeeper, Maintenance: ['View', 'Create', 'Edit', 'Approve'] }, 'Maintenance Staff': { ...housekeeper, Maintenance: ['View', 'Edit'] },
  'Restaurant Manager': restaurant, 'Restaurant Staff': restaurant,
  'Inventory Manager': { ...restaurant, Inventory: ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage'], Procurement: ['View', 'Create', 'Edit', 'Approve'] },
  'Human Resources Manager': { Staff: ['View', 'Create', 'Edit', 'Manage'], Departments: ['View', 'Edit'], Shifts: ['View', 'Create', 'Edit'], Attendance: ['View', 'Edit'], Payroll: [], 'Access control': [], 'Audit logs': [] },
  'Staff Member': {},
};
export const appRoleName: Record<Role, string> = {
  hotel_owner: 'Hotel Owner', general_manager: 'General Manager', hotel_administrator: 'Hotel Administrator',
  front_desk: 'Front Desk Manager', receptionist: 'Receptionist', housekeeping_manager: 'Housekeeping Manager', housekeeping: 'Housekeeping Staff',
  maintenance_manager: 'Maintenance Manager', maintenance_staff: 'Maintenance Staff', restaurant_manager: 'Restaurant Manager', restaurant: 'Restaurant Staff',
  accountant: 'Accountant', inventory_manager: 'Inventory Manager', human_resources_manager: 'Human Resources Manager', staff_member: 'Staff Member',
};
const legacyRoles: Record<Role, LegacyRole> = {
  hotel_owner: 'general_manager', general_manager: 'general_manager', hotel_administrator: 'general_manager',
  front_desk: 'front_desk', receptionist: 'front_desk', housekeeping_manager: 'housekeeping', housekeeping: 'housekeeping',
  maintenance_manager: 'housekeeping', maintenance_staff: 'housekeeping', restaurant_manager: 'restaurant', restaurant: 'restaurant',
  accountant: 'accountant', inventory_manager: 'restaurant', human_resources_manager: 'general_manager', staff_member: 'housekeeping',
};

export interface HotelSettings {
  profile: { name: string; description: string; email: string; phone: string; website: string; address: string; city: string; country: string; type: string; properties: number; logo: string };
  regional: { currency: string; timezone: string; dateFormat: string; timeFormat: string; language: string };
  tax: { name: string; percentage: number; serviceCharge: number; applicable: string[]; inclusive: boolean; active: boolean };
  roomCategories: Array<{ id: string; name: string; basePrice: number; capacity: number; bedConfiguration: string; amenities: string[]; active: boolean }>;
  pricing: { weekendPercent: number; additionalGuest: number; discountPercent: number; cancellationHours: number; ratePlan: string; season: string; seasonalPercent: number };
  notifications: Record<string, boolean>;
  preferences: { checkInTime: string; checkOutTime: string; bookingHoldMinutes: number; overbooking: boolean; guestIdRequired: boolean };
}

const firstHotel = mockHotels[0];
export const DEFAULT_SETTINGS: HotelSettings = {
  profile: { name: firstHotel.name, description: 'A considered city retreat with warm Nigerian hospitality.', email: firstHotel.email, phone: firstHotel.phone, website: 'https://lagoonhouse.example', address: firstHotel.address, city: firstHotel.city, country: 'Nigeria', type: 'Boutique hotel', properties: mockHotels.length, logo: '' },
  regional: { currency: firstHotel.currency, timezone: firstHotel.timezone, dateFormat: 'dd MMM yyyy', timeFormat: '24-hour', language: 'English' },
  tax: { name: 'Value Added Tax', percentage: 7.5, serviceCharge: 5, applicable: ['Room', 'Restaurant', 'Room service'], inclusive: false, active: true },
  roomCategories: ROOM_CATEGORIES.map((c) => ({ id: c.id, name: c.name, basePrice: c.basePrice, capacity: c.capacity, bedConfiguration: c.bedConfiguration, amenities: c.amenities, active: true })),
  pricing: { weekendPercent: 10, additionalGuest: 15000, discountPercent: 5, cancellationHours: 24, ratePlan: 'Best available rate', season: 'Peak season', seasonalPercent: 12 },
  notifications: { Reservations: true, 'Guest check-in': true, 'Guest check-out': true, Payments: true, Housekeeping: true, Maintenance: true, Inventory: true, Staff: false },
  preferences: { checkInTime: '14:00', checkOutTime: '11:00', bookingHoldMinutes: 15, overbooking: false, guestIdRequired: true },
};

interface AdminState {
  settings: HotelSettings;
  permissions: PermissionMap;
  roleActive: Record<string, boolean>;
  staffRoles: Record<string, string>;
  updateSettings: (settings: HotelSettings) => void;
  updatePermissions: (role: string, module: PermissionModule, action: PermissionAction, enabled: boolean) => void;
  setRoleActive: (role: string, active: boolean) => void;
  setStaffRole: (staffId: string, role: string) => void;
  addRole: (role: string) => void;
  duplicateRole: (source: string, target: string) => void;
  renameRole: (source: string, target: string) => void;
}

export const useAdminStore = create<AdminState>()(persist((set) => ({
  settings: DEFAULT_SETTINGS,
  permissions: initialPermissions,
  roleActive: Object.fromEntries(ADMIN_ROLES.map((r) => [r, true])),
  staffRoles: {},
  updateSettings: (settings) => set({ settings }),
  updatePermissions: (role, module, action, enabled) => set((s) => {
    const current = s.permissions[role]?.[module] ?? [];
    const actions = enabled ? [...new Set([...current, action])] : current.filter((a) => a !== action);
    return { permissions: { ...s.permissions, [role]: { ...s.permissions[role], [module]: actions } } };
  }),
  setRoleActive: (role, active) => set((s) => ({ roleActive: { ...s.roleActive, [role]: active } })),
  setStaffRole: (staffId, role) => set((s) => ({ staffRoles: { ...s.staffRoles, [staffId]: role } })),
  addRole: (role) => set((s) => ({ permissions: { ...s.permissions, [role]: {} }, roleActive: { ...s.roleActive, [role]: true } })),
  duplicateRole: (source, target) => set((s) => ({ permissions: { ...s.permissions, [target]: structuredClone(s.permissions[source] ?? {}) }, roleActive: { ...s.roleActive, [target]: true } })),
  renameRole: (source, target) => set((s) => {
    const permissions = { ...s.permissions, [target]: s.permissions[source] };
    const roleActive = { ...s.roleActive, [target]: s.roleActive[source] };
    delete permissions[source]; delete roleActive[source];
    return { permissions, roleActive, staffRoles: Object.fromEntries(Object.entries(s.staffRoles).map(([staffId, role]) => [staffId, role === source ? target : role])) };
  }),
}), { name: 'hotelos-admin', storage: createJSONStorage(() => localStorage) }));

export function permissionsForAppRole(role: Role, permissions = useAdminStore.getState().permissions) {
  return permissions[appRoleName[role]] ?? {};
}
export function appRoleForName(name: string): Role | undefined {
  return (Object.keys(appRoleName) as Role[]).find((role) => appRoleName[role] === name);
}
export function legacyRoleFor(role: Role): LegacyRole { return legacyRoles[role]; }

export function calculateConfiguredBreakdown(subtotal: number, settings = useAdminStore.getState().settings, serviceName = 'Room') {
  if (!settings.tax.active || !settings.tax.applicable.includes(serviceName)) return { total: subtotal, taxAmount: 0, serviceAmount: 0 };
  const taxable = settings.tax.inclusive ? subtotal / (1 + settings.tax.percentage / 100) : subtotal;
  const serviceAmount = Math.round(subtotal * settings.tax.serviceCharge / 100);
  const taxAmount = settings.tax.inclusive ? 0 : Math.round(taxable * settings.tax.percentage / 100);
  return { total: subtotal + taxAmount + serviceAmount, taxAmount, serviceAmount };
}

export function calculateConfiguredTotal(subtotal: number, settings = useAdminStore.getState().settings, serviceName = 'Room'): number {
  return calculateConfiguredBreakdown(subtotal, settings, serviceName).total;
}
