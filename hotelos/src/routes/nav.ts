import type { LucideIcon } from 'lucide-react';
import {
  Armchair, Banknote, BarChart3, Bell, BedDouble, BookOpen, Briefcase, Building2, CalendarCheck, CalendarDays,
  ClipboardList, Clock, ConciergeBell, CreditCard, Crown, FileText, FolderOpen, History, LayoutDashboard,
  LineChart, Map, Package, Percent, Receipt, Settings, ShieldCheck, ShoppingCart, SprayCan, Tag, Truck,
  Undo2, User, UserCheck, Users, Utensils, UtensilsCrossed, Wallet, Wrench,
} from 'lucide-react';
import type { Role } from '@/types';
import { appRoleName, legacyRoleFor, permissionsForAppRole, useAdminStore, type PermissionModule } from '@/store/useAdminStore';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  milestone: number;
  summary: string;
  roles?: Role[];
}
export interface NavGroup {
  id: string;
  label: string;
  roles: Role[];
  items: NavItem[];
}

const ALL: Role[] = ['general_manager', 'front_desk', 'housekeeping', 'accountant', 'restaurant'];
const GM: Role[] = ['general_manager'];
export const FINANCIAL_ROLES: Role[] = ['hotel_owner', 'general_manager', 'accountant'];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview', label: 'Overview', roles: ALL,
    items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, milestone: 2, summary: 'Occupancy, revenue, ADR, RevPAR, arrivals, departures and activity.', roles: FINANCIAL_ROLES }],
  },
  {
    id: 'operations', label: 'Hotel Operations', roles: ['general_manager', 'front_desk', 'housekeeping'],
    items: [
      { label: 'Front Desk', path: '/front-desk', icon: ConciergeBell, milestone: 3, summary: 'Arrivals, departures, in-house guests, check-in and check-out workflows.', roles: ['general_manager', 'front_desk'] },
      { label: 'Reservations', path: '/reservations', icon: CalendarCheck, milestone: 2, summary: 'Booking directory, filters, five-step booking form and status changes.', roles: ['general_manager', 'front_desk'] },
      { label: 'Booking Calendar', path: '/reservations/calendar', icon: CalendarDays, milestone: 2, summary: 'Month, week and day calendar with availability checks.', roles: ['general_manager', 'front_desk'] },
      { label: 'Rooms', path: '/rooms', icon: BedDouble, milestone: 2, summary: 'Room directory in table and grid views, with create, edit and status updates.' },
      { label: 'Floor Plan', path: '/rooms/floor-plan', icon: Map, milestone: 2, summary: 'Visual floor-by-floor room status map.' },
      { label: 'Housekeeping', path: '/housekeeping', icon: SprayCan, milestone: 4, summary: 'Cleaning tasks, assignments, priorities and inspections.' },
      { label: 'Maintenance', path: '/maintenance', icon: Wrench, milestone: 4, summary: 'Maintenance requests, technicians, costs and history.' },
    ],
  },
  {
    id: 'guests', label: 'Guest Management', roles: ['general_manager', 'front_desk'],
    items: [
      { label: 'Guests', path: '/guests', icon: Users, milestone: 3, summary: 'Guest directory, profiles, stay history, preferences and notes.' },
      { label: 'VIP Guests', path: '/guests/vip', icon: Crown, milestone: 3, summary: 'VIP guest list and special handling notes.' },
    ],
  },
  {
    id: 'finance', label: 'Revenue and Finance', roles: ['general_manager', 'accountant'],
    items: [
      { label: 'Billing', path: '/billing', icon: Receipt, milestone: 3, summary: 'Financial overview and outstanding balances.' },
      { label: 'Guest Folios', path: '/billing/folios', icon: FolderOpen, milestone: 3, summary: 'Itemised guest charges, payments and balances.' },
      { label: 'Invoices', path: '/billing/invoices', icon: FileText, milestone: 3, summary: 'Invoice directory with print-ready previews.' },
      { label: 'Payments', path: '/billing/payments', icon: CreditCard, milestone: 3, summary: 'Payment history and simulated payment recording.' },
      { label: 'Refunds', path: '/billing/refunds', icon: Undo2, milestone: 3, summary: 'Refund requests and approvals (simulated).' },
      { label: 'Expenses', path: '/finance/expenses', icon: Wallet, milestone: 3, summary: 'Operating expense tracking.' },
      { label: 'Financial Reports', path: '/finance/reports', icon: LineChart, milestone: 3, summary: 'Revenue and cash-flow reports.' },
      { label: 'Tax and Charges', path: '/settings/tax', icon: Percent, milestone: 6, summary: 'Tax and service-charge configuration.', roles: FINANCIAL_ROLES },
    ],
  },
  {
    id: 'services', label: 'Hotel Services', roles: ['general_manager', 'restaurant'],
    items: [
      { label: 'Restaurant', path: '/restaurant', icon: UtensilsCrossed, milestone: 4, summary: 'Restaurant overview and service performance.' },
      { label: 'Menu Management', path: '/restaurant/menu', icon: BookOpen, milestone: 4, summary: 'Food and beverage menu, categories and prices.' },
      { label: 'Tables', path: '/restaurant/tables', icon: Armchair, milestone: 4, summary: 'Table layout and occupancy.' },
      { label: 'Orders', path: '/restaurant/orders', icon: ClipboardList, milestone: 4, summary: 'Orders and kitchen tracking.' },
      { label: 'Room Service', path: '/room-service', icon: Utensils, milestone: 4, summary: 'Room-service orders and charge-to-room.' },
      { label: 'Inventory', path: '/inventory', icon: Package, milestone: 5, summary: 'Stock levels, reorder alerts and movements.' },
      { label: 'Suppliers', path: '/inventory/suppliers', icon: Truck, milestone: 5, summary: 'Supplier directory.' },
      { label: 'Purchase Orders', path: '/inventory/purchases', icon: ShoppingCart, milestone: 5, summary: 'Purchase order creation and receiving.' },
    ],
  },
  {
    id: 'admin', label: 'Administration', roles: GM,
    items: [
      { label: 'Staff', path: '/staff', icon: Briefcase, milestone: 5, summary: 'Employee directory and details.' },
      { label: 'Staff Invitations', path: '/staff/invitations', icon: Briefcase, milestone: 4, summary: 'Invite staff, review delivery and manage pending invitations.' },
      { label: 'Departments', path: '/staff/departments', icon: Building2, milestone: 5, summary: 'Departments and headcount.' },
      { label: 'Shifts', path: '/staff/shifts', icon: Clock, milestone: 5, summary: 'Shift rosters.' },
      { label: 'Attendance', path: '/staff/attendance', icon: UserCheck, milestone: 5, summary: 'Attendance and leave records.' },
      { label: 'Payroll', path: '/staff/payroll', icon: Banknote, milestone: 5, summary: 'Payroll interface (no real processing).', roles: ['general_manager', 'accountant'] },
      { label: 'Roles and Permissions', path: '/access-control', icon: ShieldCheck, milestone: 6, summary: 'Role definitions and permission matrix.' },
      { label: 'Audit Logs', path: '/audit-logs', icon: History, milestone: 6, summary: 'Searchable log of system activity.' },
    ],
  },
  {
    id: 'analytics', label: 'Analytics', roles: ['general_manager', 'accountant'],
    items: [{ label: 'Reports', path: '/reports', icon: BarChart3, milestone: 6, summary: 'Occupancy, revenue, guest, staff and inventory reports with filters.' }],
  },
  {
    id: 'config', label: 'Configuration', roles: GM,
    items: [
      { label: 'Hotel Settings', path: '/settings', icon: Settings, milestone: 6, summary: 'Hotel profile, currency, time zone and contact details.' },
      { label: 'Regional Preferences', path: '/settings/regional', icon: Clock, milestone: 6, summary: 'Currency, date, time, language and time-zone preferences.' },
      { label: 'Room Settings', path: '/settings/rooms', icon: BedDouble, milestone: 6, summary: 'Room categories and amenities.' },
      { label: 'Pricing Settings', path: '/settings/pricing', icon: Tag, milestone: 6, summary: 'Seasonal rates and pricing rules.' },
      { label: 'Tax and Charges', path: '/settings/tax', icon: Percent, milestone: 6, summary: 'Tax and service-charge configuration.' },
      { label: 'Notifications', path: '/settings/notifications', icon: Bell, milestone: 6, summary: 'Notification preferences.' },
      { label: 'General Preferences', path: '/settings/general', icon: Settings, milestone: 6, summary: 'Check-in, check-out and hotel workflow defaults.' },
      { label: 'User Profile', path: '/profile', icon: User, milestone: 6, summary: 'Your profile and preferences.', roles: ALL },
    ],
  },
];

