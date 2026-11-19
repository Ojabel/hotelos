import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { mockHotels } from '@/data/mockHotels';
import { useAppStore, toast } from '@/store/useAppStore';
import { permissionsForAppRole } from '@/store/useAdminStore';
import { useHotelStore } from '@/store/useHotelStore';
import { today, addDays } from '@/utils/demoClock';
import { formatCurrency } from '@/utils/format';
import { chartColors } from '@/styles/chartColors';
import { computeFolio } from '@/utils/folio';

const REPORTS = ['Occupancy', 'Revenue', 'Reservations', 'Guests', 'Room performance', 'Payments', 'Expenses', 'Staff', 'Restaurant', 'Inventory'];
type Row = { label: string; value: string | number; detail: string };
const money = (value: number) => formatCurrency(value);
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
const palette = [chartColors.forest, chartColors.champagne, '#6D8C7A', '#9DA99F', '#C77B64', '#7892A3'];

function downloadCsv(rows: Row[], summary: Row[], report: string, start: string, end: string) {
  const csv = [['Report', report], ['From', start], ['To', end], [], ['Summary', 'Value', 'Details'], ...summary.map((r) => [r.label, r.value, r.detail]), [], ['Item', 'Value', 'Details'], ...rows.map((r) => [r.label, r.value, r.detail])]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `hotelos-${report.toLowerCase().replace(/ /g, '-')}-${start}-to-${end}.csv`; a.click(); URL.revokeObjectURL(url);
  toast.success('Report exported', 'CSV download is ready.');
}

