import { useId, type KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';

export function Tabs({ tabs, value, onChange, label }: { tabs: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void; label: string }) {
  const base = useId();
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    document.getElementById(`${base}-${next.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          id={`${base}-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-body font-medium', value === t.id ? 'border-champagne text-forest' : 'border-transparent text-slate hover:text-forest')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
