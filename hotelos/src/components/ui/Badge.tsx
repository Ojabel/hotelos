import type { ReactNode } from 'react';
import type { Tone } from '@/types';
import { cn } from '@/utils/cn';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate/10 text-slate',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  champagne: 'bg-champagne/20 text-forest',
};
const dots: Record<Tone, string> = {
  neutral: 'bg-slate', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', champagne: 'bg-champagne',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta font-medium', tones[tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden />
      {children}
    </span>
  );
}
