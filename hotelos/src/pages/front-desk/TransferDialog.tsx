import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { categoryById } from '@/data/roomCatalog';
import { transferRoom } from '@/services/mockFrontDeskService';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { Reservation } from '@/types';
import { today } from '@/utils/demoClock';
import { findAvailableRooms } from '@/utils/reservationRules';

function Body({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const { rooms, reservations, guests } = useHotelStore();
  const guest = guests.find((g) => g.id === reservation.guestId);
  const current = rooms.find((r) => r.id === reservation.roomId);
  const options = useMemo(() => findAvailableRooms(rooms, reservations, { hotelId: reservation.hotelId, checkIn: today(), checkOut: reservation.checkOut, readyNow: true, ignoreReservationId: reservation.id }).filter((r) => r.id !== reservation.roomId), [rooms, reservations, reservation]);
  const [roomId, setRoomId] = useState(options[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const r = await transferRoom({ reservationId: reservation.id, newRoomId: roomId, reason });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Room transfer complete', `${guest?.fullName} moved from ${current?.number}`);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="sm" title="Transfer room" description={`${guest?.fullName} · currently in room ${current?.number}`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={submit} loading={busy} disabled={!roomId}>Transfer guest</Button></>}>
      <div className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {options.length === 0 ? <p className="text-body text-slate">No ready rooms are free for the rest of this stay.</p> : (
          <Select label="Move to" value={roomId} onChange={(e) => setRoomId(e.target.value)} options={options.map((r) => ({ value: r.id, label: `${r.number} — ${categoryById(r.categoryId).name}` }))} />
        )}
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Guest requested a quieter room" />
        <p className="text-meta text-slate">The old room is marked dirty and the new room becomes occupied. The rate stays unchanged.</p>
      </div>
    </Dialog>
  );
}

export function TransferDialog({ reservation, onClose }: { reservation: Reservation | null; onClose: () => void }) {
  return reservation ? <Body key={reservation.id} reservation={reservation} onClose={onClose} /> : null;
}
