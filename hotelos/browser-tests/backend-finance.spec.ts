import { expect, test } from '@playwright/test';

const token = process.env.HOTEL_OS_DEV_TOKEN;
const runId = `${Date.now()}`;
const guestName = `Finance Browser ${runId}`;
const categoryName = `Finance Category ${runId}`;
const isoDay = (offset: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const payload = async (response: { json: () => Promise<unknown> }) => {
  const body = await response.json() as { data?: unknown };
  return body.data ?? body;
};

test('UI persists invoice, manual payment, receipt, refund and expense in PostgreSQL', async ({ page, request }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const api = 'http://localhost:3000/api/v1';
  const hotelsResponse = await request.get(`${api}/hotels`, { headers });
  expect(hotelsResponse.ok()).toBeTruthy();
  const hotels = await payload(hotelsResponse) as Array<{ id: string }>;
  const hotelId: string = hotels[0].id;

  const categoryResponse = await request.post(`${api}/hotels/${hotelId}/room-categories`, { headers, data: { name: categoryName, basePrice: 30_000, capacity: 2, bedConfiguration: 'Queen', amenities: [] } });
  expect(categoryResponse.ok()).toBeTruthy();
  const category = await payload(categoryResponse) as { id: string };
  const roomResponse = await request.post(`${api}/hotels/${hotelId}/rooms`, { headers, data: { number: `F${runId.slice(-5)}`, floor: 1, categoryId: category.id } });
  expect(roomResponse.ok()).toBeTruthy();
  const room = await payload(roomResponse) as { id: string };
  const guestResponse = await request.post(`${api}/hotels/${hotelId}/guests`, { headers, data: { fullName: guestName, email: `finance-${runId}@example.test`, phone: '+2348000000077' } });
  expect(guestResponse.ok()).toBeTruthy();
  const guest = await payload(guestResponse) as { id: string };
  const reservationResponse = await request.post(`${api}/hotels/${hotelId}/reservations`, { headers, data: { roomId: room.id, guestId: guest.id, checkIn: isoDay(0), checkOut: isoDay(1), adults: 1, children: 0, status: 'CONFIRMED' } });
  expect(reservationResponse.ok()).toBeTruthy();
  const reservation = await payload(reservationResponse) as { id: string };
  const checkedIn = await request.post(`${api}/hotels/${hotelId}/reservations/${reservation.id}/status`, { headers, data: { status: 'CHECKED_IN' } });
  expect(checkedIn.ok()).toBeTruthy();
  const roomCharges = await request.post(`${api}/hotels/${hotelId}/reservations/${reservation.id}/folio/room-charges`, { headers: { ...headers, 'Idempotency-Key': `browser-room-${runId}` } });
  expect(roomCharges.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByText('Local development sign-in').click();
  await page.getByLabel('Short-lived backend token').fill(token!);
  await page.getByRole('button', { name: 'Connect with development token' }).click();
  await expect(page).toHaveURL(/\/(dashboard|billing|front-desk)/);
  await page.goto('/billing/folios');
  const folioRow = page.getByRole('row').filter({ hasText: guestName });
  await expect(folioRow).toBeVisible();
  await folioRow.click();
  await page.getByRole('button', { name: 'Add charge' }).click();
  await page.getByLabel('Amount').fill('1250');
  await page.getByLabel('Description').fill('Browser minibar');
  await page.getByRole('button', { name: 'Add charge' }).last().click();
  await expect(page.getByText('Charge added to folio')).toBeVisible();
  await page.getByRole('button', { name: 'Invoice', exact: true }).click();
  await expect(page.getByText(/Persisted invoice INV-/)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByLabel('Amount').fill('10000');
  await page.getByRole('button', { name: 'Record payment' }).last().click();
  await expect(page.getByText('Payment recorded')).toBeVisible();

  await page.goto('/billing/payments');
  const paymentRow = page.getByRole('row').filter({ hasText: guestName });
  await expect(paymentRow).toBeVisible();
  await paymentRow.getByRole('button', { name: 'Receipt' }).click();
  await expect(page.getByRole('heading', { name: 'Receipt preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();

  await page.goto('/billing/refunds');
  await page.getByRole('button', { name: 'New refund request' }).click();
  const bookingSelect = page.getByLabel('Booking');
  await bookingSelect.selectOption(await bookingSelect.locator('option').filter({ hasText: guestName }).getAttribute('value') ?? '');
  await page.getByLabel('Amount').fill('100');
  await page.getByLabel('Reason').fill('Browser refund verification');
  await page.getByRole('button', { name: 'Submit request' }).click();
  const refundRow = page.getByRole('row').filter({ hasText: guestName });
  await expect(refundRow).toBeVisible();
  await refundRow.getByRole('button', { name: 'Approve' }).click();
  await refundRow.getByRole('button', { name: 'Record payout' }).click();
  await expect(refundRow.getByText('Processed')).toBeVisible();

  await page.goto('/finance/expenses');
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByLabel('Vendor').fill(`Browser Vendor ${runId}`);
  await page.getByLabel('Amount').fill('2500');
  await page.getByLabel('Date').fill(isoDay(0));
  await page.getByLabel('Description').fill('Browser expense persistence');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByRole('table').getByText(`Browser Vendor ${runId}`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('table').getByText(`Browser Vendor ${runId}`)).toBeVisible();

  const [folios, invoices, payments, refunds, expenses] = await Promise.all([
    request.get(`${api}/hotels/${hotelId}/folios`, { headers }),
    request.get(`${api}/hotels/${hotelId}/invoices`, { headers }),
    request.get(`${api}/hotels/${hotelId}/payments`, { headers }),
    request.get(`${api}/hotels/${hotelId}/refunds`, { headers }),
    request.get(`${api}/hotels/${hotelId}/expenses`, { headers }),
  ]);
  expect((await payload(folios) as Array<{ reservationId: string; entries: unknown[] }>).find((item) => item.reservationId === reservation.id)?.entries.length).toBeGreaterThan(1);
  expect((await payload(invoices) as Array<{ folio: { reservationId: string } }>).some((item) => item.folio.reservationId === reservation.id)).toBeTruthy();
  expect((await payload(payments) as Array<{ folio: { reservationId: string } }>).some((item) => item.folio.reservationId === reservation.id)).toBeTruthy();
  expect((await payload(refunds) as Array<{ payment: { folio: { reservationId: string } } }>).some((item) => item.payment.folio.reservationId === reservation.id)).toBeTruthy();
  expect((await payload(expenses) as Array<{ vendor: string }>).some((item) => item.vendor === `Browser Vendor ${runId}`)).toBeTruthy();
});

