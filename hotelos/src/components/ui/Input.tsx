import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, trailing, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-meta font-medium text-forest">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded border bg-white px-3 text-body text-forest placeholder:text-slate/70 focus:border-champagne',
            error ? 'border-danger' : 'border-line',
            trailing && 'pr-10',
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-meta text-danger">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-meta text-slate">{hint}</p>
      ) : null}
    </div>
  );
});
