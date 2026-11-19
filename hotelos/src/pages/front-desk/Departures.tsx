import { Card } from '@/components/ui/Card';
import { useScopedData } from '@/hooks/useScopedData';
import { departuresOf } from './frontDeskLists';
import { FrontDeskShell } from './FrontDeskShell';
import { StayList } from './StayList';
import { useFrontDeskDialogs } from './useFrontDeskDialogs';

export default function Departures() {
  const { reservations } = useScopedData();
  const { dialogs, ...a } = useFrontDeskDialogs();
  const rows = departuresOf(reservations);
  const waiting = rows.filter((r) => r.status === 'checked_in').length;
  return (
    <FrontDeskShell title="Departures" description={`${waiting} to check out · ${rows.length - waiting} departed`}>
      <Card><StayList rows={rows} mode="departures" a={a} emptyTitle="No departures today" /></Card>
      {dialogs}
    </FrontDeskShell>
  );
}
