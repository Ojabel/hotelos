import { cn } from '@/utils/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#C4A574" />
      <path d="M9 23V9h3.2v5.4h7.6V9H23v14h-3.2v-5.8h-7.6V23z" fill="#17251F" />
    </svg>
  );
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && <span className="font-heading text-xl font-semibold tracking-tight">HotelOS</span>}
    </div>
  );
}