export interface ExtraRoute { path: string; title: string; milestone: number; summary: string }

/** Routes that exist in the spec but are not sidebar entries. */
export const EXTRA_ROUTES: ExtraRoute[] = [
  { path: '/reservations/new', title: 'New Reservation', milestone: 2, summary: 'Five-step booking form: stay, room, guest, pricing, confirmation.' },
  { path: '/reservations/walk-in', title: 'Walk-in Booking', milestone: 2, summary: 'Fast walk-in booking flow.' },
  { path: '/reservations/:id', title: 'Reservation Details', milestone: 2, summary: 'Reservation detail, modification and history.' },
  { path: '/rooms/:id', title: 'Room Details', milestone: 2, summary: 'Room information, history, maintenance and housekeeping records.' },
  { path: '/front-desk/arrivals', title: 'Arrivals', milestone: 3, summary: 'Expected arrivals and check-in.' },
  { path: '/front-desk/departures', title: 'Departures', milestone: 3, summary: 'Expected departures and check-out.' },
  { path: '/front-desk/in-house', title: 'In-house Guests', milestone: 3, summary: 'Current in-house guests, room transfers and extensions.' },
  { path: '/guests/:id', title: 'Guest Profile', milestone: 3, summary: 'Guest profile, history, preferences and notes.' },
  { path: '/housekeeping/schedule', title: 'Cleaning Schedule', milestone: 4, summary: 'Cleaning schedule by employee and shift.' },
  { path: '/housekeeping/inspections', title: 'Inspections', milestone: 4, summary: 'Room inspection records.' },
  { path: '/inventory/movements', title: 'Stock Movements', milestone: 5, summary: 'Stock in, out and adjustments.' },
];

