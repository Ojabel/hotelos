import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SignJWT } from 'jose';
import request from 'supertest';
import { appConfig, environmentSchema } from '../src/config/configuration';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/database/prisma.service';
import { HotelOperationsModule } from '../src/operations/hotel-operations.module';

const secret = 'postgres-integration-only-secret-32-chars';
const tenantId = randomUUID();
const otherTenantId = randomUUID();
const actorSubject = `integration-admin-${randomUUID()}`;
const suspendedSubject = `integration-suspended-${randomUUID()}`;
const revokedSubject = `integration-revoked-${randomUUID()}`;
const otherTenantSubject = `integration-other-${randomUUID()}`;
const ownerSubjects = [randomUUID(), randomUUID()];

async function bearer(subject: string) {
  return new SignJWT({ email: `${subject}@example.test`, email_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('hotelos-development')
    .setAudience('hotelos-api-development')
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
}

describe('PostgreSQL-backed tenant isolation and last-Owner protection', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let otherTenantToken: string;
  let suspendedToken: string;
  let revokedToken: string;
  let ownerMembershipIds: string[];
  let otherOrgRoleId: string;
  let otherHotelId: string;
  let otherMembershipId: string;
  let otherInvitationId: string;
  let hotelId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'development';
    process.env.DEV_AUTH_SECRET = secret;
    process.env.TENANT_ORGANIZATION_ID = tenantId;
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, cache: true, validationSchema: environmentSchema, load: [appConfig] }),
        AuthModule,
        HotelOperationsModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.organization.createMany({ data: [
      { id: tenantId, name: 'Security Test Tenant', slug: `security-test-${tenantId}`, status: 'ACTIVE' },
      { id: otherTenantId, name: 'Other Security Tenant', slug: `other-security-${otherTenantId}`, status: 'ACTIVE' },
    ] });
    const tenantHotel = await prisma.hotel.create({
      data: { organizationId: tenantId, name: 'HotelOS Integration Hotel', code: `A-${randomUUID()}`, status: 'ACTIVE' },
    });
    hotelId = tenantHotel.id;

    const neededPermissions = [
      { resource: 'organization', action: 'read' },
      { resource: 'hotel', action: 'read' },
      { resource: 'staff', action: 'manage' },
      { resource: 'access', action: 'read' },
      { resource: 'access', action: 'manage' },
      { resource: 'hotel', action: 'manage' },
      { resource: 'reservations', action: 'read' },
      { resource: 'reservations', action: 'manage' },
      { resource: 'guests', action: 'read' },
      { resource: 'guests', action: 'manage' },
      { resource: 'housekeeping', action: 'manage' },
      { resource: 'housekeeping', action: 'inspect' },
      { resource: 'housekeeping', action: 'tasks.self' },
      { resource: 'frontdesk', action: 'manage' },
      { resource: 'maintenance', action: 'manage' },
      { resource: 'maintenance', action: 'report' },
      { resource: 'maintenance', action: 'work.self' },
      { resource: 'finance', action: 'read' },
      { resource: 'finance.payments', action: 'read' },
      { resource: 'finance.payments', action: 'manage' },
      { resource: 'finance.refunds', action: 'manage' },
      { resource: 'finance.expenses', action: 'manage' },
    ];
    for (const permission of neededPermissions) {
      await prisma.permission.upsert({
        where: { resource_action: permission }, create: permission, update: {},
      });
    }
    const permissions = await prisma.permission.findMany({ where: { OR: neededPermissions } });
    const adminRole = await prisma.role.create({
      data: { organizationId: tenantId, name: `Integration Admin ${randomUUID()}`, permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) } },
    });
    const otherRole = await prisma.role.create({ data: { organizationId: otherTenantId, name: `Other Role ${randomUUID()}` } });
    otherOrgRoleId = otherRole.id;
    const hotel = await prisma.hotel.create({
      data: { organizationId: otherTenantId, name: 'Other Tenant Hotel', code: `H-${randomUUID()}`, status: 'ACTIVE' },
    });
    otherHotelId = hotel.id;

    const identities = await Promise.all([
      prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject: actorSubject, email: `${actorSubject}@example.test`, emailVerified: true } }),
      prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject: suspendedSubject, email: `${suspendedSubject}@example.test`, emailVerified: true } }),
      prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject: revokedSubject, email: `${revokedSubject}@example.test`, emailVerified: true } }),
      prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject: otherTenantSubject, email: `${otherTenantSubject}@example.test`, emailVerified: true } }),
      ...ownerSubjects.map((subject) => prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject, email: `${subject}@example.test`, emailVerified: true } })),
    ]);
    const [admin, suspended, revoked, other, ...owners] = identities;
    await prisma.organizationMembership.create({
      data: { organizationId: tenantId, userId: admin.id, status: 'ACTIVE', roleAssignments: { create: [{ roleId: adminRole.id }] } },
    });
    await prisma.organizationMembership.create({ data: { organizationId: tenantId, userId: suspended.id, status: 'SUSPENDED' } });
    await prisma.organizationMembership.create({ data: { organizationId: tenantId, userId: revoked.id, status: 'REVOKED' } });
    const otherMembership = await prisma.organizationMembership.create({ data: { organizationId: otherTenantId, userId: other.id, status: 'ACTIVE', isOwner: true } });
    otherMembershipId = otherMembership.id;
    const otherInvitation = await prisma.membershipInvitation.create({
      data: { organizationId: otherTenantId, invitedByUserId: other.id, email: 'foreign-invite@example.test', expiresAt: new Date(Date.now() + 60_000) },
    });
    otherInvitationId = otherInvitation.id;
    const ownerMemberships = await Promise.all(owners.map((owner) => prisma.organizationMembership.create({
      data: { organizationId: tenantId, userId: owner.id, status: 'ACTIVE', isOwner: true },
    })));
    ownerMembershipIds = ownerMemberships.map(({ id }) => id);

    adminToken = await bearer(actorSubject);
    otherTenantToken = await bearer(otherTenantSubject);
    suspendedToken = await bearer(suspendedSubject);
    revokedToken = await bearer(revokedSubject);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.auditEvent.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.maintenanceWorkOrderEvent.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.maintenanceWorkOrder.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.maintenanceRequest.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.housekeepingInspection.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.housekeepingTaskEvent.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.housekeepingTask.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.membershipInvitationRole.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.membershipInvitation.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.financialRefund.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.paymentAllocation.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.paymentReceipt.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.financialPayment.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.invoiceLine.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.financialInvoice.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.folioEntry.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.guestFolio.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotelExpense.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.expenseCategory.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotelReservation.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotelGuest.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotelRoom.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.roomCategory.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.organizationMembershipRole.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotelMembershipRole.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotelMembership.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.rolePermission.deleteMany({ where: { role: { organizationId: { in: [tenantId, otherTenantId] } } } });
      await prisma.role.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.hotel.deleteMany({ where: { organizationId: { in: [tenantId, otherTenantId] } } });
      await prisma.userIdentity.deleteMany({ where: { subject: { in: [actorSubject, suspendedSubject, revokedSubject, otherTenantSubject, ...ownerSubjects] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    }
    await app?.close();
    process.env.AUTH_MODE = 'disabled';
    delete process.env.DEV_AUTH_SECRET;
    delete process.env.TENANT_ORGANIZATION_ID;
  }, 60_000);

  it('keeps HTTP reads in the configured organization despite hostile headers and query IDs', async () => {
    const headers = { Authorization: `Bearer ${adminToken}`, 'x-organization-id': otherTenantId };
    await request(app.getHttpServer()).get(`/api/v1/organizations/current?organizationId=${otherTenantId}`).set(headers)
      .expect(200).expect(({ body }) => expect(body.id).toBe(tenantId));
    await request(app.getHttpServer()).get(`/api/v1/memberships?organizationId=${otherTenantId}`).set(headers)
      .expect(200).expect(({ body }) => {
        expect(body.some((membership: { user: { email: string | null } }) => membership.user.email === `${otherTenantSubject}@example.test`)).toBe(false);
      });
    await request(app.getHttpServer()).get('/api/v1/roles').query({ organizationId: otherTenantId }).set(headers)
      .expect(200).expect(({ body }) => expect(body.some((role: { id: string }) => role.id === otherOrgRoleId)).toBe(false));
    await request(app.getHttpServer()).get('/api/v1/hotels').query({ hotelId: otherHotelId }).set(headers)
      .expect(200).expect(({ body }) => expect(body.some((hotelItem: { id: string }) => hotelItem.id === otherHotelId)).toBe(false));
    await request(app.getHttpServer()).post(`/api/v1/memberships/${otherMembershipId}/suspend`).set(headers).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/memberships/${ownerMembershipIds[0]}/roles`).set(headers)
      .send({ roleId: otherOrgRoleId }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/memberships/invitations/${otherInvitationId}/accept`).set(headers).expect(404);
  });

  it('rejects client organization IDs in mutation bodies and never authenticates another tenant user here', async () => {
    await request(app.getHttpServer()).post('/api/v1/memberships/invitations').set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'target@example.test', roleIds: [], organizationId: otherTenantId }).expect(400);
    await request(app.getHttpServer()).get('/api/v1/organizations/current').set('Authorization', `Bearer ${otherTenantToken}`).expect(403);
    await request(app.getHttpServer()).get('/api/v1/memberships/me').set('Authorization', `Bearer ${suspendedToken}`).expect(403);
    await request(app.getHttpServer()).get('/api/v1/memberships/me').set('Authorization', `Bearer ${revokedToken}`).expect(403);
  });

  it('serializes simultaneous owner suspension and revocation; commits one denial audit and retains one active Owner', async () => {
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/memberships/${ownerMembershipIds[0]}/suspend`).set('Authorization', `Bearer ${adminToken}`),
      request(app.getHttpServer()).post(`/api/v1/memberships/${ownerMembershipIds[1]}/revoke`).set('Authorization', `Bearer ${adminToken}`),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 403]);
    const activeOwners = await prisma.organizationMembership.count({ where: { organizationId: tenantId, isOwner: true, status: 'ACTIVE' } });
    expect(activeOwners).toBe(1);
    expect(await prisma.auditEvent.count({ where: { organizationId: tenantId, action: 'membership.last-owner.protection-triggered', outcome: 'DENIED' } })).toBe(1);
    const changedOwners = await prisma.organizationMembership.findMany({ where: { id: { in: ownerMembershipIds } }, select: { id: true, status: true } });
    expect(changedOwners.filter(({ status }) => status !== 'ACTIVE')).toHaveLength(1);
    const successfulAudit = await prisma.auditEvent.count({ where: { organizationId: tenantId, action: { in: ['membership.suspended', 'membership.revoked'] }, outcome: 'SUCCESS' } });
    expect(successfulAudit).toBe(1);
  }, 30_000);

  it('persists room, guest and reservation workflows; enforces idempotency, overlap, check-in, transfer and checkout', async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const categoryResponse = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/room-categories`).set(headers).send({
      name: 'Integration Queen', description: 'Test category', basePrice: 100_000, capacity: 2,
      bedConfiguration: '1 Queen bed', amenities: ['Wi-Fi'],
    }).expect(201);
    const categoryId: string = categoryResponse.body.id;
    const roomIds: string[] = [];
    for (let index = 1; index <= 4; index += 1) {
      const roomResponse = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/rooms`).set(headers).send({
        number: `T-${index}`, floor: 1, categoryId,
      }).expect(201);
      roomIds.push(roomResponse.body.id);
    }
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/rooms/${roomIds[0]}`).set(headers).send({
      number: 'T-1A', floor: 2, categoryId,
    }).expect(200);
    const guestResponse = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/guests`).set(headers).send({
      fullName: 'Integration Guest', email: `guest-${tenantId}@example.test`, phone: '+2348000000000',
    }).expect(201);
    const guestId: string = guestResponse.body.id;
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/guests/${guestId}`).set(headers).send({
      fullName: 'Updated Integration Guest', email: `guest-${tenantId}@example.test`, phone: '+2348000000001',
    }).expect(200);
    expect((await prisma.hotelGuest.findUnique({ where: { id: guestId } }))?.fullName).toBe('Updated Integration Guest');
    const today = new Date().toISOString().slice(0, 10);
    const addDays = (date: string, days: number) => {
      const value = new Date(`${date}T00:00:00.000Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };
    const stay = { checkIn: addDays(today, 3), checkOut: addDays(today, 5), adults: 2, children: 0 };
    const payload = { roomId: roomIds[0], guestId, ...stay, status: 'CONFIRMED' };
    const created = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`)
      .set({ ...headers, 'Idempotency-Key': `same-${tenantId}` }).send(payload).expect(201);
    const retried = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`)
      .set({ ...headers, 'Idempotency-Key': `same-${tenantId}` }).send(payload).expect(201);
    expect(retried.body.id).toBe(created.body.id);
    expect(created.body.total).toBe(200_000);

    const competing = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`).set(headers)
        .send({ roomId: roomIds[1], guestId, ...stay, status: 'CONFIRMED' }),
      request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`).set(headers)
        .send({ roomId: roomIds[1], guestId, ...stay, status: 'CONFIRMED' }),
    ]);
    expect(competing.map(({ status }) => status).sort()).toEqual([201, 409]);
    const competingReservation = competing.find(({ status }) => status === 201)!.body;
    await expect(prisma.hotelReservation.create({ data: {
      organizationId: tenantId, hotelId, roomId: roomIds[1], guestId, categoryId,
      reference: `DIRECT-${randomUUID()}`, status: 'CONFIRMED',
      checkIn: new Date(`${stay.checkIn}T00:00:00.000Z`), checkOut: new Date(`${stay.checkOut}T00:00:00.000Z`),
      adults: 2, children: 0, nightlyRate: 100_000, total: 200_000,
    } })).rejects.toBeDefined();

    const inHouse = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`).set(headers).send({
      roomId: roomIds[2], guestId, checkIn: today, checkOut: addDays(today, 1), adults: 1, children: 0, status: 'CONFIRMED',
    }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${inHouse.body.id}/status`).set(headers)
      .send({ status: 'CHECKED_IN' }).expect(201);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('OCCUPIED');
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests`).set(headers).send({ title: 'Unsafe socket', description: 'Exposed wiring', roomId: roomIds[2], category: 'Electrical', priority: 'URGENT', blocksRoom: true }).expect(409);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/rooms/${roomIds[2]}/status`).set(headers)
      .send({ status: 'DIRTY' }).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${inHouse.body.id}/transfer`).set(headers)
      .send({ targetRoomId: roomIds[3] }).expect(201);
    const afterTransfer = await prisma.hotelRoom.findMany({ where: { id: { in: [roomIds[2], roomIds[3]] } }, select: { id: true, status: true } });
    expect(afterTransfer.find(({ id }) => id === roomIds[2])?.status).toBe('DIRTY');
    expect(afterTransfer.find(({ id }) => id === roomIds[3])?.status).toBe('OCCUPIED');
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${inHouse.body.id}/status`).set(headers)
      .send({ status: 'CHECKED_OUT' }).expect(201);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[3] } }))?.status).toBe('DIRTY');
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/rooms/${roomIds[3]}/status`).set(headers)
      .send({ status: 'AVAILABLE' }).expect(409);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/rooms/${roomIds[3]}/status`).set(headers)
      .send({ status: 'CLEANING' }).expect(200);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[3] } }))?.status).toBe('CLEANING');
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/rooms/${roomIds[3]}/status`).set(headers)
      .send({ status: 'INSPECTED' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/rooms/${roomIds[3]}/status`).set(headers)
      .send({ status: 'AVAILABLE' }).expect(200);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[3] } }))?.status).toBe('AVAILABLE');
    expect(await prisma.auditEvent.count({ where: { organizationId: tenantId, action: 'hotel.reservation.created', resourceId: competingReservation.id } })).toBe(1);
    expect(await prisma.hotelReservation.count({ where: { organizationId: tenantId, hotelId, roomId: roomIds[1], status: 'CONFIRMED' } })).toBe(1);

    const pending = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`).set(headers).send({
      roomId: roomIds[0], guestId, checkIn: addDays(today, 7), checkOut: addDays(today, 8), adults: 1, children: 0, status: 'PENDING',
    }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${pending.body.id}/status`).set(headers)
      .send({ status: 'CONFIRMED' }).expect(201);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[0] } }))?.number).toBe('T-1A');
    expect((await prisma.hotelReservation.findUnique({ where: { id: pending.body.id } }))?.status).toBe('CONFIRMED');

    // Housekeeping lifecycle persists independently from room status until a supervisor inspection.
    const hkIdentity = await prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject: `hk-${randomUUID()}`, email: `hk-${tenantId}@example.test`, emailVerified: true } });
    const housekeeperPermission = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource: 'housekeeping', action: 'tasks.self' } } });
    const hotelReadPermission = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource: 'hotel', action: 'read' } } });
    await prisma.role.create({ data: { organizationId: tenantId, name: 'Housekeeping', isSystem: true, permissions: { create: [{ permissionId: housekeeperPermission.id }, { permissionId: hotelReadPermission.id }] } } });
    await prisma.organizationMembership.create({ data: { organizationId: tenantId, userId: hkIdentity.id, status: 'ACTIVE' } });
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/operations-staff/housekeeping/${hkIdentity.id}`).set(headers).expect(201);
    const hkToken = await bearer((await prisma.userIdentity.findUniqueOrThrow({ where: { id: hkIdentity.id } })).subject);
    const task = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/housekeeping/tasks`).set({ ...headers, 'Idempotency-Key': `hk-${tenantId}` }).send({ roomId: roomIds[2], type: 'TURNOVER', priority: 'HIGH', instructions: 'Refresh linen' }).expect(201);
    const taskId: string = task.body.id;
    const retriedTask = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/housekeeping/tasks`).set({ ...headers, 'Idempotency-Key': `hk-${tenantId}` }).send({ roomId: roomIds[2], type: 'TURNOVER', priority: 'HIGH', instructions: 'Refresh linen' }).expect(201);
    expect(retriedTask.body.id).toBe(taskId);
    await request(app.getHttpServer()).get(`/api/v1/hotels/${hotelId}/housekeeping/tasks`).set({ Authorization: `Bearer ${hkToken}` }).expect(200).expect(({ body }) => expect(body).toHaveLength(0));
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/assign`).set(headers).send({ userId: hkIdentity.id }).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/hotels/${hotelId}/housekeeping/tasks`).set({ Authorization: `Bearer ${hkToken}` }).expect(200).expect(({ body }) => expect(body.map((item: { id: string }) => item.id)).toEqual([taskId]));
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/start`).set({ Authorization: `Bearer ${hkToken}` }).expect(200);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('CLEANING');
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/complete`).set({ Authorization: `Bearer ${hkToken}` }).send({ notes: 'Cleaned' }).expect(200);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('CLEANING');
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/inspection`).set({ Authorization: `Bearer ${hkToken}` }).send({ result: 'APPROVED', score: 100 }).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/inspection`).set(headers).send({ result: 'APPROVED', score: 100 }).expect(201);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('INSPECTED');
    expect((await prisma.housekeepingTask.findUnique({ where: { id: taskId } }))?.status).toBe('APPROVED');
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/housekeeping/tasks/${taskId}/inspection`).set(headers).send({ result: 'APPROVED', score: 100 }).expect(409);

    const maintenance = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests`).set({ ...headers, 'Idempotency-Key': `mt-${tenantId}` }).send({ title: 'Leaking tap', description: 'Guest bathroom tap drips', roomId: roomIds[2], category: 'Plumbing', priority: 'NORMAL', blocksRoom: false }).expect(201);
    const requestId: string = maintenance.body.id;
    const retriedMaintenance = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests`).set({ ...headers, 'Idempotency-Key': `mt-${tenantId}` }).send({ title: 'Leaking tap', description: 'Guest bathroom tap drips', roomId: roomIds[2], category: 'Plumbing', priority: 'NORMAL', blocksRoom: false }).expect(201);
    expect(retriedMaintenance.body.id).toBe(requestId);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests/${requestId}/work-orders`).set(headers).send({}).expect(201);
    const work = await prisma.maintenanceWorkOrder.findUniqueOrThrow({ where: { requestId } });
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/assign`).set(headers).send({ userId: hkIdentity.id }).expect(409);
    const technician = await prisma.userIdentity.create({ data: { issuer: 'hotelos-development', subject: `tech-${randomUUID()}`, email: `tech-${tenantId}@example.test`, emailVerified: true } });
    const technicianPermission = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource: 'maintenance', action: 'work.self' } } });
    await prisma.role.create({ data: { organizationId: tenantId, name: 'Maintenance', isSystem: true, permissions: { create: [{ permissionId: technicianPermission.id }, { permissionId: hotelReadPermission.id }] } } });
    await prisma.organizationMembership.create({ data: { organizationId: tenantId, userId: technician.id, status: 'ACTIVE' } });
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/operations-staff/maintenance/${technician.id}`).set(headers).expect(201);
    const techToken = await bearer((await prisma.userIdentity.findUniqueOrThrow({ where: { id: technician.id } })).subject);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/assign`).set(headers).send({ userId: technician.id }).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/hotels/${hotelId}/maintenance/requests`).set({ Authorization: `Bearer ${techToken}` }).expect(200).expect(({ body }) => expect(body.map((item: { id: string }) => item.id)).toEqual([requestId]));
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/start`).set({ Authorization: `Bearer ${techToken}` }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/hold`).set({ Authorization: `Bearer ${techToken}` }).send({ notes: 'Waiting for access' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/start`).set({ Authorization: `Bearer ${techToken}` }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/complete`).set({ Authorization: `Bearer ${techToken}` }).send({ notes: 'Tap cartridge replaced' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/close`).set({ Authorization: `Bearer ${techToken}` }).expect(403);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${work.id}/close`).set(headers).expect(200);
    expect((await prisma.maintenanceWorkOrder.findUnique({ where: { id: work.id } }))?.status).toBe('CLOSED');
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('INSPECTED');

    const blockingMaintenance = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests`).set({ ...headers, 'Idempotency-Key': `blocking-${tenantId}` }).send({ title: 'Broken window latch', description: 'Cannot secure the room', roomId: roomIds[2], category: 'Furniture and fixtures', priority: 'HIGH', blocksRoom: true }).expect(201);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('MAINTENANCE');
    const blockingRequestId: string = blockingMaintenance.body.id;
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests/${blockingRequestId}/work-orders`).set(headers).send({}).expect(201);
    const blockingWork = await prisma.maintenanceWorkOrder.findUniqueOrThrow({ where: { requestId: blockingRequestId } });
    const secondBlockResponse = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests`).set({ ...headers, 'Idempotency-Key': `blocking-second-${tenantId}` }).send({ title: 'Broken room lock', description: 'Lock is unsafe', roomId: roomIds[2], category: 'Furniture and fixtures', priority: 'HIGH', blocksRoom: true }).expect(201);
    const secondBlockRequestId: string = secondBlockResponse.body.id;
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/maintenance/requests/${secondBlockRequestId}/work-orders`).set(headers).send({}).expect(201);
    const secondBlockWork = await prisma.maintenanceWorkOrder.findUniqueOrThrow({ where: { requestId: secondBlockRequestId } });
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${blockingWork.id}/assign`).set(headers).send({ userId: technician.id }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${blockingWork.id}/start`).set({ Authorization: `Bearer ${techToken}` }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${blockingWork.id}/complete`).set({ Authorization: `Bearer ${techToken}` }).send({ notes: 'Latch replaced' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${blockingWork.id}/close`).set(headers).expect(200);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('MAINTENANCE');
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${secondBlockWork.id}/assign`).set(headers).send({ userId: technician.id }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${secondBlockWork.id}/start`).set({ Authorization: `Bearer ${techToken}` }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${secondBlockWork.id}/complete`).set({ Authorization: `Bearer ${techToken}` }).send({ notes: 'Lock replaced' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/maintenance/work-orders/${secondBlockWork.id}/close`).set(headers).expect(200);
    expect((await prisma.hotelRoom.findUnique({ where: { id: roomIds[2] } }))?.status).toBe('DIRTY');
  }, 60_000);

  it('persists an invoiced folio, allocated payments, receipts, refunds and expenses', async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const category = await prisma.roomCategory.create({ data: { organizationId: tenantId, hotelId, name: `Finance ${randomUUID()}`, basePrice: 50_000, capacity: 2, bedConfiguration: 'Queen' } });
    const room = await prisma.hotelRoom.create({ data: { organizationId: tenantId, hotelId, categoryId: category.id, number: `F-${randomUUID().slice(0, 6)}`, floor: 1 } });
    const guest = await prisma.hotelGuest.create({ data: { organizationId: tenantId, hotelId, fullName: 'Finance Integration Guest' } });
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(`${today}T00:00:00.000Z`); tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const reservation = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations`).set(headers).send({ roomId: room.id, guestId: guest.id, checkIn: today, checkOut: tomorrow, adults: 1, children: 0, status: 'CONFIRMED' }).expect(201);
    const reservationId: string = reservation.body.id;
    const roomCharges = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/folio/room-charges`).set({ ...headers, 'Idempotency-Key': `finance-room-${tenantId}` }).expect(201);
    expect(roomCharges.body.entries.find((entry: { kind: string }) => entry.kind === 'ROOM_CHARGE')?.amountMinor).toBe(5_000_000);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/folio/charges`).set({ ...headers, 'Idempotency-Key': `finance-extra-${tenantId}` }).send({ description: 'Breakfast', amountMinor: 500_000, serviceDate: today }).expect(201);
    const invoice = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/invoices`).set(headers).expect(201);
    expect(invoice.body.totalMinor).toBe(5_500_000);
    expect(invoice.body.lines).toHaveLength(2);
    const payment = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/payments`).set(headers).send({ amountMinor: 2_000_000, method: 'CASH', idempotencyKey: `finance-payment-${tenantId}` }).expect(201);
    expect(payment.body.receipt.reference).toMatch(/^RCT-/);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/payments`).set(headers).send({ amountMinor: 3_600_000, method: 'CASH', idempotencyKey: `finance-over-${tenantId}` }).expect(409);
    const receipt = await request(app.getHttpServer()).get(`/api/v1/hotels/${hotelId}/receipts/${payment.body.receipt.id}`).set(headers).expect(200);
    expect(receipt.body.snapshot.amountMinor).toBe(2_000_000);
    await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/folio/charges`).set({ ...headers, 'Idempotency-Key': `finance-supplemental-${tenantId}` }).send({ description: 'Late minibar', amountMinor: 100_000, serviceDate: today }).expect(201);
    const supplemental = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/invoices`).set(headers).expect(201);
    expect(supplemental.body.totalMinor).toBe(100_000);
    expect(supplemental.body.lines).toHaveLength(1);
    const refund = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/payments/${payment.body.id}/refunds`).set(headers).send({ amountMinor: 500_000, reason: 'Guest overpayment correction', idempotencyKey: `finance-refund-${tenantId}` }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/refunds/${refund.body.id}`).set(headers).send({ status: 'APPROVED' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/hotels/${hotelId}/refunds/${refund.body.id}`).set(headers).send({ status: 'PROCESSED' }).expect(200);
    const expense = await request(app.getHttpServer()).post(`/api/v1/hotels/${hotelId}/expenses`).set(headers).send({ category: 'Utilities', vendor: 'Test vendor', description: 'Electricity', amountMinor: 1_250_000, method: 'BANK_TRANSFER', date: today, status: 'PAID' }).expect(201);
    expect(expense.body.amountMinor).toBe(1_250_000);
    const folio = await request(app.getHttpServer()).get(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/folio`).set(headers).expect(200);
    expect(folio.body.totals).toMatchObject({ chargesMinor: 5_600_000, paidMinor: 2_000_000, refundedMinor: 500_000, balanceMinor: 4_100_000 });
    expect(await prisma.auditEvent.count({ where: { organizationId: tenantId, action: { startsWith: 'finance.' } } })).toBeGreaterThanOrEqual(7);
  }, 60_000);
});
