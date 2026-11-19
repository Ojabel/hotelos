import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { mockHotels } from '@/data/mockHotels';
import { createOrder, tableState } from '@/services/mockRestaurantService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { RestaurantOrder } from '@/types';
import { MenuPicker, toLines } from './MenuPicker';

interface Props { open: boolean; type: RestaurantOrder['type']; presetTableId?: string; onClose: () => void; onCreated?: (o: RestaurantOrder) => void }

export function NewOrderDialog(props: Props) {
  return props.open ? <Body {...props} /> : null;
}

function Body({ type, presetTableId, onClose, onCreated }: Props) {
  const globalHotel = useAppStore((s) => s.hotelId);
  const { tables, orders, rooms, reservations, guests } = useHotelStore();
  const presetHotel = presetTableId ? tables.find((t) => t.id === presetTableId)?.hotelId : undefined;
  const [hotelId, setHotelId] = useState(presetHotel ?? (globalHotel === 'all' ? 'h-vi' : globalHotel));
  const [tableId, setTableId] = useState(presetTableId ?? '');
  const [covers, setCovers] = useState('2');
  const [guestName, setGuestName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const freeTables = useMemo(() => tables.filter((t) => t.hotelId === hotelId && tableState(t, orders) === 'free' || t.id === presetTableId), [tables, orders, hotelId, presetTableId]);
  const inHouse = useMemo(() => reservations.filter((r) => r.hotelId === hotelId && r.status === 'checked_in').map((r) => ({ r, room: rooms.find((x) => x.id === r.roomId)!, guest: guests.find((g) => g.id === r.guestId)! })).sort((a, b) => a.room.number.localeCompare(b.room.number, undefined, { numeric: true })), [reservations, rooms, guests, hotelId]);
  const table = tableId || freeTables[0]?.id || '';
  const room = roomId || inHouse[0]?.room.id || '';

  const submit = async () => {
    setBusy(true);
    const r = await createOrder({ hotelId, type, tableId: type === 'dine_in' ? table : undefined, roomId: type === 'room_service' ? room : undefined, guestName, covers: Number(covers), lines: toLines(qty), notes });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`${r.value.reference} sent to the kitchen`);
    onCreated?.(r.value);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="lg" title={type === 'dine_in' ? 'New table order' : 'New room-service request'}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={submit} loading={busy}>Send to kitchen</Button></>}>
      <div className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {!presetTableId && globalHotel === 'all' && <Select label="Property" value={hotelId} onChange={(e) => { setHotelId(e.target.value); setTableId(''); setRoomId(''); }} options={mockHotels.map((h) => ({ value: h.id, label: h.name }))} />}
        {type === 'dine_in' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Table" value={table} onChange={(e) => setTableId(e.target.value)} disabled={Boolean(presetTableId)} options={freeTables.length ? freeTables.map((t) => ({ value: t.id, label: `${t.number} · seats ${t.seats} · ${t.area}` })) : [{ value: '', label: 'No free tables' }]} />
            <Input label="Guests" type="number" min={1} value={covers} onChange={(e) => setCovers(e.target.value)} />
            <Input label="Name (optional)" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
        ) : (
          inHouse.length === 0 ? <p className="text-body text-slate">No in-house guests at this property.</p> : (
            <Select label="Room" value={room} onChange={(e) => setRoomId(e.target.value)} options={inHouse.map(({ room: rm, guest }) => ({ value: rm.id, label: `${rm.number} — ${guest.fullName}` }))} />
          )
        )}
        <MenuPicker quantities={qty} onChange={setQty} />
        <Textarea label="Kitchen notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, how to cook, delivery instructions" />
      </div>
    </Dialog>
  );
}
