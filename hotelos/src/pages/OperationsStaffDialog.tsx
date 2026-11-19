import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { backendOperations } from '@/services/backendOperations';
import type { OperationsStaffCandidateRecord } from '@/services/api/hotelOperations';
import { toast } from '@/store/useAppStore';

export function OperationsStaffDialog({ hotelId, area, onClose }: { hotelId: string; area: 'housekeeping' | 'maintenance'; onClose: () => void }) {
  const [staff, setStaff] = useState<OperationsStaffCandidateRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    backendOperations.operationsStaffCandidates(hotelId, area).then((rows) => {
      if (!active) return;
      setStaff(rows);
      setSelected(rows[0]?.userId ?? '');
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load organization staff.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [hotelId, area]);

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    const result = await backendOperations.addOperationsStaff(hotelId, area, selected);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast.success(`${area === 'housekeeping' ? 'Housekeeping' : 'Maintenance'} staff added`, staff.find((item) => item.userId === selected)?.name);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} size="sm" title={`Add ${area === 'housekeeping' ? 'housekeeping' : 'maintenance'} staff`} description="This grants the matching least-privilege role at the selected hotel." footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={add} loading={busy} disabled={!selected || loading}>Add staff</Button></>}>
      <div className="space-y-4">
        {loading && <p role="status" className="text-body text-slate">Loading active organization members…</p>}
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{error}</div>}
        {!loading && !error && staff.length === 0 && <p className="text-body text-slate">No unassigned active organization members are available. Invite and activate a staff member first.</p>}
        {!loading && staff.length > 0 && <Select label="Organization member" value={selected} onChange={(event) => setSelected(event.target.value)} options={staff.map((item) => ({ value: item.userId, label: `${item.name}${item.roleNames.length ? ` — ${item.roleNames.join(', ')}` : ''}` }))} />}
      </div>
    </Dialog>
  );
}