export default function Reports() {
  const roomsAll = useHotelStore((s) => s.rooms);
  const session = useAppStore((s) => s.session);
  const canExport = Boolean(session && permissionsForAppRole(session.role).Reports?.includes('Export'));
  const reservationsAll = useHotelStore((s) => s.reservations);
  const paymentsAll = useHotelStore((s) => s.payments);
  const chargesAll = useHotelStore((s) => s.charges);
  const refundsAll = useHotelStore((s) => s.refunds);
  const expensesAll = useHotelStore((s) => s.expenses);
  const guestsAll = useHotelStore((s) => s.guests);
  const staffAll = useHotelStore((s) => s.staff);
  const attendanceAll = useHotelStore((s) => s.attendance);
  const tasksAll = useHotelStore((s) => s.housekeepingTasks);
  const inventoryAll = useHotelStore((s) => s.inventory);
  const movementsAll = useHotelStore((s) => s.movements);
  const purchasesAll = useHotelStore((s) => s.purchaseOrders);
  const suppliersAll = useHotelStore((s) => s.suppliers);
  const ordersAll = useHotelStore((s) => s.orders);
  const activeProperty = useAppStore((s) => s.hotelId);
  const endDefault = today();
  const [report, setReport] = useState('Occupancy');
  const [start, setStart] = useState(addDays(endDefault, -29));
  const [end, setEnd] = useState(endDefault);
  const [period, setPeriod] = useState('30');
  const [property, setProperty] = useState(activeProperty);
  const [department, setDepartment] = useState('all');
  const [category, setCategory] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const invalid = start > end;

  const data = useMemo(() => {
    const rooms = roomsAll.filter((x) => property === 'all' || x.hotelId === property);
    const reservations = reservationsAll.filter((x) => (property === 'all' || x.hotelId === property) && x.checkIn <= end && x.checkOut > start);
    const payments = paymentsAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.date, start, end) && (paymentStatus === 'all' || x.status === paymentStatus) && (paymentMethod === 'all' || x.method === paymentMethod));
    const refunds = refundsAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.requestedAt, start, end) && (paymentStatus === 'all' || paymentStatus === 'refunded') && paymentsAll.some((p) => p.reservationId === x.reservationId && (paymentMethod === 'all' || p.method === paymentMethod)));
    const expenses = expensesAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.date, start, end));
    const staff = staffAll.filter((x) => (property === 'all' || x.hotelId === property) && (department === 'all' || x.department === department));
    const staffIds = new Set(staff.map((x) => x.id));
    const attendance = attendanceAll.filter((x) => staffIds.has(x.staffId) && inRange(x.date, start, end));
    const tasks = tasksAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.date, start, end));
    const inventory = inventoryAll.filter((x) => property === 'all' || x.hotelId === property);
    const movements = movementsAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.date, start, end));
    const purchases = purchasesAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.createdAt, start, end));
    const orders = ordersAll.filter((x) => (property === 'all' || x.hotelId === property) && inRange(x.createdAt, start, end));
    const guests = guestsAll;
    const available = rooms.filter((x) => !['maintenance', 'out_of_service'].includes(x.status)).length;
    const occupied = rooms.filter((x) => x.status === 'occupied').length;
    const rangeDays = Math.max(1, Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
    const realized = reservationsAll.filter((r) => (property === 'all' || r.hotelId === property) && ['checked_in', 'checked_out'].includes(r.status));
    const overlapNights = (r: typeof reservationsAll[number], from: string, to: string) => Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 86400000));
    const soldRoomNights = realized.reduce((sum, r) => sum + overlapNights(r, r.checkIn > start ? r.checkIn : start, r.checkOut < addDays(end, 1) ? r.checkOut : addDays(end, 1)), 0);
    const roomRevenue = realized.reduce((sum, r) => sum + r.nightlyRate * overlapNights(r, r.checkIn > start ? r.checkIn : start, r.checkOut < addDays(end, 1) ? r.checkOut : addDays(end, 1)), 0);
    const serviceCharges = chargesAll.filter((c) => inRange(c.date, start, end) && realized.some((r) => r.id === c.reservationId));
    const revenueByDepartment = [...serviceCharges.reduce((m, c) => m.set(c.category, (m.get(c.category) ?? 0) + c.amount), new Map<string, number>())].map(([name, amount]) => ({ name: name.replace(/_/g, ' '), amount }));
    const categoryRevenue = realized.filter((r) => category === 'all' || r.categoryId === category).reduce((m, r) => {
      const nights = overlapNights(r, r.checkIn > start ? r.checkIn : start, r.checkOut < addDays(end, 1) ? r.checkOut : addDays(end, 1));
      m.set(r.categoryId, (m.get(r.categoryId) ?? 0) + nights * r.nightlyRate); return m;
    }, new Map<string, number>());
    const revenueByRoomCategory = [...categoryRevenue].map(([name, amount]) => ({ name: name.replace('cat-', '').toUpperCase(), amount }));
    const outstanding = reservations.filter((r) => ['checked_in', 'checked_out'].includes(r.status) && r.checkOut >= start && r.checkOut <= end).reduce((sum, r) => sum + Math.max(0, computeFolio(r, chargesAll, paymentsAll, refundsAll).balance), 0);
    const totalCollected = payments.filter((x) => ['paid', 'refunded'].includes(x.status)).reduce((s, x) => s + x.amount, 0);
    const refundTotal = refunds.filter((x) => x.status === 'processed').reduce((s, x) => s + x.amount, 0);
    const reservationCount = reservations.filter((r) => inRange(r.createdAt, start, end));
    const confirmedCount = reservationCount.filter((r) => ['confirmed', 'checked_in', 'checked_out'].includes(r.status)).length;
    const daysInRange = rangeDays;
    const chartDays = Math.min(7, daysInRange);
    const chart = Array.from({ length: chartDays }, (_, i) => {
      const date = addDays(end, i - chartDays + 1);
      const stays = reservationsAll.filter((r) => (property === 'all' || r.hotelId === property) && ['checked_in', 'checked_out', 'confirmed', 'pending'].includes(r.status) && r.checkIn <= date && r.checkOut > date);
      const occ = date === today() ? occupied : stays.length;
      const dailyRevenue = report === 'Payments'
        ? paymentsAll.filter((p) => (property === 'all' || p.hotelId === property) && p.date === date && ['paid', 'refunded'].includes(p.status) && (paymentStatus === 'all' || p.status === paymentStatus) && (paymentMethod === 'all' || p.method === paymentMethod)).reduce((s, p) => s + p.amount, 0)
        : reservationsAll.filter((r) => (property === 'all' || r.hotelId === property) && ['checked_in', 'checked_out'].includes(r.status) && r.checkIn <= date && r.checkOut > date).reduce((s, r) => s + r.nightlyRate, 0);
      return { date: date.slice(5), occupancy: available ? Math.round(occ / available * 100) : 0, revenue: dailyRevenue };
    });
    const roomCounts = new Map<string, number>();
    for (const r of rooms) roomCounts.set(r.categoryId, (roomCounts.get(r.categoryId) ?? 0) + 1);
    const roomRows = [...roomCounts].filter(([id]) => category === 'all' || id === category).map(([id, count]) => ({ name: id.replace('cat-', '').toUpperCase(), rooms: count }));
    const statusRows = ['paid', 'partially_paid', 'pending', 'failed', 'refunded'].map((s) => ({ name: s.replace('_', ' '), value: payments.filter((p) => p.status === s).length })).filter((x) => x.value > 0);
    const methodRows = ['cash', 'pos', 'bank_transfer', 'online'].map((method) => ({ name: method.replace(/_/g, ' '), amount: payments.filter((p) => p.method === method && ['paid', 'refunded'].includes(p.status)).reduce((sum, p) => sum + p.amount, 0), count: payments.filter((p) => p.method === method).length })).filter((x) => x.count > 0);
    const expenseByCat = [...expenses.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].map(([name, amount]) => ({ name, amount }));
    const orderValue = orders.reduce((sum, o) => sum + o.lines.reduce((v, l) => v + l.price * l.qty, 0), 0);
    const stockValue = inventory.reduce((sum, x) => sum + x.stock * x.unitCost, 0);
    const rows: Row[] = report === 'Occupancy' || report === 'Room performance'
      ? rooms.filter((r) => category === 'all' || r.categoryId === category).map((r) => ({ label: `Room ${r.number}`, value: r.status.replace(/_/g, ' '), detail: `${r.hotelId} · ${r.categoryId}` }))
      : report === 'Revenue' || report === 'Payments'
        ? payments.map((p) => ({ label: p.reference, value: money(p.amount), detail: `${p.method.replace(/_/g, ' ')} · ${p.status} · ${p.date}` }))
        : report === 'Reservations'
          ? reservationCount.map((r) => ({ label: r.reference, value: r.status.replace(/_/g, ' '), detail: `${r.checkIn} to ${r.checkOut} · ${r.hotelId}` }))
          : report === 'Guests'
            ? guests.map((g) => ({ label: g.fullName, value: g.vip ? 'VIP' : 'Guest', detail: `${g.nationality} · ${reservationsAll.filter((r) => r.guestId === g.id).length} bookings` }))
            : report === 'Expenses'
              ? expenses.map((e) => ({ label: e.category, value: money(e.amount), detail: `${e.vendor} · ${e.date}` }))
              : report === 'Staff'
                ? staff.map((s) => ({ label: s.name, value: s.department, detail: `${attendance.filter((a) => a.staffId === s.id).length} attendance records · ${s.status}` }))
                : report === 'Restaurant'
                  ? orders.map((o) => ({ label: o.reference, value: money(o.lines.reduce((v, l) => v + l.price * l.qty, 0)), detail: `${o.type.replace('_', ' ')} · ${o.status}` }))
                  : [...inventory.map((x) => ({ label: x.name, value: x.stock, detail: `${x.category} · ${x.stock <= x.reorderLevel ? 'Low stock' : 'In stock'}` })), ...movements.map((x) => ({ label: `${inventoryAll.find((it) => it.id === x.itemId)?.name ?? x.itemId} · ${x.type}`, value: x.change, detail: `${x.date} · ${x.reason}` })), ...purchases.map((x) => ({ label: x.reference, value: x.status, detail: `${suppliersAll.find((supplier) => supplier.id === x.supplierId)?.name ?? 'Supplier'} · ${x.createdAt}` }))];
    return { rooms, reservations, payments, refunds, expenses, staff, attendance, tasks, inventory, movements, purchases, orders, guests, available, occupied, totalCollected, refundTotal, reservationCount, confirmedCount, chart, roomRows, statusRows, methodRows, expenseByCat, orderValue, stockValue, rows, roomRevenue, soldRoomNights, rangeDays, revenueByDepartment, revenueByRoomCategory, outstanding };
  }, [roomsAll, reservationsAll, paymentsAll, chargesAll, refundsAll, expensesAll, guestsAll, staffAll, attendanceAll, tasksAll, inventoryAll, movementsAll, purchasesAll, suppliersAll, ordersAll, start, end, property, department, category, paymentStatus, paymentMethod, report]);

  const metrics: Array<[string, string, string]> = report === 'Occupancy' ? [
    ['Occupancy today', `${data.available ? Math.round(data.occupied / data.available * 100) : 0}%`, `${data.occupied} occupied / ${data.available} sellable`],
    ['Available rooms', String(data.rooms.filter((r) => ['available', 'inspected'].includes(r.status)).length), 'Ready for assignment'], ['Occupied rooms', String(data.occupied), 'Current room status'], ['Out of service', String(data.rooms.filter((r) => ['maintenance', 'out_of_service'].includes(r.status)).length), 'Excluded from sellable rooms'],
  ] : report === 'Revenue' ? [
    ['Recognized room revenue', money(data.roomRevenue), 'Occupied room nights at contracted nightly rates'],
    ['Average Daily Rate', data.soldRoomNights ? money(data.roomRevenue / data.soldRoomNights) : '—', `${data.soldRoomNights} sold room nights`],
    ['Revenue per available room', data.available && data.rangeDays ? money(data.roomRevenue / (data.available * data.rangeDays)) : '—', `${data.available * data.rangeDays} available room nights`],
    ['Ancillary revenue', money(data.revenueByDepartment.reduce((sum, x) => sum + x.amount, 0)), 'Posted folio charges in range'],
  ] : report === 'Payments' ? [
    ['Payments received', money(data.totalCollected), 'Successful payments in range'], ['Outstanding folio balances', money(data.outstanding), 'Settled stay folios in period'], ['Refunds processed', money(data.refundTotal), 'Processed refund requests in range'], ['Partial / pending', String(data.payments.filter((p) => ['pending', 'partially_paid'].includes(p.status)).length), 'Payment records still unresolved'],
  ] : report === 'Reservations' ? [
    ['Reservations created', String(data.reservationCount.length), 'Created within selected range'], ['Confirmed', String(data.confirmedCount), 'Confirmed, checked-in or completed'], ['Cancelled / no-show', String(data.reservationCount.filter((r) => ['cancelled', 'no_show'].includes(r.status)).length), 'From matching reservations'], ['Avg. stay', `${(data.reservationCount.reduce((n, r) => n + Math.max(0, (Date.parse(r.checkOut) - Date.parse(r.checkIn)) / 86400000), 0) / Math.max(1, data.reservationCount.length)).toFixed(1)} nights`, 'Across matching bookings'],
  ] : report === 'Expenses' ? [
    ['Expenses', money(data.expenses.reduce((s, x) => s + x.amount, 0)), `${data.expenses.length} expense records`], ['Collected', money(data.totalCollected), 'Successful payments'], ['Net after expenses', money(data.totalCollected - data.expenses.reduce((s, x) => s + x.amount, 0)), 'Collections less operating expenses'], ['Expense categories', String(data.expenseByCat.length), 'In selected range'],
  ] : report === 'Staff' ? [
    ['Team members', String(data.staff.length), `${data.staff.filter((s) => s.status === 'active').length} active`], ['Attendance records', String(data.attendance.length), 'Within selected period'], ['Present / late', String(data.attendance.filter((x) => ['present', 'late'].includes(x.status)).length), 'Based on attendance records'], ['Cleaning completion', `${data.tasks.length ? Math.round(data.tasks.filter((x) => ['completed', 'inspected'].includes(x.status)).length / data.tasks.length * 100) : 0}%`, `${data.tasks.length} tasks in range`],
  ] : report === 'Restaurant' ? [
    ['Restaurant orders', String(data.orders.length), 'Orders opened in range'], ['Order sales', money(data.orderValue), 'Menu line totals (demonstration)'], ['Room service', String(data.orders.filter((o) => o.type === 'room_service').length), 'Room service orders'], ['Best selling', data.orders.flatMap((o) => o.lines).sort((a, b) => b.qty - a.qty)[0]?.name ?? 'No orders', 'By line quantity'],
  ] : report === 'Inventory' ? [
    ['Stock valuation', money(data.stockValue), 'On-hand quantity × unit cost'], ['Low stock items', String(data.inventory.filter((x) => x.stock <= x.reorderLevel).length), 'At or below reorder level'], ['Stock movements', String(data.movements.length), 'Within selected period'], ['Purchase orders', String(data.purchases.length), 'Created in selected period'],
  ] : report === 'Guests' ? [
    ['Guest profiles', String(data.guests.length), 'Shared guest directory'], ['New guests', String(data.guests.filter((g) => inRange(g.createdAt, start, end)).length), 'Profiles created in range'], ['Returning guests', String(data.guests.filter((g) => reservationsAll.filter((r) => r.guestId === g.id).length > 1).length), 'More than one reservation'], ['VIP guests', String(data.guests.filter((g) => g.vip).length), 'VIP flag in guest profiles'],
  ] : [
    ['Room categories', String(data.roomRows.length), 'Physical room inventory'], ['Rooms tracked', String(data.rooms.length), 'By current status'], ['Booked nightly value', money(data.reservations.reduce((s, r) => s + r.nightlyRate, 0)), 'Nightly reservation rates, not recognized revenue'], ['Room availability', String(data.available), 'Sellable room count'],
  ];

  return <div className="report-print">
    <PageHeader title="Reports and analytics" description={`Hotel performance · ${start} to ${end}`} actions={<><Button variant="secondary" disabled={!canExport} onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print report</Button><Button disabled={!canExport} onClick={() => downloadCsv(data.rows, metrics.map(([label, value, detail]) => ({ label, value, detail })), report, start, end)}><Download className="h-4 w-4" aria-hidden />Export CSV</Button></>} />
    <Card className="mb-5 p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
      <Select label="Report category" value={report} onChange={(e) => setReport(e.target.value)} options={REPORTS.map((x) => ({ value: x, label: x }))} />
      <Select label="Reporting period" value={period} onChange={(e) => { const next = e.target.value; setPeriod(next); if (next !== 'custom') { setEnd(endDefault); setStart(addDays(endDefault, -(Number(next) - 1))); } }} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'custom', label: 'Custom range' }]} />
      <Input label="From" type="date" value={start} onChange={(e) => { setPeriod('custom'); setStart(e.target.value); }} />
      <Input label="To" type="date" value={end} onChange={(e) => { setPeriod('custom'); setEnd(e.target.value); }} error={invalid ? 'End date must be on or after start date.' : undefined} />
      <Select label="Property" value={property} onChange={(e) => setProperty(e.target.value)} options={[{ value: 'all', label: 'All properties' }, ...mockHotels.map((h) => ({ value: h.id, label: h.name }))]} />
      <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} options={[{ value: 'all', label: 'All departments' }, ...[...new Set(staffAll.map((s) => s.department))].map((x) => ({ value: x, label: x }))]} />
      <Select label="Room category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'all', label: 'All categories' }, ...[...new Set(roomsAll.map((r) => r.categoryId))].map((x) => ({ value: x, label: x.replace('cat-', '').toUpperCase() }))]} />
    </div>{report === 'Payments' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><Select label="Payment status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...['paid', 'partially_paid', 'pending', 'failed', 'refunded'].map((x) => ({ value: x, label: x.replace(/_/g, ' ') }))]} /><Select label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={[{ value: 'all', label: 'All methods' }, ...['cash', 'pos', 'bank_transfer', 'online'].map((x) => ({ value: x, label: x.replace(/_/g, ' ') }))]} /></div>}<p className="mt-3 text-meta text-slate print:block">Filters: {report} · {start} to {end} · {property === 'all' ? 'All properties' : mockHotels.find((h) => h.id === property)?.name ?? property} · {department === 'all' ? 'All departments' : department} · {category === 'all' ? 'All room categories' : category}{report === 'Payments' ? ` · ${paymentStatus === 'all' ? 'All payment statuses' : paymentStatus} · ${paymentMethod === 'all' ? 'All payment methods' : paymentMethod}` : ''}</p></Card>
    {invalid ? <Card className="p-8"><EmptyState icon={BarChart3} title="Check the reporting period" description="Choose an end date on or after the start date." /></Card> : <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, hint]) => <StatCard key={label} label={label} value={value} hint={hint} />)}</section>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title={report === 'Expenses' ? 'Expenses by category' : report === 'Payments' ? 'Payment status distribution' : report === 'Revenue' ? 'Room revenue by category' : 'Property room mix'} /><div className="h-64 p-4" role="img" aria-label="Report breakdown chart"><ResponsiveContainer width="100%" height="100%">{report === 'Expenses' || report === 'Revenue' ? <BarChart data={report === 'Expenses' ? data.expenseByCat : data.revenueByRoomCategory}><CartesianGrid vertical={false} stroke={chartColors.line} /><XAxis dataKey="name" tick={{ fill: chartColors.slate, fontSize: 11 }} /><YAxis width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => money(Number(v))} /><Bar dataKey="amount" fill={chartColors.forest} radius={[3, 3, 0, 0]} /></BarChart> : report === 'Payments' ? <PieChart><Pie data={data.statusRows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>{data.statusRows.map((x, i) => <Cell key={x.name} fill={palette[i % palette.length]} />)}</Pie><Tooltip /><Legend /></PieChart> : <BarChart data={data.roomRows}><CartesianGrid vertical={false} stroke={chartColors.line} /><XAxis dataKey="name" tick={{ fill: chartColors.slate, fontSize: 11 }} /><YAxis allowDecimals={false} width={35} /><Tooltip /><Bar dataKey="rooms" name="Rooms" fill={chartColors.champagne} radius={[3, 3, 0, 0]} /></BarChart>}</ResponsiveContainer></div></Card>
      </div>
      {report === 'Revenue' && <Card className="mt-4"><CardHeader title="Revenue by department" /><div className="h-60 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.revenueByDepartment}><CartesianGrid vertical={false} stroke={chartColors.line} /><XAxis dataKey="name" tick={{ fill: chartColors.slate, fontSize: 11 }} /><YAxis width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => money(Number(v))} /><Bar dataKey="amount" name="Posted folio charges" fill={chartColors.champagne} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>{data.revenueByDepartment.length === 0 && <p className="px-5 pb-4 text-meta text-slate">No ancillary folio charges are recorded for this period.</p>}</Card>}
      {report === 'Payments' && <Card className="mt-4"><CardHeader title="Payments by method" /><div className="h-56 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.methodRows}><CartesianGrid vertical={false} stroke={chartColors.line} /><XAxis dataKey="name" tick={{ fill: chartColors.slate, fontSize: 11 }} /><YAxis width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v) => money(Number(v))} /><Bar dataKey="amount" name="Successful amount" fill={chartColors.forest} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>{data.methodRows.length === 0 && <p className="px-5 pb-4 text-meta text-slate">No successful payments for this selection.</p>}</Card>}
      <Card className="mt-5"><CardHeader title={`${report} detail`} action={<span className="text-meta text-slate">{data.rows.length} records · {start} — {end}</span>} /><DataTable caption={`${report} report detail`} rows={data.rows} rowKey={(r) => `${r.label}-${r.detail}`} columns={[
        { key: 'label', header: 'Item', render: (r) => <span className="font-medium">{r.label}</span>, sortValue: (r) => r.label },
        { key: 'value', header: 'Value', render: (r) => String(r.value), sortValue: (r) => String(r.value) },
        { key: 'detail', header: 'Details', render: (r) => <span className="text-slate">{r.detail}</span> },
      ] as Column<Row>[]} pageSize={8} empty={<div className="p-8"><EmptyState icon={BarChart3} title="No records for this selection" description="Adjust the dates or filters to see report details." /></div>} /></Card>
      <p className="mt-3 text-meta text-slate">Figures use shared HotelOS demonstration records. Guest demographics use only the non-sensitive nationality field. Daily room revenue is based on realized reservation nights; collections use successful payment records. This seed has no booking source, guest feedback scores, walk-in flag, departmental expense allocation, or historical out-of-service timeline, so those measures are not fabricated.</p>
    </>}
  </div>;
}
