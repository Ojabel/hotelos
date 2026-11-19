import { apiClient } from './client';

export type RoomOperationalStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'DIRTY' | 'CLEANING' | 'INSPECTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type ReservationOperationalStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED';

export interface RoomCategoryRecord {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  basePrice: number;
  capacity: number;
  bedConfiguration: string;
  amenities: string[];
}

export interface HotelRecord { id: string; name: string; code: string }
export type CreateRoomCategoryInput = Omit<RoomCategoryRecord, 'id' | 'hotelId'>;

export interface HotelRoomRecord {
  id: string;
  hotelId: string;
  categoryId: string;
  number: string;
  floor: number;
  status: RoomOperationalStatus;
  category: RoomCategoryRecord;
}

export interface HotelGuestRecord {
  id: string;
  hotelId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  notes: string | null;
  createdAt: string;
}

export interface HotelReservationRecord {
  id: string;
  hotelId: string;
  roomId: string;
  guestId: string;
  categoryId: string;
  reference: string;
  status: ReservationOperationalStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  nightlyRate: number;
  total: number;
  notes: string | null;
  createdAt: string;
  guest: Pick<HotelGuestRecord, 'id' | 'fullName' | 'email' | 'phone'>;
  room: Pick<HotelRoomRecord, 'id' | 'number' | 'floor' | 'status'>;
  category: Pick<RoomCategoryRecord, 'id' | 'name' | 'capacity'>;
}

