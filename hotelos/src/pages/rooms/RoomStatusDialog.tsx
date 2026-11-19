import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { RoomStatusBadge } from '@/components/ui/StatusBadge';
import { changeRoomStatus } from '@/services/mockRoomService';
import { toast } from '@/store/useAppStore';
import type { Room, RoomStatus } from '@/types';
import { MANUAL_ROOM_TRANSITIONS } from '@/utils/roomRules';
import { ROOM_STATUS_META } from '@/utils/status';

export function RoomStatusDialog({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const options = room ? MANUAL_ROOM_TRANSITIONS[room.status] : [];
  const [next, setNext] = useState<RoomStatus | ''>('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNext(options[0] ?? ''); setError(''); }, [room]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!room || !next) return;
    setSaving(true);
    const res = await changeRoomStatus(room.id, next);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(`Room ${room.number} is now ${ROOM_STATUS_META[next].label.toLowerCase()}`);
    onClose();
  };

  return (
    <Dialog open={Boolean(room)} onClose={onClose} size="sm" title={room ? `Room ${room.number} status` : ''}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>{options.length > 0 && <Button onClick={save} loading={saving} disabled={!next}>Update status</Button>}</>}>
      {room && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-body">Current status <RoomStatusBadge status={room.status} /></div>
          {options.length === 0 ? (
            <p className="rounded bg-ivory px-3 py-2 text-body text-slate">
              {room.status === 'occupied' ? 'This room is occupied. Its status changes automatically when the guest checks out.' : 'This room is held for an arriving guest. Its status changes with the reservation (check-in, cancellation or no-show).'}
            </p>
          ) : (
            <Select label="Change to" value={next} onChange={(e) => setNext(e.target.value as RoomStatus)} options={options.map((s) => ({ value: s, label: ROOM_STATUS_META[s].label }))} />
          )}
          {error && <p role="alert" className="text-meta text-danger">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
