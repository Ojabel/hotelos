import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PopoverProps {
  ariaLabel: string;
  trigger: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}

export function Popover({ ariaLabel, trigger, triggerClassName, panelClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div role="dialog" aria-label={ariaLabel} className={cn('absolute right-0 top-full z-50 mt-2 rounded-lg border border-line bg-white shadow-pop', panelClassName)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