export interface RouteMeta { path: string; title: string; milestone: number; summary: string }

export const ROUTES: RouteMeta[] = [
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ path: i.path, title: i.label, milestone: i.milestone, summary: i.summary }))),
  ...EXTRA_ROUTES,
];

const flatItems = NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ item, group: g })));

export function navForRole(role: Role): NavGroup[] {
  if (useAdminStore.getState().roleActive[appRoleName[role]] === false) return [];
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => {
    return canAccess(role, i.path);
  }) })).filter((g) => g.items.length > 0);
}

export function permissionModuleForPath(path: string): PermissionModule | undefined {
  if (path.startsWith('/reports') || path.startsWith('/finance/reports')) return 'Reports';
  if (path.startsWith('/settings') || path === '/profile') return 'Settings';
  if (path.startsWith('/access-control')) return 'Access control';
  if (path.startsWith('/audit-logs')) return 'Audit logs';
  if (path.startsWith('/front-desk')) return 'Front desk';
  if (path.startsWith('/reservations')) return 'Reservations';
  if (path.startsWith('/rooms')) return 'Rooms';
  if (path.startsWith('/guests')) return 'Guests';
  if (path.startsWith('/billing')) return 'Billing';
  if (path.startsWith('/finance/expenses')) return 'Expenses';
  if (path.startsWith('/housekeeping')) return 'Housekeeping';
  if (path.startsWith('/maintenance')) return 'Maintenance';
  if (path.startsWith('/restaurant') || path.startsWith('/room-service')) return 'Restaurant';
  if (path.startsWith('/inventory')) return 'Inventory';
  if (path.startsWith('/staff/payroll')) return 'Payroll';
  if (path.startsWith('/staff/attendance')) return 'Attendance';
  if (path.startsWith('/staff/departments')) return 'Departments';
  if (path.startsWith('/staff/shifts')) return 'Shifts';
  if (path.startsWith('/staff')) return 'Staff';
  if (path === '/dashboard') return 'Dashboard';
  return undefined;
}

