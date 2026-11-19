import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const token = process.env.HOTEL_OS_DEV_TOKEN;
const runId = Date.now().toString();
const taskNotes = `Browser housekeeping ${runId}`;
const requestTitle = `Browser repair ${runId}`;
const backendPath = resolve(process.cwd(), '..', 'backend');

const mintToken = (subject: string, email: string) => execFileSync(process.execPath, [resolve(backendPath, 'scripts/create-dev-token.cjs'), subject, email], { cwd: backendPath, encoding: 'utf8' }).trim();

async function inviteMember(request: import('@playwright/test').APIRequestContext, managerHeaders: Record<string, string>, roleName: string, email: string, subject: string) {
  const rolesResponse = await request.get('http://localhost:3000/api/v1/roles', { headers: managerHeaders });
  const rolesBody = await rolesResponse.json() as { data: Array<{ id: string; name: string; hotelId: string | null }> };
  const role = rolesBody.data.find((item) => item.name === roleName && item.hotelId === null);
  expect(role, `${roleName} role exists in the access catalogue`).toBeTruthy();
  const invitationResponse = await request.post('http://localhost:3000/api/v1/memberships/invitations', { headers: managerHeaders, data: { email, roleIds: [role!.id] } });
  expect(invitationResponse.ok()).toBeTruthy();
  const outboxResponse = await request.get('http://localhost:3000/api/v1/memberships/invitations/outbox', { headers: managerHeaders });
  expect(outboxResponse.ok()).toBeTruthy();
  const outbox = await outboxResponse.json() as { data: Array<{ to: string; text: string }> };
  const message = outbox.data.find((item) => item.to === email);
  expect(message, 'invitation message is available in the protected local outbox').toBeTruthy();
  const inviteToken = message!.text.match(/accept-invitation\?token=([^\s]+)/)?.[1];
  expect(inviteToken).toBeTruthy();
  const memberToken = mintToken(subject, email);
  await request.get('http://localhost:3000/api/v1/hotels', { headers: { Authorization: `Bearer ${memberToken}` } });
  const accepted = await request.post('http://localhost:3000/api/v1/memberships/invitations/accept', { headers: { Authorization: `Bearer ${memberToken}` }, data: { token: decodeURIComponent(inviteToken!) } });
  expect(accepted.ok()).toBeTruthy();
  return memberToken;
}

async function loginStaff(page: import('@playwright/test').Page, memberToken: string, hotelId: string) {
  await page.goto('http://localhost:5173/login');
  await page.getByText('Local development sign-in').click();
  await page.getByLabel('Short-lived backend token').fill(memberToken);
  await page.getByRole('button', { name: 'Connect with development token' }).click();
  await expect(page).toHaveURL(/\/(front-desk|dashboard|reservations)/);
  await page.evaluate((id) => {
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem('hotelos-app');
      if (!raw) continue;
      const state = JSON.parse(raw) as { state: Record<string, unknown> };
      state.state.hotelId = id;
      storage.setItem('hotelos-app', JSON.stringify(state));
    }
  }, hotelId);
  await page.reload();
}

