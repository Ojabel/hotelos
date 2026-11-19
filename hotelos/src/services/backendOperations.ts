import type { Guest, Reservation, Room, RoomCategory, RoomStatus, ReservationStatus, Result, PaymentMethod, Payment, Refund, Expense, FolioCharge, ChargeCategory, HousekeepingTask, InspectionRecord, MaintenanceRequest, StaffMember } from '@/types';
import type { HotelGuestRecord, HotelReservationRecord, HotelRoomRecord, RoomCategoryRecord, HousekeepingTaskRecord, MaintenanceRequestRecord, OperationsStaffRecord } from '@/services/api/hotelOperations';
import { hotelOperationsApi } from '@/services/api/hotelOperations';
import { ApiClientError } from '@/services/api/client';
import { setBackendCategories } from '@/services/api/backendMode';
import { useHotelStore } from '@/store/useHotelStore';
import type { FinancialExpenseRecord, FinancialFolioRecord, FinancialPaymentRecord, FinancialRefundRecord } from '@/services/api/hotelOperations';

const roomStatuses: Record<HotelRoomRecord['status'], RoomStatus> = {
  AVAILABLE: 'available', RESERVED: 'reserved', OCCUPIED: 'occupied', DIRTY: 'dirty', CLEANING: 'cleaning',
  INSPECTED: 'inspected', MAINTENANCE: 'maintenance', OUT_OF_SERVICE: 'out_of_service',
};
const reservationStatuses: Record<HotelReservationRecord['status'], ReservationStatus> = {
  PENDING: 'pending', CONFIRMED: 'confirmed', CHECKED_IN: 'checked_in', CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled', NO_SHOW: 'no_show', EXPIRED: 'expired',
};
const category = (c: RoomCategoryRecord): RoomCategory => ({ ...c, description: c.description ?? '' });
const guest = (g: HotelGuestRecord): Guest => ({
  id: g.id, fullName: g.fullName, email: g.email ?? '', phone: g.phone ?? '', nationality: g.nationality ?? '',
  vip: false, idType: 'National ID', idNumber: '—', preferences: [], createdAt: g.createdAt.slice(0, 10),
});
const room = (r: HotelRoomRecord): Room => ({ id: r.id, hotelId: r.hotelId, number: r.number, floor: r.floor, categoryId: r.categoryId, status: roomStatuses[r.status] });
const reservation = (r: HotelReservationRecord): Reservation => ({
  id: r.id, reference: r.reference, guestId: r.guestId, hotelId: r.hotelId, roomId: r.roomId, categoryId: r.categoryId,
  checkIn: r.checkIn.slice(0, 10), checkOut: r.checkOut.slice(0, 10), adults: r.adults, children: r.children,
  status: reservationStatuses[r.status], nightlyRate: r.nightlyRate, total: r.total, deposit: 0, paid: 0,
  createdAt: r.createdAt.slice(0, 10), notes: r.notes ?? undefined,
});

async function optionalForPermission<T>(request: Promise<T>, fallback: T): Promise<T> {
  try { return await request; }
  catch (error) {
    if (error instanceof ApiClientError && error.status === 403) return fallback;
    throw error;
  }
}

export async function loadHotelOperations(hotelId: string) {
  const [categories, rooms, guests, reservations] = await Promise.all([
    hotelOperationsApi.listCategories(hotelId), hotelOperationsApi.listRooms(hotelId),
    optionalForPermission(hotelOperationsApi.listGuests(hotelId), []),
    optionalForPermission(hotelOperationsApi.listReservations(hotelId), []),
  ]);
  setBackendCategories(categories.map(category));
  const store = useHotelStore.getState();
  store.setRooms(() => rooms.map(room));
  store.setGuests(() => guests.map(guest));
  store.setReservations(() => reservations.map(reservation));
  await loadFinancial(hotelId);
  await loadFacilities(hotelId);
}

