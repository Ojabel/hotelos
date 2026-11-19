import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { PriorityBadge } from '@/components/ui/StatusBadge';
import { useScopedData } from '@/hooks/useScopedData';
import { useHotelStore } from '@/store/useHotelStore';
import type { HousekeepingTask, InspectionRecord } from '@/types';
import { formatDate } from '@/utils/format';
import { HousekeepingShell } from './HousekeepingShell';
import { InspectDialog } from './TaskDialogs';

export default function Inspections() {
  const { rooms, roomById } = useScopedData();
  const staff = useHotelStore((s) => s.staff);
  const tasks = useHotelStore((s) => s.housekeepingTasks);
  const records = useHotelStore((s) => s.inspections);
  const [result, setResult] = useState('all');
  const [inspecting, setInspecting] = useState<HousekeepingTask | null>(null);

  const ids = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms]);
  const waiting = tasks.filter((t) => t.status === 'completed' && ids.has(t.roomId));
  const rows = useMemo(() => records.filter((r) => ids.has(r.roomId) && (result === 'all' || r.result === result)), [records, ids, result]);
  const name = (id: string) => staff.find((p) => p.id === id)?.name ?? id;
  const failRate = records.length ? Math.round((records.filter((r) => r.result === 'failed').length / records.length) * 100) : 0;

  const cols: Column<InspectionRecord>[] = [
    { key: 'date', header: 'Date', sortValue: (r) => r.date + r.id, render: (r) => formatDate(r.date, false) },
    { key: 'room', header: 'Room', sortValue: (r) => roomById.get(r.roomId)?.number ?? '', render: (r) => <span className="font-medium">{roomById.get(r.roomId)?.number}</span> },
    { key: 'by', header: 'Inspector', render: (r) => name(r.inspectorId) },
    { key: 'score', header: 'Score', align: 'right', sortValue: (r) => r.score, render: (r) => `${r.score}%` },
    { key: 'res', header: 'Result', render: (r) => <Badge tone={r.result === 'passed' ? 'success' : 'danger'}>{r.result === 'passed' ? 'Passed' : 'Failed'}</Badge> },
    { key: 'notes', header: 'Notes', render: (r) => <span className="text-slate">{r.notes ?? '—'}</span> },
  ];

  return (
    <HousekeepingShell title="Inspections" description={`${records.length} records · ${failRate}% failed first time`}>
      <Card>
        <CardHeader title="Awaiting inspection" />
        {waiting.length === 0 ? <p className="px-5 py-6 text-body text-slate">No rooms are waiting for inspection.</p> : (
          <ul className="divide-y divide-line">{waiting.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-body font-medium">Room {roomById.get(t.roomId)?.number}</p><p className="text-meta text-slate">Cleaned by {name(t.assigneeId ?? '')}</p></div><div className="flex items-center gap-2"><PriorityBadge priority={t.priority} /><Button size="sm" onClick={() => setInspecting(t)}><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />Inspect</Button></div></li>
          ))}</ul>
        )}
      </Card>
      <Card className="mt-4 sm:mt-6">
        <div className="max-w-xs border-b border-line p-4"><Select label="Result" value={result} onChange={(e) => setResult(e.target.value)} options={[{ value: 'all', label: 'All results' }, { value: 'passed', label: 'Passed' }, { value: 'failed', label: 'Failed' }]} /></div>
        <DataTable caption="Inspection records" rows={rows} columns={cols} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'date', dir: 'desc' }} empty={<EmptyState icon={ClipboardCheck} title="No inspection records" />}
          mobileCard={(r) => (<div className="p-4"><div className="flex items-center justify-between"><p className="font-medium">Room {roomById.get(r.roomId)?.number} · {formatDate(r.date, false)}</p><Badge tone={r.result === 'passed' ? 'success' : 'danger'}>{r.result === 'passed' ? 'Passed' : 'Failed'}</Badge></div><p className="text-meta text-slate">{name(r.inspectorId)} · {r.score}%{r.notes ? ` · ${r.notes}` : ''}</p></div>)} />
      </Card>
      <InspectDialog task={inspecting} onClose={() => setInspecting(null)} />
    </HousekeepingShell>
  );
}
