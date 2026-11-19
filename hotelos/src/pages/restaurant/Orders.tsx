import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NewOrderDialog } from './NewOrderDialog';
import { OrderBoard } from './OrderBoard';
import { RestaurantShell } from './RestaurantShell';

export default function Orders() {
  const [creating, setCreating] = useState(false);
  return (
    <RestaurantShell title="Orders" description="Kitchen tracking for table orders" actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New table order</Button>}>
      <OrderBoard type="dine_in" />
      <NewOrderDialog open={creating} type="dine_in" onClose={() => setCreating(false)} />
    </RestaurantShell>
  );
}
