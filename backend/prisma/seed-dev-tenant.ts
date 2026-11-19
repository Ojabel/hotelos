import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

if (process.env.NODE_ENV !== 'development' || process.env.AUTH_MODE !== 'development') {
  throw new Error('Development tenant seeding requires NODE_ENV=development and AUTH_MODE=development.');
}
const organizationId = process.env.TENANT_ORGANIZATION_ID;
const subject = process.env.DEV_AUTH_SUBJECT ?? 'local-owner';
const connectionString = process.env.DATABASE_URL;
if (!organizationId || !connectionString) throw new Error('TENANT_ORGANIZATION_ID and DATABASE_URL are required.');
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
  throw new Error('TENANT_ORGANIZATION_ID must be a UUID.');
}
if (!subject || subject.length > 500) throw new Error('DEV_AUTH_SUBJECT must be an opaque subject of at most 500 characters.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: organizationId },
    create: { id: organizationId, name: 'HotelOS Local Development', slug: 'hotelos-local-development', status: 'ACTIVE' },
    update: {},
    select: { id: true, status: true, slug: true },
  });
  if (organization.status !== 'ACTIVE' || organization.slug !== 'hotelos-local-development') {
    throw new Error('Configured development organization is not the designated active local development organization.');
  }

  const identity = await prisma.userIdentity.upsert({
    where: { issuer_subject: { issuer: 'hotelos-development', subject } },
    create: { issuer: 'hotelos-development', subject, emailVerified: false },
    update: {},
    select: { id: true },
  });
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: organization.id, userId: identity.id } },
    select: { status: true, isOwner: true },
  });
  if (membership) {
    if (membership.status !== 'ACTIVE' || !membership.isOwner) {
      throw new Error('Existing development membership is not an active owner; refusing to change its authorization state.');
    }
  } else {
    await prisma.organizationMembership.create({
      data: { organizationId: organization.id, userId: identity.id, status: 'ACTIVE', isOwner: true },
    });
  }
}

main().finally(async () => prisma.$disconnect());
