import { Card } from './Card';

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-meta font-medium text-slate">{label}</p>
      <p className="mt-1.5 font-heading text-[26px] font-semibold leading-8 tnum">{value}</p>
      {hint && <p className="mt-1 text-meta text-slate">{hint}</p>}
    </Card>
  );
}
