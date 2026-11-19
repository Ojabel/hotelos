import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }>(function Textarea({ label, className, id, ...rest }, ref) {
  const auto = useId();
  const tid = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={tid} className="block text-meta font-medium">{label}</label>
      <textarea ref={ref} id={tid} rows={3} className={cn('w-full rounded border border-line bg-white px-3 py-2 text-body placeholder:text-slate/70 focus:border-champagne', className)} {...rest} />
    </div>
  );
});
