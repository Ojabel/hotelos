import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { setShift } from '@/services/mockWorkforceService';
import { toast, useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { ShiftType } from '@/types';
import { addDays, today } from '@/utils/demoClock';
import { approvedLeaveOn, SHIFTS, weekStart } from '@/utils/workforce';
import { cn } from '@/utils/cn';
import { DEPARTMENTS, StaffShell } from './StaffShell';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHIP: Record<ShiftType, string> = { morning: 'bg-champagne/25 border-champagne/60', afternoon: 'bg-info/10 border-info/40', night: 'bg-forest/10 border-forest/40' };

export default function Shifts() {
  const t = today();
  const hotelId = useAppStore((s) => s.hotelId);
  const staff = useHotelStore((s) => s.staff);
  const roster = useHotelStore((s) => s.roster);
  const leave = useHotelStore((s) => s.leave);
  const [week, setWeek] = useState(weekStart(t));
  const [dept, setDept] = useState('all');

  const days = DAYS.map((label, i) => ({ label, date: addDays(week, i) }));
  const people = useMemo(() => staff.filter((p) => p.status !== 'inactive' && (hotelId === 'all' || p.hotelId === hotelId) && (dept === 'all' || p.department === dept)), [staff, hotelId, dept]);
  const at = (id: string, date: string) => roster.find((r) => r.staffId === id && r.date === date)?.shift;
  const coverage = (date: string, shift: ShiftType) => people.filter((p) => at(p.id, date) === shift).length;

  const change = async (id: string, date: string, value: string) => {
    const r = await setShift(id, date, value as ShiftType | 'off');
    if (!r.ok) toast.error('Shift not changed', r.error);
  };

  return (
    <StaffShell title="Shifts" description="Weekly roster. Choose a shift per day; rest and weekly-hours rules are enforced."
      actions={<><div className="w-48"><Select label="Department" hideLabel value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: 'all', label: 'All departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]} /></div>
        <Button variant="secondary" size="sm" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
        <Button variant="secondary" size="sm" onClick={() => setWeek(weekStart(t))}>This week</Button>
        <Button variant="secondary" size="sm" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="h-4 w-4" aria-hidden /></Button></>}>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-body">
            <caption className="sr-only">Weekly shift roster starting {week}</caption>
            <thead className="bg-ivory/60 text-meta uppercase tracking-wide text-slate">
              <tr><th scope="col" className="sticky left-0 z-10 bg-ivory px-4 py-3 font-medium">Employee</th>{days.map((d) => <th key={d.date} scope="col" className={cn('px-2 py-3 text-center font-medium', d.date === t && 'text-forest')}>{d.label} <span className="tnum">{Number(d.date.slice(8))}</span></th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {people.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-normal"><span className="block font-medium">{p.name}</span><span className="block text-meta text-slate">{p.title}</span></th>
                  {days.map((d) => {
                    const shift = at(p.id, d.date);
                    const onLeave = approvedLeaveOn(p.id, d.date, leave);
                    const past = d.date < t;
                    return (
                      <td key={d.date} className={cn('px-1.5 py-1.5', d.date === t && 'bg-champagne/10')}>
                        {onLeave ? <span className="block rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-center text-meta text-warning">Leave</span> : (
                          <select aria-label={`${p.name}, ${d.label} ${d.date.slice(8)}`} disabled={past} value={shift ?? 'off'} onChange={(e) => change(p.id, d.date, e.target.value)}
                            className={cn('h-9 w-full rounded border px-1.5 text-meta font-medium focus:border-champagne disabled:opacity-60', shift ? CHIP[shift] : 'border-line bg-white text-slate')}>
                            <option value="off">Off</option>
                            {(Object.keys(SHIFTS) as ShiftType[]).map((s) => <option key={s} value={s}>{SHIFTS[s].label}</option>)}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line bg-ivory/40 text-meta">
              {(Object.keys(SHIFTS) as ShiftType[]).map((s) => (
                <tr key={s}><th scope="row" className="sticky left-0 bg-ivory px-4 py-2 text-left font-medium text-slate">{SHIFTS[s].label} cover<span className="block font-normal">{SHIFTS[s].start}–{SHIFTS[s].end}</span></th>{days.map((d) => { const n = coverage(d.date, s); return <td key={d.date} className={cn('px-2 py-2 text-center tnum', n === 0 && 'text-danger')}>{n}</td>; })}</tr>
              ))}
            </tfoot>
          </table>
        </div>
      </Card>
    </StaffShell>
  );
}
