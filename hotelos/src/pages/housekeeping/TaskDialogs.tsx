import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { INSPECTION_CHECKLIST, assignTask, inspectTask } from '@/services/mockHousekeepingService';
import { backendMode } from '@/services/api/backendMode';
import { toast } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { HousekeepingTask } from '@/types';

export function AssignDialog({ task, onClose }: { task: HousekeepingTask | null; onClose: () => void }) {
  return task ? <AssignBody key={task.id} task={task} onClose={onClose} /> : null;
}

function AssignBody({ task, onClose }: { task: HousekeepingTask; onClose: () => void }) {
  const staff = useHotelStore((s) => s.staff);
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === task.roomId));
  const tasks = useHotelStore((s) => s.housekeepingTasks);
  const team = staff.filter((p) => p.department === 'Housekeeping' && p.hotelId === task.hotelId);
  const [id, setId] = useState(task.assigneeId ?? team.find((p) => p.status === 'active')?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = (sid: string) => tasks.filter((t) => t.assigneeId === sid && t.status !== 'inspected').length;

  const save = async () => {
    setBusy(true);
    const r = await assignTask(task.id, id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success('Task assigned', `Room ${room?.number}`);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="sm" title={`Assign room ${room?.number}`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={save} loading={busy} disabled={!id}>Assign</Button></>}>
      <div className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {team.length === 0 ? <p className="text-body text-slate">No housekeeping staff at this property.</p> : (
          <Select label="Team member" value={id} onChange={(e) => setId(e.target.value)} options={team.map((p) => ({ value: p.id, label: `${p.name} — ${p.status === 'active' ? `${load(p.id)} open task${load(p.id) === 1 ? '' : 's'}` : p.status.replace('_', ' ')}` }))} />
        )}
      </div>
    </Dialog>
  );
}

export function InspectDialog({ task, onClose }: { task: HousekeepingTask | null; onClose: () => void }) {
  return task ? <InspectBody key={task.id} task={task} onClose={onClose} /> : null;
}

function InspectBody({ task, onClose }: { task: HousekeepingTask; onClose: () => void }) {
  const staff = useHotelStore((s) => s.staff);
  const room = useHotelStore((s) => s.rooms.find((r) => r.id === task.roomId));
  const inspectors = staff.filter((p) => p.department === 'Housekeeping' && p.status === 'active' && p.id !== task.assigneeId);
  const [inspectorId, setInspectorId] = useState(inspectors.find((p) => p.title.includes('Head'))?.id ?? inspectors[0]?.id ?? '');
  const [checks, setChecks] = useState<boolean[]>(INSPECTION_CHECKLIST.map(() => true));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passed = checks.every(Boolean);

  const submit = async () => {
    setBusy(true);
    const r = await inspectTask(task.id, { inspectorId, checks, notes });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.value.passed) toast.success(`Room ${room?.number} passed`, 'The room is ready for guests.'); else toast.info(`Room ${room?.number} failed inspection`, 'Sent back for re-cleaning.');
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={`Inspect room ${room?.number}`} description="Untick anything that does not meet standard."
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button variant={passed ? 'primary' : 'danger'} onClick={submit} loading={busy}>{passed ? 'Pass inspection' : 'Fail inspection'}</Button></>}>
      <div className="space-y-4">
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {backendMode ? <p className="rounded bg-ivory px-3 py-2 text-body text-slate">The signed-in supervisor is recorded as inspector.</p> : <Select label="Inspector" value={inspectorId} onChange={(e) => setInspectorId(e.target.value)} options={inspectors.map((p) => ({ value: p.id, label: `${p.name} — ${p.title}` }))} />}
        <fieldset className="space-y-2"><legend className="sr-only">Checklist</legend>
          {INSPECTION_CHECKLIST.map((item, i) => (
            <label key={item} className="flex items-center gap-2 text-body"><input type="checkbox" className="h-4 w-4 accent-forest" checked={checks[i]} onChange={(e) => setChecks(checks.map((c, j) => (j === i ? e.target.checked : c)))} />{item}</label>
          ))}
        </fieldset>
        <Textarea label={passed ? 'Notes (optional)' : 'What needs fixing?'} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}
