import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crown, Pencil, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Detail } from '@/components/ui/Detail';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { ReservationStatusBadge } from '@/components/ui/StatusBadge';
import { categoryById } from '@/data/roomCatalog';
import { addGuestNote, toggleComplaintResolved, updateGuest } from '@/services/mockGuestService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { GuestNote, Reservation } from '@/types';
import { today } from '@/utils/demoClock';
import { computeFolio } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { GuestFormDialog } from './GuestFormDialog';
import { FINANCIAL_ROLES } from '@/routes/nav';

const KIND_LABEL: Record<GuestNote['kind'], string> = { note: 'Note', request: 'Special request', complaint: 'Complaint' };

export default function GuestProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const author = useAppStore((s) => s.session?.name ?? 'Staff');
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const guest = useHotelStore((s) => s.guests.find((g) => g.id === id));
  const reservations = useHotelStore((s) => s.reservations);
  const rooms = useHotelStore((s) => s.rooms);
  const allNotes = useHotelStore((s) => s.guestNotes);
  const charges = useHotelStore((s) => s.charges);
  const payments = useHotelStore((s) => s.payments);
  const refunds = useHotelStore((s) => s.refunds);

  const [tab, setTab] = useState('stays');
  const [edit, setEdit] = useState(false);
  const [kind, setKind] = useState<GuestNote['kind']>('note');
  const [text, setText] = useState('');
  const [noteError, setNoteError] = useState('');
  const [filter, setFilter] = useState('all');

  const mine = useMemo(() => reservations.filter((r) => r.guestId === id), [reservations, id]);
  const t = today();
  const past = mine.filter((r) => r.status === 'checked_out' || r.status === 'checked_in' || r.status === 'no_show' || (r.status === 'cancelled' && r.checkIn < t)).sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  const upcoming = mine.filter((r) => ['pending', 'confirmed'].includes(r.status) && r.checkOut > t).sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));
  const notes = useMemo(() => allNotes.filter((n) => n.guestId === id && (filter === 'all' || n.kind === filter)), [allNotes, id, filter]);
  const balance = mine.filter((r) => r.status === 'checked_in' || r.status === 'checked_out').reduce((s, r) => s + Math.max(0, computeFolio(r, charges, payments, refunds).balance), 0);
  const openComplaints = allNotes.filter((n) => n.guestId === id && n.kind === 'complaint' && !n.resolved).length;
  const requests = allNotes.filter((n) => n.guestId === id && n.kind === 'request');

  if (!guest) return <Card><EmptyState icon={Users} title="Guest not found" action={<Link to="/guests"><Button variant="secondary">Back to guests</Button></Link>} /></Card>;

  const roomNo = (r: Reservation) => rooms.find((x) => x.id === r.roomId)?.number;
  const cols: Column<Reservation>[] = [
    { key: 'ref', header: 'Reference', render: (r) => <Link to={`/reservations/${r.id}`} className="font-medium hover:underline">{r.reference}</Link> },
    { key: 'in', header: 'Check-in', sortValue: (r) => r.checkIn, render: (r) => formatDate(r.checkIn, false) },
    { key: 'out', header: 'Check-out', render: (r) => formatDate(r.checkOut, false) },
    { key: 'room', header: 'Room', render: (r) => `${roomNo(r)} · ${categoryById(r.categoryId).name}` },
    ...(canViewFinancials ? [{ key: 'total', header: 'Total', align: 'right' as const, render: (r: Reservation) => formatCurrency(r.total) }] : []),
    { key: 'status', header: 'Status', render: (r) => <ReservationStatusBadge status={r.status} /> },
  ];

  const toggleVip = async () => {
    const r = await updateGuest(guest.id, { fullName: guest.fullName, email: guest.email, phone: guest.phone, nationality: guest.nationality, idType: guest.idType, idNumber: guest.idNumber, preferences: guest.preferences, vip: !guest.vip });
    if (r.ok) toast.success(r.value.vip ? 'Marked as VIP' : 'VIP status removed'); else toast.error('Could not update guest', r.error);
  };

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    const r = await addGuestNote({ guestId: guest.id, kind, text, author });
    if (!r.ok) return setNoteError(r.error);
    setNoteError(''); setText('');
    toast.success(`${KIND_LABEL[kind]} added`);
  };

  return (
    <>
      <PageHeader title={guest.fullName} description={`Guest since ${formatDate(guest.createdAt, false)}`}
        actions={<>{guest.vip && <Badge tone="champagne"><Crown className="h-3 w-3" aria-hidden />VIP</Badge>}<Button variant="secondary" onClick={toggleVip}>{guest.vip ? 'Remove VIP' : 'Mark as VIP'}</Button><Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" aria-hidden />Edit</Button><Button onClick={() => navigate('/reservations/new')}>New reservation</Button></>} />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-forest font-heading text-lg font-semibold text-champagne">{guest.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
            <div><p className="text-card font-semibold">{guest.fullName}</p><p className="text-meta text-slate">{guest.nationality}</p></div>
          </div>
          <dl className="mt-5 space-y-4">
            <Detail label="Email">{guest.email}</Detail>
            <Detail label="Phone">{guest.phone}</Detail>
            <Detail label="ID">{guest.idType} {guest.idNumber}</Detail>
            {canViewFinancials && <Detail label="Outstanding balance"><span className="tnum">{formatCurrency(balance)}</span></Detail>}
            <Detail label="Preferences">{guest.preferences.length ? <span className="flex flex-wrap gap-1.5">{guest.preferences.map((p) => <Badge key={p}>{p}</Badge>)}</span> : '—'}</Detail>
            <Detail label="Special requests">{requests.length ? <ul className="space-y-1 font-normal">{requests.slice(0, 3).map((n) => <li key={n.id} className="text-body">{n.text}</li>)}</ul> : '—'}</Detail>
          </dl>
        </Card>

        <div className="min-w-0 space-y-4">
          <Tabs label="Guest sections" value={tab} onChange={setTab} tabs={[{ id: 'stays', label: `Stay history (${past.length})` }, { id: 'upcoming', label: `Upcoming (${upcoming.length})` }, { id: 'notes', label: `Notes and complaints${openComplaints ? ` · ${openComplaints} open` : ''}` }]} />
          <div role="tabpanel">
            {tab === 'stays' && <Card><DataTable caption="Previous stays" rows={past} columns={cols} rowKey={(r) => r.id} pageSize={8} initialSort={{ key: 'in', dir: 'desc' }} empty={<EmptyState icon={Users} title="No previous stays" />} /></Card>}
            {tab === 'upcoming' && <Card><DataTable caption="Upcoming reservations" rows={upcoming} columns={cols} rowKey={(r) => r.id} pageSize={8} initialSort={{ key: 'in', dir: 'asc' }} empty={<EmptyState icon={Users} title="No upcoming reservations" action={<Link to="/reservations/new"><Button variant="secondary">Book a stay</Button></Link>} />} /></Card>}
            {tab === 'notes' && (
              <div className="space-y-4">
                <Card className="p-5">
                  <form onSubmit={submitNote} noValidate className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                      <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as GuestNote['kind'])} options={(Object.keys(KIND_LABEL) as GuestNote['kind'][]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
                      <Textarea label="Details" value={text} onChange={(e) => setText(e.target.value)} />
                    </div>
                    {noteError && <p role="alert" className="text-meta text-danger">{noteError}</p>}
                    <Button type="submit" variant="secondary">Add {KIND_LABEL[kind].toLowerCase()}</Button>
                  </form>
                </Card>
                <Card>
                  <div className="border-b border-line p-4"><Select label="Show" hideLabel value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: 'all', label: 'All entries' }, { value: 'note', label: 'Notes' }, { value: 'request', label: 'Special requests' }, { value: 'complaint', label: 'Complaints' }]} /></div>
                  {notes.length === 0 ? <EmptyState icon={Users} title="Nothing recorded" /> : (
                    <ul className="divide-y divide-line">
                      {notes.map((n) => (
                        <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3">
                          <div><p className="text-body">{n.text}</p><p className="mt-1 text-meta text-slate">{KIND_LABEL[n.kind]} · {n.author} · {formatDate(n.date, false)}</p></div>
                          {n.kind === 'complaint' && <Button size="sm" variant={n.resolved ? 'ghost' : 'secondary'} onClick={() => toggleComplaintResolved(n.id)}>{n.resolved ? 'Resolved — reopen' : 'Mark resolved'}</Button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
      <GuestFormDialog open={edit} guest={guest} onClose={() => setEdit(false)} />
    </>
  );
}