const result = async <T, U>(task: () => Promise<T>, map: (value: T) => U): Promise<Result<U>> => {
  try { return { ok: true, value: map(await task()) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'The backend operation failed.' }; }
};
const refresh = async (hotelId: string) => loadHotelOperations(hotelId);
const refreshFinancial = async (hotelId: string) => loadFinancial(hotelId);
const paymentMethod = (method: PaymentMethod): FinancialPaymentRecord['method'] => ({ cash: 'CASH', bank_transfer: 'BANK_TRANSFER', pos: 'CARD', online: 'OTHER' })[method] as FinancialPaymentRecord['method'];
const paymentView = (p: FinancialPaymentRecord & { folio?: { guestId: string; reservationId: string; hotelId: string }; receipt?: { id: string; reference: string } }): Payment => ({ id: p.id, reference: p.reference, reservationId: p.folio?.reservationId ?? '', guestId: p.folio?.guestId ?? '', hotelId: p.folio?.hotelId ?? '', amount: p.amountMinor / 100, method: ({ CASH: 'cash', BANK_TRANSFER: 'bank_transfer', CARD: 'pos', OTHER: 'online' })[p.method] as PaymentMethod, status: p.status === 'RECORDED' ? 'paid' : 'refunded', date: p.receivedAt.slice(0, 10), currency: p.currency, receiptId: p.receipt?.id, receiptReference: p.receipt?.reference });
const refundView = (r: FinancialRefundRecord & { payment?: { folio?: { reservationId: string; guestId: string; hotelId: string } } }): Refund => ({ id: r.id, reference: r.reference, reservationId: r.payment?.folio?.reservationId ?? '', guestId: r.payment?.folio?.guestId ?? '', hotelId: r.payment?.folio?.hotelId ?? '', amount: r.amountMinor / 100, currency: r.currency, reason: r.reason, status: r.status.toLowerCase() as Refund['status'], requestedAt: r.requestedAt.slice(0, 10), paymentId: r.paymentId });
const expenseView = (e: FinancialExpenseRecord): Expense => ({ id: e.id, hotelId: e.hotelId, date: e.expenseDate.slice(0, 10), category: e.category.name, vendor: e.vendor, description: e.description, amount: e.amountMinor / 100, method: ({ CASH: 'cash', BANK_TRANSFER: 'bank_transfer', CARD: 'pos', OTHER: 'online' })[e.method] as PaymentMethod, status: e.status.toLowerCase() as Expense['status'] });
const loadFinancial = async (hotelId: string) => {
  const [folios, payments, refunds, expenses] = await Promise.all([
    optionalForPermission(hotelOperationsApi.listFolios(hotelId), []),
    optionalForPermission(hotelOperationsApi.listPayments(hotelId), []),
    optionalForPermission(hotelOperationsApi.listRefunds(hotelId), []),
    optionalForPermission(hotelOperationsApi.listExpenses(hotelId), []),
  ]);
  const store = useHotelStore.getState();
    store.setCharges(() => folios.flatMap((folio: FinancialFolioRecord) => folio.entries.filter((entry) => ['ROOM_CHARGE', 'SERVICE_CHARGE', 'ADJUSTMENT'].includes(entry.kind)).map((entry) => ({ id: entry.id, reservationId: folio.reservationId, date: entry.serviceDate.slice(0, 10), category: entry.kind === 'ROOM_CHARGE' ? 'room' : 'other', description: entry.description, amount: entry.amountMinor / 100, currency: entry.currency, kind: entry.kind === 'ROOM_CHARGE' ? 'room' : entry.kind === 'ADJUSTMENT' ? 'adjustment' : 'service', reason: entry.reason ?? undefined } as FolioCharge))));
  store.setPayments(() => payments.map((p) => paymentView(p)));
  store.setRefunds(() => refunds.map((r) => refundView(r)));
  store.setExpenses(() => expenses.map(expenseView));
};