/** Longest nav path that prefixes the pathname, for active-state highlighting. */
export function activeNavPath(pathname: string): string | undefined {
  return flatItems
    .map(({ item }) => item.path)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
}

export function canAccess(role: Role, pathname: string): boolean {
  // Dashboard and financial summaries are reserved to finance-capable roles even
  // when persisted/custom permission maps still contain older broad grants.
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!FINANCIAL_ROLES.includes(role)) return false;
  }
  if (isFinancialRoute(pathname) && !FINANCIAL_ROLES.includes(role)) return false;
  const baseRole = legacyRoleFor(role);
  const path = activeNavPath(pathname);
  const itemAndGroup = path ? flatItems.find((f) => f.item.path === path) : undefined;
  if (itemAndGroup && baseRole !== 'general_manager' && !(itemAndGroup.item.roles ?? itemAndGroup.group.roles).includes(baseRole)) return false;
  const module = permissionModuleForPath(pathname);
  if (isFinancialRoute(pathname)) {
    if (!FINANCIAL_ROLES.includes(role) || !module) return false;
    const financialPermissions = permissionsForAppRole(role);
    if (!Object.prototype.hasOwnProperty.call(financialPermissions, module) || !(financialPermissions[module] ?? []).includes('View')) return false;
  }
  if (pathname.startsWith('/settings') && role === 'accountant' && pathname !== '/settings/tax') return false;
  if (!module) return baseRole === 'general_manager' || !itemAndGroup || (itemAndGroup.item.roles ?? itemAndGroup.group.roles).includes(baseRole);
  const permissions = permissionsForAppRole(role);
  const name = appRoleName[role];
  if (useAdminStore.getState().roleActive[name] === false) return false;
  if (Object.prototype.hasOwnProperty.call(permissions, module)) return (permissions[module] ?? []).includes('View');
  return !itemAndGroup || (itemAndGroup.item.roles ?? itemAndGroup.group.roles).includes(baseRole);
}

export function isFinancialRoute(pathname: string) {
  return pathname.startsWith('/billing') || pathname.startsWith('/finance/') || pathname === '/reports' || pathname.startsWith('/reports/') || pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/settings/tax' || pathname === '/staff/payroll' || pathname.startsWith('/staff/payroll/');
}

/** First route available to this simulated role; used after login, role switch and denied dashboard URLs. */
export function landingPageForRole(role: Role): string | null {
  if (canAccess(role, '/dashboard')) return '/dashboard';
  const preferred = role === 'front_desk' || role === 'receptionist' ? '/front-desk'
    : ['housekeeping', 'housekeeping_manager', 'maintenance_manager', 'maintenance_staff'].includes(role) ? '/housekeeping'
      : role === 'restaurant' || role === 'restaurant_manager' ? '/restaurant'
        : role === 'inventory_manager' ? '/inventory'
          : role === 'human_resources_manager' ? '/staff' : null;
  if (preferred && canAccess(role, preferred)) return preferred;
  return navForRole(role).flatMap((group) => group.items).map((item) => item.path)[0] ?? null;
}