test('housekeeping and maintenance workflows persist through the PostgreSQL UI', async ({ page, request, browser }) => {
  const headers = { Authorization: `Bearer ${token}` };

  await page.goto('/login');
  await page.getByText('Local development sign-in').click();
  await page.getByLabel('Short-lived backend token').fill(token!);
  await page.getByRole('button', { name: 'Connect with development token' }).click();
  await expect(page).toHaveURL(/\/(front-desk|dashboard|reservations)/);

  const hotelsResponse = await request.get('http://localhost:3000/api/v1/hotels', { headers });
  expect(hotelsResponse.ok()).toBeTruthy();
  const hotelsBody = await hotelsResponse.json() as { data: Array<{ id: string }> };
  const hotelId = hotelsBody.data[0]?.id;
  expect(hotelId).toBeTruthy();
  const housekeepingEmail = `housekeeper-${runId}@example.test`;
  const technicianEmail = `technician-${runId}@example.test`;
  const housekeepingToken = await inviteMember(request, headers, 'Housekeeping', housekeepingEmail, `browser-housekeeper-${runId}`);
  const technicianToken = await inviteMember(request, headers, 'Maintenance', technicianEmail, `browser-technician-${runId}`);
  const housekeepingCandidatesResponse = await request.get(`http://localhost:3000/api/v1/hotels/${hotelId}/operations-staff/candidates?area=housekeeping`, { headers });
  const housekeepingCandidates = (await housekeepingCandidatesResponse.json() as { data: Array<{ userId: string; email: string | null }> }).data;
  const housekeeperId = housekeepingCandidates.find((item) => item.email === housekeepingEmail)?.userId;
  expect(housekeeperId).toBeTruthy();
  const technicianCandidatesResponse = await request.get(`http://localhost:3000/api/v1/hotels/${hotelId}/operations-staff/candidates?area=maintenance`, { headers });
  const technicianCandidates = (await technicianCandidatesResponse.json() as { data: Array<{ userId: string; email: string | null }> }).data;
  const technicianId = technicianCandidates.find((item) => item.email === technicianEmail)?.userId;
  expect(technicianId).toBeTruthy();
  await page.evaluate((id) => {
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem('hotelos-app');
      if (!raw) continue;
      const state = JSON.parse(raw) as { state: Record<string, unknown> };
      state.state.hotelId = id;
      storage.setItem('hotelos-app', JSON.stringify(state));
    }
  }, hotelId!);
  await page.reload();

  await page.goto('/housekeeping');
  await page.getByRole('button', { name: 'Add staff' }).click();
  const hkStaffDialog = page.getByRole('dialog', { name: 'Add housekeeping staff' });
  await expect(hkStaffDialog.getByLabel('Organization member')).toBeVisible();
  await hkStaffDialog.getByLabel('Organization member').selectOption(housekeeperId!);
  await hkStaffDialog.getByRole('button', { name: 'Add staff' }).click();
  await expect(hkStaffDialog).toBeHidden();

  await page.getByRole('button', { name: 'New task' }).click();
  const taskDialog = page.getByRole('dialog', { name: 'New cleaning task' });
  const roomSelect = taskDialog.getByLabel('Room');
  const roomId = await roomSelect.locator('option').nth(0).getAttribute('value');
  const roomLabel = (await roomSelect.locator('option').nth(0).textContent()) ?? '';
  const roomNumber = roomLabel.split(/[\sâ€”-]/)[0];
  expect(roomId).toBeTruthy();
  await roomSelect.selectOption(roomId!);
  await taskDialog.getByLabel('Instructions').fill('Clean, reset amenities and report defects.');
  await taskDialog.getByLabel('Notes').fill(taskNotes);
  await taskDialog.getByRole('button', { name: 'Create task' }).click();
  await expect(taskDialog).toBeHidden();

  const taskRow = page.getByRole('row').filter({ hasText: roomNumber });
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole('button', { name: 'Assign' }).click();
  const assignDialog = page.getByRole('dialog', { name: new RegExp(`Assign room ${roomNumber}`) });
  await expect(assignDialog.getByLabel('Team member')).toBeVisible();
  await assignDialog.getByLabel('Team member').selectOption(housekeeperId!);
  await assignDialog.getByRole('button', { name: 'Assign' }).click();
  await expect(assignDialog).toBeHidden();

  const housekeepingContext = await browser.newContext();
  const housekeepingPage = await housekeepingContext.newPage();
  await loginStaff(housekeepingPage, housekeepingToken, hotelId!);
  await housekeepingPage.goto('http://localhost:5173/housekeeping');
  const staffTaskRow = housekeepingPage.getByRole('row').filter({ hasText: roomNumber });
  await staffTaskRow.getByRole('button', { name: 'Start' }).click();
  await staffTaskRow.getByRole('button', { name: 'Complete' }).click();
  const completeDialog = housekeepingPage.getByRole('dialog', { name: `Complete room ${roomNumber}` });
  await completeDialog.getByLabel('Completion notes').fill('Room cleaned and reset.');
  await completeDialog.getByRole('button', { name: 'Complete cleaning' }).click();
  await expect(completeDialog).toBeHidden();
  await housekeepingContext.close();

  await page.goto('/housekeeping');
  const inspectionTaskRow = page.getByRole('row').filter({ hasText: roomNumber });
  await inspectionTaskRow.getByRole('button', { name: 'Inspect' }).click();
  const inspectDialog = page.getByRole('dialog', { name: `Inspect room ${roomNumber}` });
  await inspectDialog.getByRole('button', { name: 'Pass inspection' }).click();
  await expect(inspectDialog).toBeHidden();

  const roomResponse = await request.get(`http://localhost:3000/api/v1/hotels/${hotelId}/rooms`, { headers });
  const roomBody = await roomResponse.json() as { data: Array<{ id: string; status: string }> };
  expect(roomBody.data.find((room) => room.id === roomId)?.status).toBe('INSPECTED');

  await page.goto('/maintenance');
  await page.getByRole('button', { name: 'Add technician' }).click();
  const techDialog = page.getByRole('dialog', { name: 'Add maintenance staff' });
  await expect(techDialog.getByLabel('Organization member')).toBeVisible();
  await techDialog.getByLabel('Organization member').selectOption(technicianId!);
  await techDialog.getByRole('button', { name: 'Add staff' }).click();
  await expect(techDialog).toBeHidden();

  await page.getByRole('button', { name: 'New request' }).click();
  const requestDialog = page.getByRole('dialog', { name: 'New maintenance request' });
  await requestDialog.getByLabel('Room', { exact: true }).selectOption(roomId!);
  await requestDialog.getByLabel('Request title').fill(requestTitle);
  await requestDialog.getByLabel('Description').fill('Test a repair lifecycle and release the room for cleaning.');
  await requestDialog.getByLabel('Take the room out of sale until resolved').check();
  await requestDialog.getByRole('button', { name: 'Log request' }).click();
  await expect(requestDialog).toBeHidden();

  const maintenanceRow = page.getByRole('row').filter({ hasText: requestTitle });
  await expect(maintenanceRow).toBeVisible();
  await maintenanceRow.click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('Technician').selectOption(technicianId!);
  await drawer.getByRole('button', { name: 'Create and assign' }).click();

  const technicianContext = await browser.newContext();
  const technicianPage = await technicianContext.newPage();
  await loginStaff(technicianPage, technicianToken, hotelId!);
  await technicianPage.goto('http://localhost:5173/maintenance');
  const technicianRow = technicianPage.getByRole('row').filter({ hasText: requestTitle });
  await technicianRow.click();
  const technicianDrawer = technicianPage.getByRole('dialog');
  await technicianDrawer.getByRole('button', { name: 'Start work' }).click();
  await technicianDrawer.getByLabel('Resolution notes').fill('Waiting for a replacement part.');
  await technicianDrawer.getByRole('button', { name: 'On hold' }).click();
  await technicianDrawer.getByRole('button', { name: 'Resume work' }).click();
  await technicianDrawer.getByLabel('Resolution notes').fill('Replaced the faulty component and tested operation.');
  await technicianDrawer.getByRole('button', { name: 'Complete work' }).click();
  await technicianContext.close();

  await page.goto('/maintenance');
  await page.getByRole('row').filter({ hasText: requestTitle }).click();
  const managerDrawer = page.getByRole('dialog');
  await managerDrawer.getByRole('button', { name: 'Close work order' }).click();

  await expect.poll(async () => {
    const maintenanceResponse = await request.get(`http://localhost:3000/api/v1/hotels/${hotelId}/maintenance/requests`, { headers });
    const maintenanceBody = await maintenanceResponse.json() as { data: Array<{ id: string; title: string; workOrder: { status: string } | null }> };
    return maintenanceBody.data.find((item) => item.title === requestTitle)?.workOrder?.status;
  }).toBe('CLOSED');
  const finalRooms = await request.get(`http://localhost:3000/api/v1/hotels/${hotelId}/rooms`, { headers });
  const finalRoomsBody = await finalRooms.json() as { data: Array<{ id: string; status: string }> };
  expect(finalRoomsBody.data.find((room) => room.id === roomId)?.status).toBe('DIRTY');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/housekeeping', '/maintenance']) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(widths.scroll, `${route} should fit a mobile viewport`).toBeLessThanOrEqual(widths.client + 1);
  }
});

