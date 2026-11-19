import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

if (process.env.NODE_ENV !== 'development' || process.env.AUTH_MODE !== 'development') {
  throw new Error('Development hotel bootstrap requires NODE_ENV=development and AUTH_MODE=development.');
}
const configuredOrganizationId = process.env.TENANT_ORGANIZATION_ID;
const configuredConnectionString = process.env.DATABASE_URL;
if (!configuredOrganizationId || !configuredConnectionString) throw new Error('TENANT_ORGANIZATION_ID and DATABASE_URL are required.');
const organizationId: string = configuredOrganizationId;
const connectionString: string = configuredConnectionString;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true, status: true } });
  if (!organization || organization.slug !== 'hotelos-local-development' || organization.status !== 'ACTIVE') {
    throw new Error('The configured tenant is not the active HotelOS local development organization.');
  }
  const hotel = await prisma.hotel.upsert({
    where: { organizationId_code: { organizationId, code: 'LOCAL' } },
    create: { organizationId, code: 'LOCAL', name: 'HotelOS Local Property', status: 'ACTIVE' },
    update: {},
    select: { id: true, name: true, code: true, status: true },
  });
  if (hotel.status !== 'ACTIVE') throw new Error('Existing LOCAL hotel is inactive; refusing to change its state.');
  process.stdout.write(`Local property ready: ${hotel.name} (${hotel.id})\n`);
}

main().finally(async () => prisma.$disconnect());
