import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, options, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className={cn('block text-meta font-medium text-forest', hideLabel && 'sr-only')}>{label}</label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn('h-10 w-full appearance-none rounded border border-line bg-white pl-3 pr-9 text-body text-forest focus:border-champagne', className)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden />
      </div>
    </div>
  );
});
