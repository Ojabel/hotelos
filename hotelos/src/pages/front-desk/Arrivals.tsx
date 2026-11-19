import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useScopedData } from '@/hooks/useScopedData';
import { arrivalsOf } from './frontDeskLists';
import { FrontDeskShell } from './FrontDeskShell';
import { StayList } from './StayList';
import { useFrontDeskDialogs } from './useFrontDeskDialogs';

export default function Arrivals() {
  const { reservations } = useScopedData();
  const { dialogs, ...a } = useFrontDeskDialogs();
  const rows = arrivalsOf(reservations);
  const waiting = rows.filter((r) => r.status !== 'checked_in').length;
  return (
    <FrontDeskShell title="Arrivals" description={`${waiting} waiting · ${rows.length - waiting} checked in`} actions={<Link to="/reservations/walk-in"><Button variant="secondary">Walk-in</Button></Link>}>
      <Card><StayList rows={rows} mode="arrivals" a={a} emptyTitle="No arrivals today" /></Card>
      {dialogs}
    </FrontDeskShell>
  );
}
