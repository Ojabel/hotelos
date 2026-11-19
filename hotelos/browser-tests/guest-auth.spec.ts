import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const backendPath = resolve(process.cwd(), '..', 'backend');
const runId = `${Date.now()}`;
const newEmail = `guest-new-${runId}@example.test`;
const existingEmail = `guest-existing-${runId}@example.test`;
const duplicateEmail = `guest-duplicate-${runId}@example.test`;
const staffEmail = `staff-verifier-${runId}@example.test`;
const foreignEmail = `guest-foreign-${runId}@example.test`;
const password = 'HotelOS!Guest12345';
const firebaseApi = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
const project = 'hotelos-local';
const api = 'http://localhost:3000/api/v1';

async function emulatorRequest(page: import('@playwright/test').Page, method: string, body: Record<string, unknown>, endpoint = 'signUp') {
  return page.evaluate(async ({ url, requestMethod, data }) => {
    const response = await fetch(url, { method: requestMethod, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  }, { url: `${firebaseApi}:${endpoint}?key=fake-api-key`, requestMethod: method, data: body });
}

async function register(page: import('@playwright/test').Page, email: string) {
  const result = await emulatorRequest(page, 'POST', { email, password, returnSecureToken: true });
  expect(result.status).toBe(200);
  const account = result.body as { localId: string; idToken: string };
  const verify = await emulatorRequest(page, 'POST', { requestType: 'VERIFY_EMAIL', idToken: account.idToken }, 'sendOobCode');
  expect(verify.status).toBe(200);
  const codes = await page.request.get(`http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`);
  const data = await codes.json() as { oobCodes: Array<{ email: string; oobCode: string }> };
  const code = data.oobCodes.find((item) => item.email === email)?.oobCode;
  expect(code).toBeTruthy();
  const applied = await emulatorRequest(page, 'POST', { oobCode: code }, 'update');
  expect(applied.status).toBe(200);
  const refreshed = await emulatorRequest(page, 'POST', { email, password, returnSecureToken: true }, 'signInWithPassword');
  return refreshed.body as { localId: string; idToken: string };
}

async function verifyExistingAccount(page: import('@playwright/test').Page, email: string) {
  const signedIn = await emulatorRequest(page, 'POST', { email, password, returnSecureToken: true }, 'signInWithPassword');
  expect(signedIn.status).toBe(200);
  const account = signedIn.body as { idToken: string };
  const verify = await emulatorRequest(page, 'POST', { requestType: 'VERIFY_EMAIL', idToken: account.idToken }, 'sendOobCode');
  expect(verify.status).toBe(200);
  const codes = await page.request.get(`http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`);
  const data = await codes.json() as { oobCodes: Array<{ email: string; oobCode: string }> };
  const code = data.oobCodes.find((item) => item.email === email)?.oobCode;
  expect(code).toBeTruthy();
  const applied = await emulatorRequest(page, 'POST', { oobCode: code }, 'update');
  expect(applied.status).toBe(200);
  const refreshed = await emulatorRequest(page, 'POST', { email, password, returnSecureToken: true }, 'signInWithPassword');
  return refreshed.body as { idToken: string };
}

async function createExistingFixture(email: string) {
  const output = execFileSync(process.execPath, [resolve(backendPath, 'scripts/guest-browser-fixture.cjs'), 'existing-guest', email], { cwd: backendPath, encoding: 'utf8' });
  return JSON.parse(output) as { hotelId: string; guestId: string; reservationId: string };
}

test('Firebase guest signup, verification, linking conflicts, authorization and portal persistence', async ({ page, request }) => {
  const fixture = await createExistingFixture(existingEmail);
  const duplicateFixture = await createExistingFixture(duplicateEmail);
  await createExistingFixture(duplicateEmail);
  const foreignFixture = await createExistingFixture(foreignEmail);

  await page.goto('/guest-portal');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Full name').fill('New Browser Guest');
  await page.getByLabel('Email').fill(newEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create guest account' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  const newAccount = await verifyExistingAccount(page, newEmail);
  await page.getByRole('button', { name: 'I verified my email' }).click();
  await expect(page.getByRole('heading', { name: 'Your guest space' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your guest space' })).toBeVisible();

  const ownProfile = await request.get(`${api}/guest/me`, { headers: { Authorization: `Bearer ${newAccount.idToken}` } });
  expect(ownProfile.status()).toBe(200);
  const publicHotelSelection = await request.post(`${api}/guest/account/resolve`, { headers: { Authorization: `Bearer ${newAccount.idToken}` }, data: { fullName: 'Updated Browser Guest', hotelId: fixture.hotelId } });
  expect(publicHotelSelection.status()).toBe(400);
  const ownReservations = await request.get(`${api}/guest/reservations`, { headers: { Authorization: `Bearer ${newAccount.idToken}` } });
  expect(ownReservations.status()).toBe(200);
  const profileUpdate = await request.patch(`${api}/guest/me`, { headers: { Authorization: `Bearer ${newAccount.idToken}` }, data: { fullName: 'Updated Browser Guest', phone: '+2348000000000', preferences: ['quiet room'] } });
  expect(profileUpdate.status()).toBe(200);
  const ownServiceRequest = await request.post(`${api}/guest/service-requests`, { headers: { Authorization: `Bearer ${newAccount.idToken}` }, data: { hotelId: fixture.hotelId, category: 'Extra towels', description: 'Please provide two extra towels.' } });
  expect(ownServiceRequest.status()).toBe(201);
  expect((await request.get(`${api}/guest/service-requests`, { headers: { Authorization: `Bearer ${newAccount.idToken}` } })).status()).toBe(200);
  const guestFinance = await request.get(`${api}/hotels/${fixture.hotelId}/expenses`, { headers: { Authorization: `Bearer ${newAccount.idToken}` } });
  expect([401, 403]).toContain(guestFinance.status());
  const guestAdmin = await request.get(`${api}/organizations/current`, { headers: { Authorization: `Bearer ${newAccount.idToken}` } });
  expect([401, 403]).toContain(guestAdmin.status());
  const noInvite = await request.post(`${api}/memberships/invitations/accept`, { headers: { Authorization: `Bearer ${newAccount.idToken}` }, data: { token: 'x'.repeat(40) } });
  expect(noInvite.ok()).toBe(false);

  const existingAccount = await register(page, existingEmail);
  const unsafeLink = await request.post(`${api}/guest/account/resolve`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` }, data: { fullName: 'Attempted Email Link' } });
  expect(unsafeLink.status()).toBe(409);
  const identityId = execFileSync(process.execPath, [resolve(backendPath, 'scripts/guest-browser-fixture.cjs'), 'identity', existingEmail], { cwd: backendPath, encoding: 'utf8' }).trim();
  const existingRead = await request.get(`${api}/guest/me`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } });
  expect(existingRead.status()).toBe(404);

  const duplicateAccount = await register(page, duplicateEmail);
  const duplicateResolve = await request.post(`${api}/guest/account/resolve`, { headers: { Authorization: `Bearer ${duplicateAccount.idToken}` }, data: { fullName: 'Duplicate Browser Guest' } });
  expect(duplicateResolve.status()).toBe(409);

  const foreignRead = await request.get(`${api}/guest/reservations/${foreignFixture.reservationId}`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } });
  expect(foreignRead.status()).toBe(404);
  const foreignCancel = await request.post(`${api}/guest/reservations/${foreignFixture.reservationId}/cancel`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } });
  expect(foreignCancel.status()).toBe(404);
  const unverified = await emulatorRequest(page, 'POST', { email: `unverified-${runId}@example.test`, password, returnSecureToken: true });
  const unverifiedToken = (unverified.body as { idToken: string }).idToken;
  expect((await request.get(`${api}/guest/me`, { headers: { Authorization: `Bearer ${unverifiedToken}` } })).status()).toBe(403);

  const staffAccount = await register(page, staffEmail);
  expect((await request.get(`${api}/auth/me`, { headers: { Authorization: `Bearer ${staffAccount.idToken}` } })).status()).toBe(200);
  const promoted = execFileSync(process.execPath, [resolve(backendPath, 'scripts/guest-browser-fixture.cjs'), 'promote-manager', staffAccount.localId, staffEmail], { cwd: backendPath, encoding: 'utf8' });
  expect(promoted).toContain('manager-ready');
  const staffHeaders = { Authorization: `Bearer ${staffAccount.idToken}` };
  const linkResponse = await request.post(`${api}/guest/identity-links/staff-verified`, { headers: staffHeaders, data: { hotelId: fixture.hotelId, guestId: fixture.guestId, identityId, verificationMethod: 'RESERVATION_VERIFICATION', verificationCaseReference: `CASE-${runId}` } });
  expect(linkResponse.status()).toBe(201);
  const duplicateIdentityId = execFileSync(process.execPath, [resolve(backendPath, 'scripts/guest-browser-fixture.cjs'), 'identity', duplicateEmail], { cwd: backendPath, encoding: 'utf8' });
  const ambiguousLink = await request.post(`${api}/guest/identity-links/staff-verified`, { headers: staffHeaders, data: { hotelId: duplicateFixture.hotelId, guestId: duplicateFixture.guestId, identityId: duplicateIdentityId, verificationMethod: 'MANAGER_REVIEW', verificationCaseReference: `CASE-DUP-${runId}` } });
  expect(ambiguousLink.status()).toBe(409);
  const linkedProfile = await request.get(`${api}/guest/me`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } });
  expect(linkedProfile.status()).toBe(200);
  expect((await linkedProfile.json()).data.id).toBe(fixture.guestId);
  const linkedReservations = await request.get(`${api}/guest/reservations`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } });
  const rows = (await linkedReservations.json()).data as Array<{ id: string }>;
  expect(rows.some(({ id }) => id === fixture.reservationId)).toBe(true);
  expect((await request.get(`${api}/guest/reservations/${fixture.reservationId}`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } })).status()).toBe(200);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/guest-site');
  await page.goto('/guest-portal');
  await expect(page.getByText('Secure guest access')).toBeVisible();
  await page.getByLabel('Email').fill(existingEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Your guest space' })).toBeVisible();
  const removed = await emulatorRequest(page, 'POST', { idToken: existingAccount.idToken }, 'delete');
  expect(removed.status).toBe(200);
  expect((await request.get(`${api}/guest/me`, { headers: { Authorization: `Bearer ${existingAccount.idToken}` } })).status()).toBe(401);
  await page.goto('/guest-portal');
  await expect(page.getByText('Secure guest access')).toBeVisible();
  await expect(page.getByText('Existing Browser Guest')).toHaveCount(0);
});

test('Google sign-in is presented only in guest authentication and Firebase identity verification is enforced', async ({ page, request }) => {
  await page.goto('/guest-portal');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await page.getByLabel('Email').fill(`unknown-${runId}@example.test`);
  await page.getByRole('button', { name: 'Send reset instructions' }).click();
  await expect(page.getByRole('status')).toContainText(/if an account exists/i);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const google = page.getByRole('button', { name: 'Continue with Google' });
  await expect(google).toBeVisible();
  const unverified = await emulatorRequest(page, 'POST', { email: `unverified-google-${runId}@example.test`, password, returnSecureToken: true });
  const token = (unverified.body as { idToken: string }).idToken;
  expect((await request.post(`${api}/guest/account/resolve`, { headers: { Authorization: `Bearer ${token}` }, data: { fullName: 'Unverified Google Test' } })).status()).toBe(403);
  let googleIdToken: string | undefined;
  page.on('request', (outgoing) => {
    if (outgoing.url().endsWith('/api/v1/guest/account/resolve')) googleIdToken = outgoing.headers().authorization?.replace(/^Bearer\s+/i, '');
  });
  await google.click();
  await expect(page.getByRole('heading', { name: 'Your guest space' })).toBeVisible();
  await expect.poll(() => googleIdToken).toBeTruthy();
  expect((await request.get(`${api}/guest/me`, { headers: { Authorization: `Bearer ${googleIdToken}` } })).status()).toBe(200);
});