export interface FinancialEntryRecord { id: string; kind: 'ROOM_CHARGE' | 'SERVICE_CHARGE' | 'ADJUSTMENT' | 'PAYMENT' | 'REFUND'; description: string; amountMinor: number; currency: string; serviceDate: string; reason: string | null }
export interface FinancialInvoiceLineRecord { id: string; folioEntryId: string; description: string; amountMinor: number; currency: string; serviceDate: string }
export interface FinancialInvoiceRecord { id: string; reference: string; folioId?: string; status: 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'; currency: string; subtotalMinor: number; totalMinor: number; issuedAt: string; snapshot: unknown; lines?: FinancialInvoiceLineRecord[]; folio?: { reservationId: string; guest: { fullName: string }; reservation: HotelReservationRecord } }
export interface FinancialPaymentRecord { id: string; reference: string; idempotencyKey: string; method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER'; status: 'RECORDED' | 'REVERSED'; amountMinor: number; allocatedMinor: number; currency: string; receivedAt: string; receipt?: { id: string; reference: string; snapshot: unknown }; refunds?: FinancialRefundRecord[] }
export interface FinancialRefundRecord { id: string; reference: string; amountMinor: number; currency: string; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED'; requestedAt: string; processedAt: string | null; paymentId?: string }
export interface FinancialFolioRecord { id: string; organizationId: string; hotelId: string; guestId: string; reservationId: string; currency: string; status: 'OPEN' | 'CLOSED'; guest: { id: string; fullName: string; email: string | null; phone: string | null }; reservation: HotelReservationRecord & { room: { id: string; number: string } }; entries: FinancialEntryRecord[]; invoices: FinancialInvoiceRecord[]; payments: FinancialPaymentRecord[]; refunds: FinancialRefundRecord[]; totals: { chargesMinor: number; paidMinor: number; refundedMinor: number; balanceMinor: number } }
export interface FinancialExpenseRecord { id: string; hotelId: string; vendor: string; description: string; amountMinor: number; currency: string; method: FinancialPaymentRecord['method']; status: 'PAID' | 'PENDING' | 'VOID'; reference: string | null; expenseDate: string; categoryId: string; category: { id: string; name: string } }
export interface ExpenseCategoryRecord { id: string; name: string }

export interface OperationsStaffRecord { userId: string; name: string; email?: string | null; roleNames: string[] }
export type OperationsStaffCandidateRecord = OperationsStaffRecord;
export interface HousekeepingTaskRecord {
  id: string; organizationId: string; hotelId: string; roomId: string; type: 'TURNOVER' | 'DAILY' | 'DEEP' | 'MAINTENANCE_RETURN';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'AWAITING_INSPECTION' | 'APPROVED';
  dueAt: string | null; instructions: string | null; notes: string | null; createdAt: string; startedAt: string | null; completedAt: string | null;
  room: HotelRoomRecord; creator: { id: string; email: string | null }; assignee: { id: string; email: string | null } | null;
  events: Array<{ id: string; actorUserId: string; action: string; notes: string | null; createdAt: string; actor: { id: string; email: string | null } }>;
  inspections: Array<{ id: string; inspectorId: string; result: 'APPROVED' | 'REJECTED'; score: number; notes: string | null; inspectedAt: string; inspector: { id: string; email: string | null } }>;
}
export interface HousekeepingInspectionRecord { id: string; taskId: string; roomId: string; inspectorId: string; result: 'APPROVED' | 'REJECTED'; score: number; notes: string | null; inspectedAt: string; inspector: { id: string; email: string | null }; room: HotelRoomRecord }
export interface MaintenanceWorkOrderRecord { id: string; requestId: string; status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'AWAITING_PARTS' | 'COMPLETED' | 'CLOSED'; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; assignedToUserId: string | null; dueAt: string | null; startedAt: string | null; completedAt: string | null; closedAt: string | null; resolution: string | null; notes: string | null; assignee: { id: string; email: string | null } | null }
export interface MaintenanceRequestRecord { id: string; hotelId: string; roomId: string | null; title: string; description: string; location: string | null; category: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; blocksRoom: boolean; status: 'OPEN' | 'CONVERTED' | 'CLOSED'; reportedAt: string; notes: string | null; room: HotelRoomRecord | null; reporter: { id: string; email: string | null }; workOrder: MaintenanceWorkOrderRecord | null }

export interface CreateGuestInput {
  fullName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  notes?: string;
}

export interface CreateReservationInput {
  roomId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status?: 'PENDING' | 'CONFIRMED';
  notes?: string;
}

const hotelPath = (hotelId: string) => `/api/v1/hotels/${encodeURIComponent(hotelId)}`;

/** Backend adapter for staged operations UI integration; mock services remain the active demo path. */
export const hotelOperationsApi = {
  listHotels: () => apiClient.request<HotelRecord[]>('/api/v1/hotels'),
  listCategories: (hotelId: string) => apiClient.request<RoomCategoryRecord[]>(`${hotelPath(hotelId)}/room-categories`),
  createCategory: (hotelId: string, input: CreateRoomCategoryInput) => apiClient.request<RoomCategoryRecord>(`${hotelPath(hotelId)}/room-categories`, { method: 'POST', body: JSON.stringify(input) }),
  listRooms: (hotelId: string) => apiClient.request<HotelRoomRecord[]>(`${hotelPath(hotelId)}/rooms`),
  createRoom: (hotelId: string, input: { number: string; floor: number; categoryId: string }) => apiClient.request<HotelRoomRecord>(`${hotelPath(hotelId)}/rooms`, { method: 'POST', body: JSON.stringify(input) }),
  updateRoom: (hotelId: string, roomId: string, input: { number: string; floor: number; categoryId: string }) => apiClient.request<HotelRoomRecord>(`${hotelPath(hotelId)}/rooms/${encodeURIComponent(roomId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  availability: (hotelId: string, query: { checkIn: string; checkOut: string; categoryId?: string; guests?: number }) => {
    const search = new URLSearchParams({ checkIn: query.checkIn, checkOut: query.checkOut });
    if (query.categoryId) search.set('categoryId', query.categoryId);
    if (query.guests !== undefined) search.set('guests', String(query.guests));
    return apiClient.request<HotelRoomRecord[]>(`${hotelPath(hotelId)}/rooms/availability?${search.toString()}`);
  },
  updateRoomStatus: (hotelId: string, roomId: string, status: Exclude<RoomOperationalStatus, 'RESERVED' | 'OCCUPIED'>) =>
    apiClient.request<HotelRoomRecord>(`${hotelPath(hotelId)}/rooms/${encodeURIComponent(roomId)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),
  listGuests: (hotelId: string) => apiClient.request<HotelGuestRecord[]>(`${hotelPath(hotelId)}/guests`),
  createGuest: (hotelId: string, input: CreateGuestInput) => apiClient.request<HotelGuestRecord>(`${hotelPath(hotelId)}/guests`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  updateGuest: (hotelId: string, guestId: string, input: CreateGuestInput) => apiClient.request<HotelGuestRecord>(`${hotelPath(hotelId)}/guests/${encodeURIComponent(guestId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  listReservations: (hotelId: string, from?: string, to?: string) => {
    const search = new URLSearchParams();
    if (from) search.set('from', from);
    if (to) search.set('to', to);
    const suffix = search.size ? `?${search.toString()}` : '';
    return apiClient.request<HotelReservationRecord[]>(`${hotelPath(hotelId)}/reservations${suffix}`);
  },
  getReservation: (hotelId: string, reservationId: string) =>
    apiClient.request<HotelReservationRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}`),
  createReservation: (hotelId: string, input: CreateReservationInput, idempotencyKey?: string) =>
    apiClient.request<HotelReservationRecord>(`${hotelPath(hotelId)}/reservations`, {
      method: 'POST', headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(input),
    }),
  modifyReservation: (hotelId: string, reservationId: string, input: Omit<CreateReservationInput, 'guestId' | 'status'>) =>
    apiClient.request<HotelReservationRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}`, {
      method: 'PATCH', body: JSON.stringify(input),
    }),
  changeReservationStatus: (hotelId: string, reservationId: string, status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW') =>
    apiClient.request<HotelReservationRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/status`, {
      method: 'POST', body: JSON.stringify({ status }),
    }),
  transferRoom: (hotelId: string, reservationId: string, targetRoomId: string) =>
    apiClient.request<HotelReservationRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/transfer`, {
      method: 'POST', body: JSON.stringify({ targetRoomId }),
    }),
  listFolios: (hotelId: string) => apiClient.request<FinancialFolioRecord[]>(`${hotelPath(hotelId)}/folios`),
  getFolio: (hotelId: string, reservationId: string) => apiClient.request<FinancialFolioRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/folio`),
  postRoomCharges: (hotelId: string, reservationId: string, idempotencyKey: string) => apiClient.request<FinancialFolioRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/folio/room-charges`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } }),
  addFolioCharge: (hotelId: string, reservationId: string, input: { description: string; amountMinor: number; serviceDate: string; reason?: string }, idempotencyKey: string) => apiClient.request<FinancialFolioRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/folio/charges`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) }),
  issueInvoice: (hotelId: string, reservationId: string) => apiClient.request<FinancialInvoiceRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/invoices`, { method: 'POST' }),
  listInvoices: (hotelId: string) => apiClient.request<FinancialInvoiceRecord[]>(`${hotelPath(hotelId)}/invoices`),
  getInvoice: (hotelId: string, invoiceId: string) => apiClient.request<FinancialInvoiceRecord>(`${hotelPath(hotelId)}/invoices/${encodeURIComponent(invoiceId)}`),
  getReceipt: (hotelId: string, receiptId: string) => apiClient.request<{ id: string; reference: string; snapshot: unknown }>(`${hotelPath(hotelId)}/receipts/${encodeURIComponent(receiptId)}`),
  listPayments: (hotelId: string) => apiClient.request<FinancialPaymentRecord[]>(`${hotelPath(hotelId)}/payments`),
  recordPayment: (hotelId: string, reservationId: string, input: { amountMinor: number; method: string; idempotencyKey: string }) => apiClient.request<FinancialPaymentRecord>(`${hotelPath(hotelId)}/reservations/${encodeURIComponent(reservationId)}/payments`, { method: 'POST', body: JSON.stringify(input) }),
  listRefunds: (hotelId: string) => apiClient.request<FinancialRefundRecord[]>(`${hotelPath(hotelId)}/refunds`),
  requestRefund: (hotelId: string, paymentId: string, input: { amountMinor: number; reason: string; idempotencyKey: string }) => apiClient.request<FinancialRefundRecord>(`${hotelPath(hotelId)}/payments/${encodeURIComponent(paymentId)}/refunds`, { method: 'POST', body: JSON.stringify(input) }),
  updateRefund: (hotelId: string, refundId: string, status: 'APPROVED' | 'REJECTED' | 'PROCESSED') => apiClient.request<FinancialRefundRecord>(`${hotelPath(hotelId)}/refunds/${encodeURIComponent(refundId)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  listExpenseCategories: (hotelId: string) => apiClient.request<ExpenseCategoryRecord[]>(`${hotelPath(hotelId)}/expense-categories`),
  listExpenses: (hotelId: string, filters: { from?: string; to?: string; categoryId?: string; category?: string } = {}) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value); return apiClient.request<FinancialExpenseRecord[]>(`${hotelPath(hotelId)}/expenses${query.size ? `?${query}` : ''}`); },
  createExpense: (hotelId: string, input: { category: string; vendor: string; description: string; amountMinor: number; method: string; date: string; status: 'PAID' | 'PENDING'; reference?: string }) => apiClient.request<FinancialExpenseRecord>(`${hotelPath(hotelId)}/expenses`, { method: 'POST', body: JSON.stringify(input) }),
  updateExpense: (hotelId: string, expenseId: string, input: { category: string; vendor: string; description: string; amountMinor: number; method: string; date: string; status: 'PAID' | 'PENDING'; reference?: string }) => apiClient.request<FinancialExpenseRecord>(`${hotelPath(hotelId)}/expenses/${encodeURIComponent(expenseId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  housekeepingStaff: (hotelId: string) => apiClient.request<OperationsStaffRecord[]>(`${hotelPath(hotelId)}/operations-staff/housekeeping`),
  maintenanceStaff: (hotelId: string) => apiClient.request<OperationsStaffRecord[]>(`${hotelPath(hotelId)}/operations-staff/maintenance`),
  operationsStaffCandidates: (hotelId: string, area: 'housekeeping' | 'maintenance') => apiClient.request<OperationsStaffCandidateRecord[]>(`${hotelPath(hotelId)}/operations-staff/candidates?area=${area}`),
  addOperationsStaff: (hotelId: string, area: 'housekeeping' | 'maintenance', userId: string) => apiClient.request<{ userId: string; hotelId: string; area: string; role: string; status: 'ACTIVE' }>(`${hotelPath(hotelId)}/operations-staff/${area}/${encodeURIComponent(userId)}`, { method: 'POST' }),
  listHousekeepingTasks: (hotelId: string) => apiClient.request<HousekeepingTaskRecord[]>(`${hotelPath(hotelId)}/housekeeping/tasks`),
  createHousekeepingTask: (hotelId: string, input: { roomId: string; type: string; priority: string; dueAt?: string; instructions?: string; notes?: string }, key: string) => apiClient.request<HousekeepingTaskRecord>(`${hotelPath(hotelId)}/housekeeping/tasks`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) }),
  assignHousekeepingTask: (hotelId: string, id: string, input: { userId: string; priority?: string; dueAt?: string; instructions?: string }) => apiClient.request<HousekeepingTaskRecord>(`${hotelPath(hotelId)}/housekeeping/tasks/${encodeURIComponent(id)}/assign`, { method: 'PATCH', body: JSON.stringify(input) }),
  startHousekeepingTask: (hotelId: string, id: string) => apiClient.request<HousekeepingTaskRecord>(`${hotelPath(hotelId)}/housekeeping/tasks/${encodeURIComponent(id)}/start`, { method: 'PATCH' }),
  completeHousekeepingTask: (hotelId: string, id: string, notes?: string) => apiClient.request<HousekeepingTaskRecord>(`${hotelPath(hotelId)}/housekeeping/tasks/${encodeURIComponent(id)}/complete`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  inspectHousekeepingTask: (hotelId: string, id: string, input: { result: 'APPROVED' | 'REJECTED'; score: number; notes?: string }) => apiClient.request<{ task: HousekeepingTaskRecord; inspection: HousekeepingInspectionRecord }>(`${hotelPath(hotelId)}/housekeeping/tasks/${encodeURIComponent(id)}/inspection`, { method: 'POST', body: JSON.stringify(input) }),
  listHousekeepingInspections: (hotelId: string) => apiClient.request<HousekeepingInspectionRecord[]>(`${hotelPath(hotelId)}/housekeeping/inspections`),
  listMaintenanceRequests: (hotelId: string) => apiClient.request<MaintenanceRequestRecord[]>(`${hotelPath(hotelId)}/maintenance/requests`),
  createMaintenanceRequest: (hotelId: string, input: { title: string; description: string; roomId?: string; location?: string; category: string; priority: string; blocksRoom: boolean; notes?: string }, key: string) => apiClient.request<MaintenanceRequestRecord>(`${hotelPath(hotelId)}/maintenance/requests`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) }),
  createMaintenanceWorkOrder: (hotelId: string, requestId: string, input: { priority?: string; dueAt?: string; notes?: string }) => apiClient.request<MaintenanceWorkOrderRecord>(`${hotelPath(hotelId)}/maintenance/requests/${encodeURIComponent(requestId)}/work-orders`, { method: 'POST', body: JSON.stringify(input) }),
  assignMaintenanceWorkOrder: (hotelId: string, workOrderId: string, input: { userId: string; priority?: string; dueAt?: string }) => apiClient.request<MaintenanceWorkOrderRecord>(`${hotelPath(hotelId)}/maintenance/work-orders/${encodeURIComponent(workOrderId)}/assign`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateMaintenanceWorkOrder: (hotelId: string, workOrderId: string, action: 'start' | 'hold' | 'parts' | 'complete' | 'close', notes?: string) => apiClient.request<MaintenanceWorkOrderRecord>(`${hotelPath(hotelId)}/maintenance/work-orders/${encodeURIComponent(workOrderId)}/${action}`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
};
