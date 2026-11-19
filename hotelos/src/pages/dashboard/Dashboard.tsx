import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, SprayCan } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { mockHotels } from '@/data/mockHotels';
import { useScopedData } from '@/hooks/useScopedData';
import { useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { addDays, nightsBetween, today } from '@/utils/demoClock';
import { formatCurrency, formatDate } from '@/utils/format';
import { bookingsCreatedPerDay, computeKpis, dailySeries } from '@/utils/metrics';
import type { PaymentMethod } from '@/types';
import { OccupancyChart, RevenueChart, TrendsChart } from './DashboardCharts';

const RANGES = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'next14', label: 'Next 14 days' },
  { value: 'custom', label: 'Custom range' },
];
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', pos: 'POS', bank_transfer: 'Bank transfer', online: 'Online' };

export default function Dashboard() {
  const t = today();
  const { hotelId, rooms, reservations, payments, activity, guestById, roomById } = useScopedData();
  const setHotelId = useAppStore((s) => s.setHotelId);
  const charges = useHotelStore((s) => s.charges);
  const [rangeKey, setRangeKey] = useState('last14');
  const [customStart, setCustomStart] = useState(addDays(t, -6));
  const [customEnd, setCustomEnd] = useState(addDays(t, 6));

  const customError = rangeKey === 'custom' && (customEnd < customStart ? 'End date must be on or after the start date.' : nightsBetween(customStart, customEnd) > 92 ? 'Choose a range of 93 days or less.' : '');
  const [start, end] = useMemo<[string, string]>(() => {
    switch (rangeKey) {
      case 'last7': return [addDays(t, -6), t];
      case 'last30': return [addDays(t, -29), t];
      case 'mtd': return [t.slice(0, 8) + '01', t];
      case 'next14': return [t, addDays(t, 13)];
      case 'custom': return customError ? [addDays(t, -13), t] : [customStart, customEnd];
      default: return [addDays(t, -13), t];
    }
  }, [rangeKey, customStart, customEnd, customError, t]);
  const rangeLabel = RANGES.find((r) => r.value === rangeKey)!.label.toLowerCase();

  const kpis = useMemo(() => computeKpis(rooms, reservations, t, start, end, charges), [rooms, reservations, t, start, end, charges]);
  const series = useMemo(() => dailySeries(start, end, rooms, reservations, t), [start, end, rooms, reservations, t]);
  const trends = useMemo(() => bookingsCreatedPerDay(start, end, reservations, t), [start, end, reservations, t]);

  const money = (v: number | null) => (v === null ? '—' : formatCurrency(v));
  const recentBookings = useMemo(() => [...reservations].sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6), [reservations]);
  const upcoming = useMemo(() => reservations.filter((r) => ['pending', 'confirmed'].includes(r.status) && r.checkIn >= t && r.checkIn <= addDays(t, 2)).sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1)).slice(0, 6), [reservations, t]);
  const recentPayments = payments.filter((p) => p.status === 'paid' || p.status === 'refunded').slice(0, 6);

  const arrivalRooms = new Set(reservations.filter((r) => r.checkIn === t && ['pending', 'confirmed'].includes(r.status)).map((r) => r.roomId));
  const alerts = rooms.filter((r) => r.status === 'dirty' || r.status === 'cleaning')
    .map((r) => ({ room: r, urgent: arrivalRooms.has(r.id) }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 6);

  const segments = [
    { label: 'Occupied', value: kpis.occupied, color: 'bg-forest' },
    { label: 'Reserved', value: kpis.reserved, color: 'bg-info' },
    { label: 'Available', value: kpis.available, color: 'bg-success' },
    { label: 'Housekeeping', value: kpis.housekeeping, color: 'bg-warning' },
    { label: 'Maintenance / out of service', value: kpis.outOfOrder, color: 'bg-slate' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${hotelId === 'all' ? 'All properties' : mockHotels.find((h) => h.id === hotelId)?.name} · ${formatDate(t)}`}
        actions={<>
          <div className="w-52"><Select label="Property" hideLabel value={hotelId} onChange={(e) => setHotelId(e.target.value)} options={[{ value: 'all', label: 'All properties' }, ...mockHotels.map((h) => ({ value: h.id, label: h.name }))]} /></div>
          <div className="w-44"><Select label="Date range" hideLabel value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} options={RANGES} /></div>
        </>}
      />

      {rangeKey === 'custom' && (
        <div className="mb-5 flex flex-wrap items-start gap-3">
          <div className="w-44"><Input label="From" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></div>
          <div className="w-44"><Input label="To" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} error={customError || undefined} /></div>
        </div>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Occupancy rate" value={`${kpis.occupancyRate}%`} hint={`${kpis.occupied} of ${kpis.totalRooms - kpis.outOfOrder} sellable rooms`} />
        <StatCard label="Revenue today" value={formatCurrency(kpis.revenueToday)} hint="Room revenue, in-house" />
        <StatCard label="Revenue this month" value={formatCurrency(kpis.revenueMonth)} hint="Month to date" />
        <StatCard label="Outstanding balances" value={formatCurrency(kpis.outstanding)} hint="In-house guests" />
        <StatCard label="Average daily rate" value={money(kpis.adr)} hint={rangeLabel} />
        <StatCard label="RevPAR" value={money(kpis.revpar)} hint={rangeLabel} />
        <StatCard label="Today’s arrivals" value={String(kpis.arrivals)} hint="Pending, confirmed or in-house" />
        <StatCard label="Today’s departures" value={String(kpis.departures)} hint="Checking out today" />
      </section>

      <Card className="mt-4 p-5 sm:mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-card font-semibold">Room status</h2>
          <p className="text-meta text-slate tnum">{kpis.totalRooms} rooms in total</p>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
          {segments.map((s) => s.value > 0 && <div key={s.label} className={s.color} style={{ width: `${(s.value / Math.max(1, kpis.totalRooms)) * 100}%` }} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-body"><span className={`h-2.5 w-2.5 rounded-full ${s.color}`} aria-hidden /><span className="text-slate">{s.label}</span><span className="font-medium tnum">{s.value}</span></li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><RevenueChart data={series} /></div>
        <OccupancyChart data={series} />
      </div>
      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><TrendsChart data={trends} /></div>
        <Card>
          <CardHeader title="Housekeeping alerts" action={<Link to="/housekeeping" className="text-meta font-medium text-info hover:underline">View all</Link>} />
          {alerts.length === 0 ? <EmptyState icon={SprayCan} title="All rooms are clean" /> : (
            <ul className="divide-y divide-line">
              {alerts.map(({ room, urgent }) => (
                <li key={room.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div><p className="text-body font-medium">Room {room.number}</p><p className="text-meta text-slate">{room.status === 'dirty' ? 'Needs cleaning' : 'Cleaning in progress'}</p></div>
                  {urgent ? <Badge tone="danger">Arrival today</Badge> : <Badge tone="warning">{room.status === 'dirty' ? 'Dirty' : 'Cleaning'}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent bookings" action={<Link to="/reservations" className="text-meta font-medium text-info hover:underline">All reservations</Link>} />
          <ul className="divide-y divide-line">
            {recentBookings.map((r) => (
              <li key={r.id}>
                <Link to={`/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ivory/70">
                  <div className="min-w-0"><p className="truncate text-body font-medium">{guestById.get(r.guestId)?.fullName}</p><p className="text-meta text-slate">{r.reference} · Room {roomById.get(r.roomId)?.number}</p></div>
                  <div className="shrink-0 text-right"><p className="text-body font-medium tnum">{formatCurrency(r.total)}</p><ReservationStatusBadge status={r.status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Upcoming arrivals" action={<span className="text-meta text-slate">Next 3 days</span>} />
          {upcoming.length === 0 ? <EmptyState icon={ArrowRight} title="No arrivals expected" description="Nothing is due in the next three days." /> : (
            <ul className="divide-y divide-line">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <Link to={`/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ivory/70">
                    <div className="min-w-0"><p className="truncate text-body font-medium">{guestById.get(r.guestId)?.fullName}</p><p className="text-meta text-slate">Room {roomById.get(r.roomId)?.number} · {nightsBetween(r.checkIn, r.checkOut)} nights</p></div>
                    <div className="shrink-0 text-right"><p className="text-body tnum">{r.checkIn === t ? 'Today' : formatDate(r.checkIn)}</p><ReservationStatusBadge status={r.status} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent transactions" action={<Link to="/billing/payments" className="text-meta font-medium text-info hover:underline">All payments</Link>} />
          <ul className="divide-y divide-line">
            {recentPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0"><p className="truncate text-body font-medium">{guestById.get(p.guestId)?.fullName}</p><p className="text-meta text-slate">{METHOD_LABEL[p.method]} · {formatDate(p.date, false)}</p></div>
                <p className="shrink-0 text-body font-medium tnum">{formatCurrency(p.amount)}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Activity" />
          <ul className="divide-y divide-line">
            {activity.slice(0, 7).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <p className="text-body">{a.text}</p>
                <span className="shrink-0 text-meta text-slate">{a.at}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
