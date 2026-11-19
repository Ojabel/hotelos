import { Card } from '@/components/ui/Card';
import { useScopedData } from '@/hooks/useScopedData';
import { inHouseOf } from './frontDeskLists';
import { FrontDeskShell } from './FrontDeskShell';
import { StayList } from './StayList';
import { useFrontDeskDialogs } from './useFrontDeskDialogs';

export default function InHouse() {
  const { reservations } = useScopedData();
  const { dialogs, ...a } = useFrontDeskDialogs();
  const rows = inHouseOf(reservations);
  return (
    <FrontDeskShell title="In-house guests" description={`${rows.length} guests staying`}>
      <Card><StayList rows={rows} mode="in-house" a={a} emptyTitle="No guests in-house" /></Card>
      {dialogs}
    </FrontDeskShell>
  );
}
