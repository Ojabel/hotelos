import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function SegmentedControl<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: ReactNode }>;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded border border-line bg-white p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-meta font-medium', value === o.value ? 'bg-forest text-ivory' : 'text-slate hover:text-forest')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}
