import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Pencil, Plus, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { useHotelStore } from '@/store/useHotelStore';
import type { Guest } from '@/types';
import { computeFolio } from '@/utils/folio';
import { formatCurrency, formatDate } from '@/utils/format';
import { GuestFormDialog } from './GuestFormDialog';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';

export function useGuestStats() {
  const { reservations, charges, payments, refunds } = useHotelStore();
  return useMemo(() => {
    const stats = new Map<string, { stays: number; last?: string; balance: number }>();
    for (const r of reservations) {
      const s = stats.get(r.guestId) ?? { stays: 0, balance: 0 };
      if (r.status === 'checked_out' || r.status === 'checked_in') {
        s.stays += 1;
        if (!s.last || r.checkIn > s.last) s.last = r.checkIn;
        if (r.status === 'checked_in' || r.status === 'checked_out') s.balance += Math.max(0, computeFolio(r, charges, payments, refunds).balance);
      }
      stats.set(r.guestId, s);
    }
    return stats;
  }, [reservations, charges, payments, refunds]);
}

export default function GuestsPage() {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const navigate = useNavigate();
  const guests = useHotelStore((s) => s.guests);
  const stats = useGuestStats();
  const [q, setQ] = useState('');
  const [nationality, setNationality] = useState('all');
  const [vip, setVip] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | undefined>();

  const nationalities = useMemo(() => [...new Set(guests.map((g) => g.nationality))].sort(), [guests]);
  const filtered = useMemo(() => guests.filter((g) => {
    if (nationality !== 'all' && g.nationality !== nationality) return false;
    if (vip === 'vip' && !g.vip) return false;
    const term = q.trim().toLowerCase();
    return !term || `${g.fullName} ${g.email} ${g.phone}`.toLowerCase().includes(term);
  }), [guests, q, nationality, vip]);
  const clear = () => { setQ(''); setNationality('all'); setVip('all'); };

  const columns: Column<Guest>[] = [
    { key: 'name', header: 'Guest', sortValue: (g) => g.fullName, render: (g) => <span className="flex items-center gap-2 font-medium">{g.fullName}{g.vip && <Crown className="h-3.5 w-3.5 text-champagne" aria-label="VIP" />}</span> },
    { key: 'email', header: 'Email', render: (g) => <span className="text-slate">{g.email}</span> },
    { key: 'phone', header: 'Phone', render: (g) => g.phone },
    { key: 'nat', header: 'Nationality', sortValue: (g) => g.nationality, render: (g) => g.nationality },
    { key: 'stays', header: 'Stays', sortValue: (g) => stats.get(g.id)?.stays ?? 0, render: (g) => stats.get(g.id)?.stays ?? 0 },
    { key: 'last', header: 'Last stay', sortValue: (g) => stats.get(g.id)?.last ?? '', render: (g) => (stats.get(g.id)?.last ? formatDate(stats.get(g.id)!.last!, false) : '—') },
    ...(canViewFinancials ? [{ key: 'bal', header: 'Balance', align: 'right' as const, sortValue: (g: Guest) => stats.get(g.id)?.balance ?? 0, render: (g: Guest) => formatCurrency(stats.get(g.id)?.balance ?? 0) }] : []),
    { key: 'edit', header: '', align: 'right', render: (g) => <Button variant="ghost" size="sm" aria-label={`Edit ${g.fullName}`} onClick={(e) => { e.stopPropagation(); setEditing(g); setFormOpen(true); }}><Pencil className="h-4 w-4" aria-hidden /></Button> },
  ];

  return (
    <>
      <PageHeader title="Guests" description={`${filtered.length} of ${guests.length} guests`}
        actions={<><Link to="/guests/vip"><Button variant="secondary"><Crown className="h-4 w-4" aria-hidden />VIP guests</Button></Link><Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="h-4 w-4" aria-hidden />Add guest</Button></>} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5"><label htmlFor="g-q" className="block text-meta font-medium">Search</label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden /><input id="g-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body focus:border-champagne" /></div></div>
          <Select label="Nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} options={[{ value: 'all', label: 'All nationalities' }, ...nationalities.map((n) => ({ value: n, label: n }))]} />
          <Select label="Type" value={vip} onChange={(e) => setVip(e.target.value)} options={[{ value: 'all', label: 'All guests' }, { value: 'vip', label: 'VIP only' }]} />
          <Button variant="ghost" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Guests" rows={filtered} columns={columns} rowKey={(g) => g.id} pageSize={10} initialSort={{ key: 'name', dir: 'asc' }} onRowClick={(g) => navigate(`/guests/${g.id}`)}
          empty={<EmptyState icon={Users} title="No guests found" description="Try another search or clear the filters." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(g) => (
            <Link to={`/guests/${g.id}`} className="block p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">{g.fullName}</p>{g.vip && <Badge tone="champagne">VIP</Badge>}</div><p className="text-meta text-slate">{g.email}</p><p className="text-meta text-slate">{g.nationality} · {stats.get(g.id)?.stays ?? 0} stays</p></Link>
          )} />
      </Card>
      <GuestFormDialog open={formOpen} guest={editing} onClose={() => setFormOpen(false)} onSaved={(g) => { if (!editing) navigate(`/guests/${g.id}`); }} />
    </>
  );
}
