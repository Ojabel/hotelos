import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-forest p-12 text-ivory lg:flex">
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #C4A574 0, #C4A574 1px, transparent 1px, transparent 28px)' }} />
        <Logo className="relative" />
        <div className="relative max-w-md">
          <p className="font-heading text-[34px] font-medium leading-tight">Every arrival, every room, every detail — in one calm workspace.</p>
          <p className="mt-4 text-body text-ivory/70">Front desk, housekeeping, billing and restaurant operations for properties that put hospitality first.</p>
        </div>
        <p className="relative text-meta text-ivory/50">HotelOS operations platform</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 text-forest lg:hidden" />
          <h1 className="text-[26px] font-semibold leading-8">{title}</h1>
          <p className="mt-1.5 text-body text-slate">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
