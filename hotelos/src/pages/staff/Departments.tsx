import { Card } from '@/components/ui/Card';
import { hotelShortName } from '@/data/mockHotels';
import { useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import { formatCurrency } from '@/utils/format';
import { FINANCIAL_ROLES } from '@/routes/nav';
import { DEPARTMENTS, StaffShell } from './StaffShell';

const LEAD = /(manager|head|supervisor|chief)/i;

export default function Departments() {
  const hotelId = useAppStore((s) => s.hotelId);
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const all = useHotelStore((s) => s.staff);
  const staff = all.filter((p) => hotelId === 'all' || p.hotelId === hotelId);

  return (
    <StaffShell title="Departments" description="Headcount and payroll by team">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((d) => {
          const members = staff.filter((p) => p.department === d && p.status !== 'inactive');
          const head = members.find((p) => LEAD.test(p.title));
          return (
            <Card key={d} className="p-5">
              <div className="flex items-start justify-between gap-2"><h2 className="text-card font-semibold">{d}</h2><span className="rounded-full bg-ivory px-2.5 py-0.5 text-meta font-medium tnum">{members.length}</span></div>
              <p className="mt-1 text-body text-slate">{head ? `Led by ${head.name}` : members.length ? 'No team lead' : 'No staff in this view'}</p>
              {canViewFinancials && <><p className="mt-3 text-meta text-slate">Monthly salary bill</p><p className="font-heading text-section font-semibold tnum">{formatCurrency(members.reduce((s, p) => s + p.monthlySalary, 0))}</p></>}
              <ul className="mt-3 divide-y divide-line border-t border-line">{members.map((p) => <li key={p.id} className="flex items-center justify-between py-2 text-body"><span>{p.name}<span className="block text-meta text-slate">{p.title}</span></span><span className="text-right text-meta text-slate">{hotelShortName(p.hotelId)}{p.status === 'on_leave' && <span className="block text-warning">On leave</span>}</span></li>)}</ul>
            </Card>
          );
        })}
      </div>
    </StaffShell>
  );
}
