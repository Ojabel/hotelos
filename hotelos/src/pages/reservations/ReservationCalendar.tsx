import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Detail } from '@/components/ui/Detail';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { categoryById, ROOM_CATEGORIES } from '@/data/roomCatalog';
import { useScopedData } from '@/hooks/useScopedData';
import { chartColors } from '@/styles/chartColors';
import type { Reservation, ReservationStatus } from '@/types';
import { addDays, DEMO_TODAY, nightsBetween } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { findAvailableRooms } from '@/utils/reservationRules';
import { RESERVATION_STATUS_META } from '@/utils/status';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';

const COLORS: Record<ReservationStatus, string> = {
  pending: chartColors.warning, expired: chartColors.slate, confirmed: chartColors.info, checked_in: chartColors.success, checked_out: chartColors.slate, cancelled: chartColors.danger, no_show: chartColors.danger,
};

export default function ReservationCalendar() {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const navigate = useNavigate();
  const { hotelId, reservations, rooms, guestById, roomById } = useScopedData();
  const allRooms = rooms;
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [checkIn, setCheckIn] = useState(addDays(DEMO_TODAY, 1));
  const [checkOut, setCheckOut] = useState(addDays(DEMO_TODAY, 3));
  const [categoryId, setCategoryId] = useState('any');

  const events = useMemo(() => reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').map((r) => ({
    id: r.id,
    title: `${roomById.get(r.roomId)?.number} · ${guestById.get(r.guestId)?.fullName}`,
    start: r.checkIn,
    end: r.checkOut,
    allDay: true,
    backgroundColor: COLORS[r.status],
    borderColor: COLORS[r.status],
  })), [reservations, roomById, guestById]);

  const dateError = checkOut <= checkIn ? 'Check-out must be after check-in.' : '';
  const free = useMemo(() => (dateError ? [] : findAvailableRooms(allRooms, reservations, { hotelId, checkIn, checkOut, categoryId }, (id) => categoryById(id).capacity)), [allRooms, reservations, hotelId, checkIn, checkOut, categoryId, dateError]);

  const onEvent = (e: EventClickArg) => setSelected(reservations.find((r) => r.id === e.event.id) ?? null);
  const bookQuery = new URLSearchParams({ hotel: hotelId === 'all' ? 'h-vi' : hotelId, in: checkIn, out: checkOut, cat: categoryId }).toString();

  return (
    <>
      <PageHeader title="Booking calendar" description="Month, week and day views. Select a booking for details." actions={<Link to="/reservations/new"><Button>New reservation</Button></Link>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Card className="p-3 sm:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={DEMO_TODAY}
            now={DEMO_TODAY}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
            events={events}
            eventClick={onEvent}
            dateClick={(a) => { setCheckIn(a.dateStr.slice(0, 10)); setCheckOut(addDays(a.dateStr.slice(0, 10), 1)); }}
            height="auto"
            dayMaxEvents={4}
            firstDay={1}
          />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
            {(['pending', 'confirmed', 'checked_in', 'checked_out'] as ReservationStatus[]).map((s) => <li key={s} className="flex items-center gap-1.5 text-meta text-slate"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[s] }} aria-hidden />{RESERVATION_STATUS_META[s].label}</li>)}
          </ul>
        </Card>

        <Card className="self-start">
          <CardHeader title="Check availability" />
          <div className="space-y-4 p-5">
            <Input label="Check-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            <Input label="Check-out" type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} error={dateError || undefined} />
            <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: 'any', label: 'Any category' }, ...ROOM_CATEGORIES.map((c) => ({ value: c.id, label: c.name }))]} />
            {!dateError && (
              <div aria-live="polite">
                <p className="text-body"><span className="font-semibold tnum">{free.length}</span> room{free.length === 1 ? '' : 's'} available</p>
                {free.length > 0 && <p className="mt-1 text-meta text-slate">{free.slice(0, 12).map((r) => r.number).join(', ')}{free.length > 12 && ` +${free.length - 12} more`}</p>}
              </div>
            )}
            <Button className="w-full" disabled={Boolean(dateError) || free.length === 0} onClick={() => navigate(`/reservations/new?${bookQuery}`)}>Book these dates</Button>
          </div>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} variant="drawer" title={selected?.reference ?? ''} description={selected ? guestById.get(selected.guestId)?.fullName : undefined}
        footer={selected && <Link to={`/reservations/${selected.id}`}><Button className="w-full">Open reservation</Button></Link>}>
        {selected && (
          <div className="space-y-4">
            <ReservationStatusBadge status={selected.status} />
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Room">{roomById.get(selected.roomId)?.number}</Detail>
              <Detail label="Category">{categoryById(selected.categoryId).name}</Detail>
              <Detail label="Check-in">{formatDate(selected.checkIn)}</Detail>
              <Detail label="Check-out">{formatDate(selected.checkOut)}</Detail>
              <Detail label="Nights">{nightsBetween(selected.checkIn, selected.checkOut)}</Detail>
              {canViewFinancials && <Detail label="Total">{formatCurrency(selected.total)}</Detail>}
            </dl>
          </div>
        )}
      </Dialog>
    </>
  );
}
