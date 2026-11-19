require('dotenv/config');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');

const original = process.env.DATABASE_URL;
if (!original) throw new Error('DATABASE_URL is required.');
const testUrl = new URL(original); testUrl.pathname = '/hotelos_m4_test';
if (testUrl.pathname !== '/hotelos_m4_test') throw new Error('Guest browser fixtures may only use hotelos_m4_test.');
const pool = new Pool({ connectionString: testUrl.toString() });
const organizationId = process.env.TENANT_ORGANIZATION_ID;

async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'existing-guest') {
    const [email] = args;
    const hotel = await pool.query('SELECT "id" FROM "Hotel" WHERE "organizationId"=$1 AND "status"=$2 ORDER BY "createdAt" LIMIT 1', [organizationId, 'ACTIVE']);
    if (!hotel.rowCount) throw new Error('No active test hotel exists.');
    const hotelId = hotel.rows[0].id;
    const guestId = randomUUID(), categoryId = randomUUID(), roomId = randomUUID(), reservationId = randomUUID(), now = new Date();
    const suffix = randomUUID().slice(0, 8);
    await pool.query('INSERT INTO "HotelGuest" ("id","organizationId","hotelId","fullName","email","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$6)', [guestId, organizationId, hotelId, 'Existing Browser Guest', email, now]);
    await pool.query('INSERT INTO "RoomCategory" ("id","organizationId","hotelId","name","basePrice","capacity","bedConfiguration","amenities","createdAt","updatedAt") VALUES ($1,$2,$3,$4,50000,2,$5,ARRAY[]::TEXT[],$6,$6)', [categoryId, organizationId, hotelId, `Guest Fixture ${suffix}`, 'Queen', now]);
    await pool.query('INSERT INTO "HotelRoom" ("id","organizationId","hotelId","categoryId","number","floor","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,1,$6,$6)', [roomId, organizationId, hotelId, categoryId, `GF-${suffix}`, now]);
    const checkIn = new Date(); checkIn.setUTCDate(checkIn.getUTCDate() + 20); const checkOut = new Date(checkIn); checkOut.setUTCDate(checkOut.getUTCDate() + 2);
    await pool.query('INSERT INTO "HotelReservation" ("id","organizationId","hotelId","roomId","categoryId","guestId","reference","status","checkIn","checkOut","adults","children","nightlyRate","total","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,0,50000,100000,$11,$11)', [reservationId, organizationId, hotelId, roomId, categoryId, guestId, `GUEST-${suffix}`, 'CONFIRMED', checkIn.toISOString().slice(0,10), checkOut.toISOString().slice(0,10), now]);
    process.stdout.write(JSON.stringify({ hotelId, guestId, reservationId }));
  } else if (action === 'identity') {
    const [email] = args;
    const result = await pool.query('SELECT "id" FROM "UserIdentity" WHERE "issuer"=$1 AND lower("email")=lower($2) AND "emailVerified"=true', [`https://securetoken.google.com/hotelos-local`, email]);
    if (!result.rowCount) throw new Error('Verified Firebase identity not found in the test database.');
    process.stdout.write(result.rows[0].id);
  } else if (action === 'promote-manager') {
    const [subject, email] = args;
    const identity = await pool.query('SELECT "id" FROM "UserIdentity" WHERE "issuer"=$1 AND "subject"=$2 AND "emailVerified"=true', [`https://securetoken.google.com/hotelos-local`, subject]);
    if (!identity.rowCount) throw new Error('Verified Firebase manager identity not found.');
    const role = await pool.query('SELECT "id" FROM "Role" WHERE "organizationId"=$1 AND "hotelId" IS NULL AND "name"=$2', [organizationId, 'Manager']);
    if (!role.rowCount) throw new Error('Manager role is missing from the test access catalogue.');
    const membershipId = randomUUID();
    await pool.query('INSERT INTO "OrganizationMembership" ("id","organizationId","userId","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT ("organizationId","userId") DO UPDATE SET "status"=$4,"updatedAt"=NOW()', [membershipId, organizationId, identity.rows[0].id, 'ACTIVE']);
    const membership = await pool.query('SELECT "id" FROM "OrganizationMembership" WHERE "organizationId"=$1 AND "userId"=$2', [organizationId, identity.rows[0].id]);
    await pool.query('INSERT INTO "OrganizationMembershipRole" ("organizationId","organizationMembershipId","roleId","createdAt") VALUES ($1,$2,$3,NOW()) ON CONFLICT DO NOTHING', [organizationId, membership.rows[0].id, role.rows[0].id]);
    process.stdout.write(email ? 'manager-ready' : '');
  } else throw new Error('Unknown fixture operation.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
