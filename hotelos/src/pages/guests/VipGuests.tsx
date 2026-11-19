import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import { formatDate } from '@/utils/format';
import { useGuestStats } from './GuestsPage';

export default function VipGuests() {
  const guests = useHotelStore((s) => s.guests.filter((g) => g.vip));
  const reservations = useHotelStore((s) => s.reservations);
  const notes = useHotelStore((s) => s.guestNotes);
  const rooms = useHotelStore((s) => s.rooms);
  const stats = useGuestStats();
  const t = today();

  return (
    <>
      <PageHeader title="VIP guests" description={`${guests.length} guests`} actions={<Link to="/guests"><Button variant="secondary">All guests</Button></Link>} />
      {guests.length === 0 ? <Card><EmptyState icon={Crown} title="No VIP guests yet" description="Mark a guest as VIP from their profile." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guests.map((g) => {
            const inHouse = reservations.find((r) => r.guestId === g.id && r.status === 'checked_in');
            const next = reservations.filter((r) => r.guestId === g.id && ['pending', 'confirmed'].includes(r.status) && r.checkIn >= t).sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1))[0];
            const mine = notes.filter((n) => n.guestId === g.id);
            return (
              <Card key={g.id} className="p-5">
                <div className="flex items-start justify-between gap-2"><Link to={`/guests/${g.id}`} className="text-card font-semibold hover:underline">{g.fullName}</Link><Crown className="h-4 w-4 text-champagne" aria-label="VIP" /></div>
                <p className="text-meta text-slate">{g.nationality} · {stats.get(g.id)?.stays ?? 0} stays</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{inHouse && <Badge tone="success">In-house · Room {rooms.find((r) => r.id === inHouse.roomId)?.number}</Badge>}{next && <Badge tone="info">Arrives {formatDate(next.checkIn, false)}</Badge>}</div>
                {g.preferences.length > 0 && <p className="mt-3 text-body text-slate">Prefers: {g.preferences.join(', ')}</p>}
                {mine[0] && <p className="mt-2 rounded bg-ivory px-3 py-2 text-body text-slate">{mine[0].text}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
