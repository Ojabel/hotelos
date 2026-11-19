import type { ReactNode } from 'react';

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-meta text-slate">{label}</dt>
      <dd className="mt-0.5 text-body font-medium">{children}</dd>
    </div>
  );
}