const priorityView = (value: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') => value.toLowerCase() as HousekeepingTask['priority'];
const taskView = (task: HousekeepingTaskRecord): HousekeepingTask => ({
  id: task.id, hotelId: task.hotelId, roomId: task.roomId,
  type: task.type === 'DAILY' ? 'daily' : task.type === 'DEEP' || task.type === 'MAINTENANCE_RETURN' ? 'deep' : 'turnover',
  priority: priorityView(task.priority),
  status: task.status === 'APPROVED' ? 'inspected' : task.status === 'AWAITING_INSPECTION' || task.status === 'COMPLETED' ? 'completed' : task.status.toLowerCase() as HousekeepingTask['status'],
  assigneeId: task.assignee?.id, date: task.createdAt.slice(0, 10), dueAt: task.dueAt?.slice(0, 10), completedAt: task.completedAt?.slice(0, 10) ?? undefined,
  notes: task.notes ?? task.instructions ?? undefined,
});
const staffViews = (hotelId: string, items: OperationsStaffRecord[], department: StaffMember['department']): StaffMember[] => items.map((item) => ({
  id: item.userId, hotelId, name: item.name, title: item.roleNames.join(', ') || department, department,
  phone: '', email: item.email ?? '', status: 'active', monthlySalary: 0, hiredAt: new Date().toISOString().slice(0, 10),
}));
const maintenanceStatus = (request: MaintenanceRequestRecord): MaintenanceRequest['status'] => {
  const status = request.workOrder?.status;
  if (request.status === 'CLOSED' || status === 'CLOSED') return 'resolved';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'ON_HOLD') return 'on_hold';
  if (status === 'AWAITING_PARTS') return 'awaiting_parts';
  if (status === 'IN_PROGRESS') return 'in_progress';
  if (status === 'ASSIGNED') return 'assigned';
  if (request.workOrder) return 'open';
  return 'open';
};
const maintenanceView = (request: MaintenanceRequestRecord): MaintenanceRequest => ({
  id: request.id, hotelId: request.hotelId, roomId: request.roomId ?? undefined, location: request.location ?? undefined, workOrderId: request.workOrder?.id, dueAt: request.workOrder?.dueAt?.slice(0, 10),
  category: request.category, priority: priorityView(request.priority), status: maintenanceStatus(request), assigneeId: request.workOrder?.assignee?.id ?? undefined,
  title: request.title, description: request.description, costEstimate: 0, resolutionNotes: request.workOrder?.resolution ?? undefined,
  blocksRoom: request.blocksRoom, createdAt: request.reportedAt.slice(0, 10), resolvedAt: request.workOrder?.closedAt?.slice(0, 10) ?? undefined,
});

async function loadFacilities(hotelId: string) {
  const [rooms, tasks, inspections, requests, hkStaff, techStaff] = await Promise.allSettled([
    hotelOperationsApi.listRooms(hotelId), hotelOperationsApi.listHousekeepingTasks(hotelId), hotelOperationsApi.listHousekeepingInspections(hotelId),
    hotelOperationsApi.listMaintenanceRequests(hotelId), hotelOperationsApi.housekeepingStaff(hotelId), hotelOperationsApi.maintenanceStaff(hotelId),
  ]);
  const store = useHotelStore.getState();
  if (rooms.status === 'fulfilled') store.setRooms(() => rooms.value.map(room));
  store.setTasks(() => tasks.status === 'fulfilled' ? tasks.value.map(taskView) : []);
  store.setInspections(() => inspections.status === 'fulfilled' ? inspections.value.map((record): InspectionRecord => ({ id: record.id, taskId: record.taskId, roomId: record.roomId, hotelId, date: record.inspectedAt.slice(0, 10), inspectorId: record.inspectorId, result: record.result === 'APPROVED' ? 'passed' : 'failed', score: record.score, notes: record.notes ?? undefined })) : []);
  store.setMaintenance(() => requests.status === 'fulfilled' ? requests.value.map(maintenanceView) : []);
  store.setStaff(() => [...(hkStaff.status === 'fulfilled' ? staffViews(hotelId, hkStaff.value, 'Housekeeping') : []), ...(techStaff.status === 'fulfilled' ? staffViews(hotelId, techStaff.value, 'Maintenance') : [])]);
  store.setSupplyNotes(() => []);
}

