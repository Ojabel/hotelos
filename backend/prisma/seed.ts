import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the access catalogue.');
if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
  throw new Error('Access catalogue seeding requires NODE_ENV=development or NODE_ENV=test.');
}
const organizationId = process.env.TENANT_ORGANIZATION_ID;
if (!organizationId) throw new Error('TENANT_ORGANIZATION_ID is required; refusing to seed every organization.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const grants: Record<string, string[]> = {
  Owner: ['*'],
  Manager: [
    'organization.read', 'hotel.read', 'hotel.manage', 'staff.read', 'staff.manage',
    'rooms.read', 'rooms.manage', 'reservations.read', 'reservations.manage', 'guests.read',
    'guests.manage', 'frontdesk.read', 'frontdesk.manage', 'housekeeping.read', 'housekeeping.manage', 'housekeeping.inspect',
    'maintenance.read', 'maintenance.manage', 'restaurant.read', 'restaurant.manage',
    'inventory.read', 'inventory.manage', 'reports.read', 'reports.export', 'settings.read', 'settings.manage',
  ],
  Accountant: ['organization.read', 'finance.read', 'finance.payments.read', 'finance.payments.manage', 'finance.reports.read', 'finance.reports.export', 'reports.read', 'reports.export'],
  'Finance Manager': ['hotel.read', 'finance.read', 'finance.payments.read', 'finance.payments.manage', 'finance.refunds.manage', 'finance.expenses.manage', 'finance.reports.read', 'finance.reports.export'],
  Receptionist: ['hotel.read', 'rooms.read', 'reservations.read', 'reservations.manage', 'guests.read', 'frontdesk.read', 'frontdesk.manage', 'maintenance.report'],
  Housekeeping: ['organization.read', 'hotel.read', 'rooms.read', 'housekeeping.read', 'housekeeping.tasks.self'],
  Maintenance: ['organization.read', 'hotel.read', 'rooms.read', 'maintenance.read', 'maintenance.work.self'],
  'Restaurant / Food and Beverage': ['organization.read', 'hotel.read', 'restaurant.read', 'restaurant.manage'],
  'Inventory / Procurement': ['organization.read', 'hotel.read', 'inventory.read', 'inventory.manage', 'procurement.read', 'procurement.manage'],
};

const catalogNames = [...new Set([
  ...Object.values(grants).flat().filter((permission) => permission !== '*'),
  'organization.manage', 'finance.settings.manage', 'finance.read', 'finance.payments.read', 'finance.payments.manage', 'finance.refunds.manage', 'finance.expenses.manage', 'finance.reports.read', 'finance.reports.export', 'audit.read', 'access.read', 'access.manage',
  'finance.reports.export', 'settings.read', 'settings.manage', 'rooms.manage', 'guests.manage',
  'frontdesk.manage', 'housekeeping.manage', 'housekeeping.inspect.self', 'maintenance.manage', 'restaurant.manage',
  'inventory.manage', 'procurement.read', 'procurement.manage',
])];
const catalog = catalogNames
  .map((permission) => {
    const separator = permission.lastIndexOf('.');
    return { resource: permission.slice(0, separator), action: permission.slice(separator + 1) };
  });

async function main() {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) throw new Error('Configured development organization does not exist.');
  await prisma.permission.createMany({ data: catalog, skipDuplicates: true });
  const permissions = await prisma.permission.findMany({ select: { id: true, resource: true, action: true } });
  {
    for (const [name, roleGrants] of Object.entries(grants)) {
      const role = await prisma.role.findFirst({ where: { organizationId: organization.id, hotelId: null, name } });
      if (role && !role.isSystem) throw new Error(`Refusing to overwrite custom role "${name}" in organization ${organization.id}.`);
      const savedRole = role
        ? await prisma.role.update({ where: { id: role.id }, data: { isSystem: true } })
        : await prisma.role.create({ data: { organizationId: organization.id, name, isSystem: true } });
      await prisma.rolePermission.deleteMany({ where: { roleId: savedRole.id } });
      const assigned = roleGrants.includes('*')
        ? permissions
        : permissions.filter((permission) => roleGrants.includes(`${permission.resource}.${permission.action}`));
      await prisma.rolePermission.createMany({
        data: assigned.map(({ id }) => ({ roleId: savedRole.id, permissionId: id })),
        skipDuplicates: true,
      });
    }
  }
}

main().finally(async () => prisma.$disconnect());
