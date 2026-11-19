import { describe, expect, it } from 'vitest';
import { canAccess, navForRole, landingPageForRole } from './nav';
import { useAdminStore } from '@/store/useAdminStore';
import { permissionsForAppRole } from '@/store/useAdminStore';

describe('dashboard and financial role access', () => {
  it.each(['hotel_owner', 'general_manager', 'accountant'] as const)('%s can open dashboard and finance routes', (role) => {
    expect(canAccess(role, '/dashboard')).toBe(true);
    expect(canAccess(role, '/billing/folios')).toBe(true);
    expect(canAccess(role, '/billing/payments')).toBe(true);
    expect(canAccess(role, '/billing/refunds')).toBe(true);
    expect(canAccess(role, '/billing/invoices')).toBe(true);
    expect(canAccess(role, '/finance/reports')).toBe(true);
    expect(canAccess(role, '/reports')).toBe(true);
    expect(canAccess(role, '/staff/payroll')).toBe(true);
    expect(landingPageForRole(role)).toBe('/dashboard');
  });

  it.each(['front_desk', 'receptionist', 'housekeeping', 'housekeeping_manager', 'maintenance_staff', 'maintenance_manager', 'restaurant', 'restaurant_manager', 'inventory_manager', 'human_resources_manager', 'hotel_administrator', 'staff_member'] as const)('%s cannot view restricted financial areas', (role) => {
    expect(canAccess(role, '/dashboard')).toBe(false);
    expect(canAccess(role, '/billing')).toBe(false);
    expect(canAccess(role, '/billing/folios')).toBe(false);
    expect(canAccess(role, '/billing/payments')).toBe(false);
    expect(canAccess(role, '/billing/refunds')).toBe(false);
    expect(canAccess(role, '/billing/invoices')).toBe(false);
    expect(canAccess(role, '/finance/expenses')).toBe(false);
    expect(canAccess(role, '/finance/reports')).toBe(false);
    expect(canAccess(role, '/reports')).toBe(false);
    expect(canAccess(role, '/staff/payroll')).toBe(false);
    expect(navForRole(role).flatMap((g) => g.items).some((i) => i.path === '/dashboard')).toBe(false);
  });

  it('keeps reception and housekeeping operational access while hiding dashboard navigation', () => {
    expect(canAccess('front_desk', '/front-desk')).toBe(true);
    expect(canAccess('front_desk', '/reservations')).toBe(true);
    expect(landingPageForRole('front_desk')).toBe('/front-desk');
    expect(canAccess('housekeeping', '/housekeeping')).toBe(true);
    expect(landingPageForRole('housekeeping')).toBe('/housekeeping');
    expect(canAccess('front_desk', '/dashboard/financial-summary')).toBe(false);
    expect(canAccess('receptionist', '/dashboard')).toBe(false);
    expect(canAccess('maintenance_staff', '/staff/payroll')).toBe(false);
  });

  it('protects accountant tax settings without granting broad hotel settings access', () => {
    expect(canAccess('accountant', '/settings/tax')).toBe(true);
    expect(canAccess('accountant', '/settings')).toBe(false);
    expect(canAccess('accountant', '/settings/rooms')).toBe(false);
  });

  it('fails closed when financial permissions are missing, even if manually granted to another role', () => {
    const receptionist = useAdminStore.getState().permissions.Receptionist!;
    const originalBilling = receptionist.Billing;
    const originalReports = receptionist.Reports;
    receptionist.Billing = ['View'];
    receptionist.Reports = ['Export'];
    expect(canAccess('receptionist', '/billing')).toBe(false);
    expect(canAccess('receptionist', '/reports')).toBe(false);
    receptionist.Billing = originalBilling;
    receptionist.Reports = originalReports;
  });

  it('does not expose the dashboard or finance permissions to staff by default', () => {
    expect(permissionsForAppRole('front_desk').Dashboard).toEqual([]);
    expect(permissionsForAppRole('housekeeping').Dashboard).toEqual([]);
    expect(permissionsForAppRole('maintenance_staff').Billing).toEqual([]);
    expect(permissionsForAppRole('staff_member').Dashboard).toBeUndefined();
  });

  it('keeps HR access limited to workforce modules without payroll or security access', () => {
    expect(canAccess('human_resources_manager', '/staff')).toBe(true);
    expect(canAccess('human_resources_manager', '/staff/departments')).toBe(true);
    expect(canAccess('human_resources_manager', '/staff/payroll')).toBe(false);
    expect(canAccess('human_resources_manager', '/access-control')).toBe(false);
    expect(canAccess('human_resources_manager', '/audit-logs')).toBe(false);
  });

  it('limits manager access-control privileges and updates policy immediately after demo role switching', () => {
    expect(permissionsForAppRole('general_manager')['Access control']).not.toContain('Manage');
    let demoRole: import('@/types').Role = 'general_manager';
    expect(canAccess(demoRole, '/dashboard')).toBe(true);
    demoRole = 'housekeeping';
    expect(canAccess(demoRole, '/dashboard')).toBe(false);
    expect(landingPageForRole(demoRole)).toBe('/housekeeping');
  });
});
