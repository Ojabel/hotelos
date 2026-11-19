import type { MaintenanceStatus, OrderStatus, PaymentStatus, Priority, RefundStatus, ReservationStatus, RoomStatus, TaskStatus } from '@/types';
import { MAINTENANCE_STATUS_META, ORDER_STATUS_META, PAYMENT_STATUS_META, PRIORITY_META, REFUND_STATUS_META, RESERVATION_STATUS_META, ROOM_STATUS_META, TASK_STATUS_META } from '@/utils/status';
import { Badge } from './Badge';

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const m = ROOM_STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const m = RESERVATION_STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const m = PAYMENT_STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const m = REFUND_STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge tone={PRIORITY_META[priority].tone}>{PRIORITY_META[priority].label}</Badge>;
export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => <Badge tone={TASK_STATUS_META[status].tone}>{TASK_STATUS_META[status].label}</Badge>;
export const MaintenanceStatusBadge = ({ status }: { status: MaintenanceStatus }) => <Badge tone={MAINTENANCE_STATUS_META[status].tone}>{MAINTENANCE_STATUS_META[status].label}</Badge>;
export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge tone={ORDER_STATUS_META[status].tone}>{ORDER_STATUS_META[status].label}</Badge>;