const refreshFacilities = async (hotelId: string) => loadFacilities(hotelId);
const mappedTask = (hotelId: string, taskId: string) => useHotelStore.getState().housekeepingTasks.find((item) => item.id === taskId) ?? null;
const mappedRequest = (requestId: string) => useHotelStore.getState().maintenanceRequests.find((item) => item.id === requestId) ?? null;

export const backendOperations = {
  createHousekeepingTask: (hotelId: string, input: { roomId: string; type: string; priority: string; notes?: string; dueAt?: string; instructions?: string }, key: string = crypto.randomUUID()) => result(async () => {
    const task = await hotelOperationsApi.createHousekeepingTask(hotelId, input, key); await refreshFacilities(hotelId); return task;
  }, (task) => taskView(task)),
  assignHousekeepingTask: (hotelId: string, taskId: string, userId: string) => result(async () => {
    await hotelOperationsApi.assignHousekeepingTask(hotelId, taskId, { userId }); await refreshFacilities(hotelId); return mappedTask(hotelId, taskId);
  }, (task) => task!),
  startHousekeepingTask: (hotelId: string, taskId: string) => result(async () => {
    await hotelOperationsApi.startHousekeepingTask(hotelId, taskId); await refreshFacilities(hotelId); return mappedTask(hotelId, taskId);
  }, (task) => task!),
  completeHousekeepingTask: (hotelId: string, taskId: string, notes?: string) => result(async () => {
    await hotelOperationsApi.completeHousekeepingTask(hotelId, taskId, notes); await refreshFacilities(hotelId); return mappedTask(hotelId, taskId);
  }, (task) => task!),
  inspectHousekeepingTask: (hotelId: string, taskId: string, input: { result: 'APPROVED' | 'REJECTED'; score: number; notes?: string }) => result(async () => {
    const saved = await hotelOperationsApi.inspectHousekeepingTask(hotelId, taskId, input); await refreshFacilities(hotelId); return saved;
  }, (saved) => ({ task: taskView(saved.task), passed: saved.inspection.result === 'APPROVED' })),
  createMaintenanceRequest: (hotelId: string, input: { title: string; description: string; roomId?: string; location?: string; category: string; priority: string; blocksRoom: boolean }, key: string = crypto.randomUUID()) => result(async () => {
    const request = await hotelOperationsApi.createMaintenanceRequest(hotelId, input, key); await refreshFacilities(hotelId); return request;
  }, maintenanceView),
  createMaintenanceWorkOrder: (hotelId: string, requestId: string, notes?: string, dueAt?: string) => result(async () => {
    await hotelOperationsApi.createMaintenanceWorkOrder(hotelId, requestId, { notes, dueAt }); await refreshFacilities(hotelId); return mappedRequest(requestId);
  }, (request) => request!),
  assignMaintenanceWorkOrder: (hotelId: string, requestId: string, userId: string, dueAt?: string) => result(async () => {
    const current = mappedRequest(requestId); if (!current) throw new Error('Maintenance request not found.');
    const records = await hotelOperationsApi.listMaintenanceRequests(hotelId); const record = records.find((row) => row.id === requestId);
    if (!record?.workOrder) throw new Error('Create a work order before assigning a technician.');
    await hotelOperationsApi.assignMaintenanceWorkOrder(hotelId, record.workOrder.id, { userId, dueAt }); await refreshFacilities(hotelId); return mappedRequest(requestId);
  }, (request) => request!),
  transitionMaintenanceWorkOrder: (hotelId: string, requestId: string, action: 'start' | 'hold' | 'parts' | 'complete' | 'close', notes?: string) => result(async () => {
    const records = await hotelOperationsApi.listMaintenanceRequests(hotelId); const record = records.find((row) => row.id === requestId);
    if (!record?.workOrder) throw new Error('Maintenance request has no work order.');
    await hotelOperationsApi.updateMaintenanceWorkOrder(hotelId, record.workOrder.id, action, notes); await refreshFacilities(hotelId); return mappedRequest(requestId);
  }, (request) => request!),
  operationsStaffCandidates: (hotelId: string, area: 'housekeeping' | 'maintenance') => hotelOperationsApi.operationsStaffCandidates(hotelId, area),
  addOperationsStaff: (hotelId: string, area: 'housekeeping' | 'maintenance', userId: string) => result(async () => {
    const saved = await hotelOperationsApi.addOperationsStaff(hotelId, area, userId); await refreshFacilities(hotelId); return saved;
  }, (saved) => saved),
  createCategory: (hotelId: string, input: Omit<RoomCategory, 'id' | 'hotelId'>) => result(async () => {
    const saved = await hotelOperationsApi.createCategory(hotelId, input); await refresh(hotelId); return saved;
  }, category),
  createRoom: (hotelId: string, input: { number: string; floor: number; categoryId: string }) => result(async () => {
    const saved = await hotelOperationsApi.createRoom(hotelId, input); await refresh(hotelId); return saved;
  }, room),
  updateRoom: (hotelId: string, roomId: string, input: { number: string; floor: number; categoryId: string }) => result(async () => {
    const saved = await hotelOperationsApi.updateRoom(hotelId, roomId, input); await refresh(hotelId); return saved;
  }, room),
  updateRoomStatus: (hotelId: string, roomId: string, status: Exclude<RoomStatus, 'reserved' | 'occupied'>) => result(async () => {
    const saved = await hotelOperationsApi.updateRoomStatus(hotelId, roomId, status.toUpperCase() as Exclude<HotelRoomRecord['status'], 'RESERVED' | 'OCCUPIED'>);
    await refresh(hotelId); return saved;
  }, room),
  createGuest: (hotelId: string, input: { fullName: string; email?: string; phone?: string; nationality?: string; notes?: string }) => result(async () => {
    const saved = await hotelOperationsApi.createGuest(hotelId, { ...input, email: input.email?.trim() || undefined, phone: input.phone?.trim() || undefined, nationality: input.nationality?.trim() || undefined }); await refresh(hotelId); return saved;
  }, guest),
  updateGuest: (hotelId: string, guestId: string, input: { fullName: string; email?: string; phone?: string; nationality?: string; notes?: string }) => result(async () => {
    const saved = await hotelOperationsApi.updateGuest(hotelId, guestId, { ...input, email: input.email?.trim() || undefined, phone: input.phone?.trim() || undefined, nationality: input.nationality?.trim() || undefined }); await refresh(hotelId); return saved;
  }, guest),
  availability: async (hotelId: string, query: { checkIn: string; checkOut: string; categoryId?: string; guests?: number }) =>
    (await hotelOperationsApi.availability(hotelId, query)).map(room),
  createReservation: (hotelId: string, input: { roomId: string; guestId: string; checkIn: string; checkOut: string; adults: number; children: number; status?: 'PENDING' | 'CONFIRMED'; notes?: string }, key?: string) => result(async () => {
    const saved = await hotelOperationsApi.createReservation(hotelId, input, key); await refresh(hotelId); return saved;
  }, reservation),
  modifyReservation: (hotelId: string, reservationId: string, input: { roomId: string; checkIn: string; checkOut: string; adults: number; children: number; notes?: string }) => result(async () => {
    const saved = await hotelOperationsApi.modifyReservation(hotelId, reservationId, input); await refresh(hotelId); return saved;
  }, reservation),
  changeReservationStatus: (hotelId: string, reservationId: string, status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW') => result(async () => {
    const saved = await hotelOperationsApi.changeReservationStatus(hotelId, reservationId, status); await refresh(hotelId); return saved;
  }, reservation),
  transferRoom: (hotelId: string, reservationId: string, targetRoomId: string) => result(async () => {
    const saved = await hotelOperationsApi.transferRoom(hotelId, reservationId, targetRoomId); await refresh(hotelId); return saved;
  }, reservation),
  loadFinancial,
  issueFinancialInvoice: (reservationId: string) => result(async () => { const res = useHotelStore.getState().reservations.find((row) => row.id === reservationId); if (!res) throw new Error('Reservation not found.'); await hotelOperationsApi.postRoomCharges(res.hotelId, res.id, `room-charge:${res.id}`); const invoice = await hotelOperationsApi.issueInvoice(res.hotelId, res.id); await loadFinancial(res.hotelId); return invoice; }, (invoice) => invoice),
  addFinancialCharge: (reservationId: string, input: { category: ChargeCategory; description: string; amount: number }) => result(async () => {
    const res = useHotelStore.getState().reservations.find((row) => row.id === reservationId); if (!res) throw new Error('Reservation not found.');
      const response = await hotelOperationsApi.addFolioCharge(res.hotelId, reservationId, { description: input.description, amountMinor: Math.round(input.amount * 100), serviceDate: new Date().toISOString().slice(0, 10) }, crypto.randomUUID()); await refreshFinancial(res.hotelId);
    const entry = response.entries.at(-1); return entry;
    }, (entry): FolioCharge => ({ id: entry!.id, reservationId, date: entry!.serviceDate.slice(0, 10), category: input.category, description: entry!.description, amount: entry!.amountMinor / 100, currency: entry!.currency })),
  recordFinancialPayment: (input: { reservationId: string; amount: number; method: PaymentMethod; outcome?: 'success' | 'pending' | 'failed' }) => result(async () => {
    if (input.outcome === 'failed') throw new Error('Failed payment attempts are not persisted as collected transactions.');
    if (input.outcome === 'pending') throw new Error('Pending bank transfers are not supported by the manual payment ledger.');
    const res = useHotelStore.getState().reservations.find((row) => row.id === input.reservationId); if (!res) throw new Error('Reservation not found.');
      const response = await hotelOperationsApi.recordPayment(res.hotelId, res.id, { amountMinor: Math.round(input.amount * 100), method: paymentMethod(input.method), idempotencyKey: crypto.randomUUID() }); await refreshFinancial(res.hotelId);
    const folio = useHotelStore.getState(); return folio.payments.find((p) => p.id === response.id)!;
  }, (payment) => payment),
  requestFinancialRefund: (input: { paymentId: string; amount: number; reason: string; hotelId: string }) => result(async () => {
      const response = await hotelOperationsApi.requestRefund(input.hotelId, input.paymentId, { amountMinor: Math.round(input.amount * 100), reason: input.reason, idempotencyKey: crypto.randomUUID() }); await refreshFinancial(input.hotelId); return response;
  }, refundView),
  advanceFinancialRefund: (refund: Refund, status: 'approved' | 'rejected' | 'processed') => result(async () => {
    const backendStatus = status.toUpperCase() as 'APPROVED' | 'REJECTED' | 'PROCESSED'; const saved = await hotelOperationsApi.updateRefund(refund.hotelId, refund.id, backendStatus); await loadFinancial(refund.hotelId); return saved;
  }, refundView),
  createFinancialExpense: (hotelId: string, input: { category: string; vendor: string; description: string; amount: number; method: PaymentMethod; date: string; status: Expense['status'] }) => result(async () => {
      const saved = await hotelOperationsApi.createExpense(hotelId, { category: input.category, vendor: input.vendor, description: input.description, amountMinor: Math.round(input.amount * 100), method: paymentMethod(input.method), date: input.date, status: input.status.toUpperCase() as 'PAID' | 'PENDING' }); await loadFinancial(hotelId); return saved;
  }, expenseView),
  refreshFinancial: async (hotelId: string) => loadFinancial(hotelId),
};
