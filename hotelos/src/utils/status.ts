import type { MaintenanceStatus, OrderStatus, PaymentMethod, PaymentStatus, Priority, RefundStatus, ReservationStatus, RoomStatus, TaskStatus, Tone } from '@/types';

export const ROOM_STATUS_META: Record<RoomStatus, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'success' },
  reserved: { label: 'Reserved', tone: 'info' },
  occupied: { label: 'Occupied', tone: 'champagne' },
  dirty: { label: 'Dirty', tone: 'warning' },
  cleaning: { label: 'Cleaning', tone: 'info' },
  inspected: { label: 'Inspected', tone: 'success' },
  maintenance: { label: 'Maintenance', tone: 'danger' },
  out_of_service: { label: 'Out of service', tone: 'neutral' },
};

export const RESERVATION_STATUS_META: Record<ReservationStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  expired: { label: 'Expired hold', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  checked_in: { label: 'Checked in', tone: 'success' },
  checked_out: { label: 'Checked out', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'No-show', tone: 'danger' },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partially_paid: { label: 'Partially paid', tone: 'warning' },
  pending: { label: 'Pending', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

export const REFUND_STATUS_META: Record<RefundStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
  processed: { label: 'Processed', tone: 'success' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', pos: 'POS', bank_transfer: 'Bank transfer', online: 'Online payment' };

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone; rank: number }> = {
  urgent: { label: 'Urgent', tone: 'danger', rank: 0 },
  high: { label: 'High', tone: 'warning', rank: 1 },
  normal: { label: 'Normal', tone: 'neutral', rank: 2 },
  low: { label: 'Low', tone: 'info', rank: 3 },
};

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  assigned: { label: 'Assigned', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'champagne' },
  completed: { label: 'Awaiting inspection', tone: 'info' },
  inspected: { label: 'Inspected', tone: 'success' },
};

export const MAINTENANCE_STATUS_META: Record<MaintenanceStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'danger' },
  assigned: { label: 'Assigned', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'warning' },
  on_hold: { label: 'On hold', tone: 'neutral' },
  awaiting_parts: { label: 'Awaiting parts', tone: 'warning' },
  completed: { label: 'Completed', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'info' },
  preparing: { label: 'Preparing', tone: 'warning' },
  ready: { label: 'Ready', tone: 'success' },
  served: { label: 'Served', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};
