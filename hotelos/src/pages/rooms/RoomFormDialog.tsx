import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { mockHotels } from '@/data/mockHotels';
import { ROOM_CATEGORIES } from '@/data/roomCatalog';
import { backendMode, useBackendHotels, useRoomCategories } from '@/services/api/backendMode';
import { backendOperations } from '@/services/backendOperations';
import { createRoom, updateRoom } from '@/services/mockRoomService';
import { toast, useAppStore } from '@/store/useAppStore';
import type { Room } from '@/types';

/** Create (room undefined) or edit a room. */
export function RoomFormDialog({ open, room, onClose }: { open: boolean; room?: Room; onClose: () => void }) {
  const defaultHotel = useAppStore((s) => s.hotelId);
  const hotels = useBackendHotels();
  const categories = useRoomCategories();
  const [hotelId, setHotelId] = useState('h-vi');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [categoryId, setCategoryId] = useState(ROOM_CATEGORIES[0]?.id ?? '');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', basePrice: '', capacity: '2', bedConfiguration: '', amenities: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setHotelId(room?.hotelId ?? (backendMode ? (defaultHotel === 'all' ? hotels[0]?.id ?? '' : defaultHotel) : (defaultHotel === 'all' ? 'h-vi' : defaultHotel)));
    setNumber(room?.number ?? '');
    setFloor(String(room?.floor ?? 1));
    setCategoryId(room?.categoryId ?? categories[0]?.id ?? '');
    setAddingCategory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room, defaultHotel]);

  const cat = categories.find((c) => c.id === categoryId);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    if (backendMode && addingCategory) {
      const price = Number(categoryForm.basePrice);
      const capacity = Number(categoryForm.capacity);
      if (!categoryForm.name.trim() || !Number.isSafeInteger(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1 || !categoryForm.bedConfiguration.trim()) {
        setError('Enter a category name, valid nightly price, guest capacity and bed configuration.');
        setSaving(false);
        return;
      }
      const savedCategory = await backendOperations.createCategory(hotelId, {
        name: categoryForm.name.trim(), description: '', basePrice: price, capacity,
        bedConfiguration: categoryForm.bedConfiguration.trim(), amenities: categoryForm.amenities.split(',').map((value) => value.trim()).filter(Boolean),
      });
      setSaving(false);
      if (!savedCategory.ok) return setError(savedCategory.error);
      setCategoryId(savedCategory.value.id);
      setAddingCategory(false);
      toast.success('Room category created', savedCategory.value.name);
      return;
    }
    if (!categoryId) { setError('Create a room category before adding rooms.'); setSaving(false); return; }
    const input = { hotelId, number, floor: Number(floor), categoryId };
    const res = room ? await updateRoom(room.id, input) : await createRoom(input);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(room ? `Room ${res.value.number} updated` : `Room ${res.value.number} created`);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={room ? `Edit room ${room.number}` : 'Add room'} description="Room status is managed separately from room details."
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="room-form" loading={saving}>{addingCategory ? 'Save category' : room ? 'Save changes' : 'Create room'}</Button></>}>
      <form id="room-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        <Select label="Property" value={hotelId} onChange={(e) => setHotelId(e.target.value)} disabled={Boolean(room) || backendMode} options={backendMode ? hotels.map((h) => ({ value: h.id, label: h.name })) : mockHotels.map((h) => ({ value: h.id, label: h.name }))} />
        {backendMode && <div className="rounded border border-line bg-ivory p-3">
          {addingCategory ? <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Category name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            <Input label="Nightly base price" type="number" min={0} value={categoryForm.basePrice} onChange={(e) => setCategoryForm({ ...categoryForm, basePrice: e.target.value })} />
            <Input label="Guest capacity" type="number" min={1} value={categoryForm.capacity} onChange={(e) => setCategoryForm({ ...categoryForm, capacity: e.target.value })} />
            <Input label="Bed configuration" value={categoryForm.bedConfiguration} onChange={(e) => setCategoryForm({ ...categoryForm, bedConfiguration: e.target.value })} />
            <Input label="Amenities" value={categoryForm.amenities} onChange={(e) => setCategoryForm({ ...categoryForm, amenities: e.target.value })} hint="Comma separated" />
            <Button type="button" variant="ghost" onClick={() => setAddingCategory(false)}>Cancel category</Button>
          </div> : <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-meta text-slate">{categories.length ? `${categories.length} saved categories` : 'Add a category before creating the first room.'}</span><Button type="button" variant="secondary" onClick={() => setAddingCategory(true)}>Create category</Button></div>}
        </div>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Room number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. 207" />
          <Input label="Floor" type="number" min={0} max={40} value={floor} onChange={(e) => setFloor(e.target.value)} />
        </div>
        <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.map((c) => ({ value: c.id, label: c.name }))} disabled={categories.length === 0} />
        {cat && <p className="rounded bg-ivory px-3 py-2 text-meta text-slate">{cat.bedConfiguration} · sleeps {cat.capacity} · {cat.amenities.join(', ')}</p>}
      </form>
    </Dialog>
  );
}
