import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { orderTotal } from '@/services/mockRestaurantService';
import { formatCurrency } from '@/utils/format';
import { NewOrderDialog } from './NewOrderDialog';
import { OrderBoard } from './OrderBoard';
import { RestaurantShell } from './RestaurantShell';
import { FINANCIAL_ROLES } from '@/routes/nav';

export default function RoomService() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const orders = useHotelStore((s) => s.orders);
  const [creating, setCreating] = useState(false);
  const mine = orders.filter((o) => o.type === 'room_service' && (hotelId === 'all' || o.hotelId === hotelId) && o.status !== 'cancelled');
  const awaiting = mine.filter((o) => o.status === 'served' && o.payment === 'open');
  const charged = mine.filter((o) => o.payment === 'charged_to_room');

  return (
    <RestaurantShell title="Room service" description="In-house guest orders and charge-to-room" actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New request</Button>}>
      <section className={`mb-5 grid grid-cols-2 gap-3 sm:gap-4 ${canViewFinancials ? 'xl:grid-cols-4' : 'xl:grid-cols-2'}`}>
        <StatCard label="In the kitchen" value={String(mine.filter((o) => o.status === 'new' || o.status === 'preparing').length)} />
        <StatCard label="Ready to deliver" value={String(mine.filter((o) => o.status === 'ready').length)} />
        {canViewFinancials && <><StatCard label="Delivered, not charged" value={String(awaiting.length)} hint={formatCurrency(awaiting.reduce((s, o) => s + orderTotal(o), 0))} /><StatCard label="Charged to rooms" value={formatCurrency(charged.reduce((s, o) => s + orderTotal(o), 0))} /></>}
      </section>
      <OrderBoard type="room_service" />
      <NewOrderDialog open={creating} type="room_service" onClose={() => setCreating(false)} />
    </RestaurantShell>
  );
}
