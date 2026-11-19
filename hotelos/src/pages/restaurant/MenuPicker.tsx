import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useHotelStore } from '@/store/useHotelStore';
import type { MenuCategory } from '@/types';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { FINANCIAL_ROLES } from '@/routes/nav';

const CATS: MenuCategory[] = ['Starters', 'Mains', 'Desserts', 'Beverages'];

/** Quantities keyed by menu item id. Unavailable items are listed but cannot be added. */
export function MenuPicker({ quantities, onChange }: { quantities: Record<string, number>; onChange: (q: Record<string, number>) => void }) {
  const role = useAppStore((s) => s.session?.role);
  const canViewFinancials = Boolean(role && FINANCIAL_ROLES.includes(role));
  const menu = useHotelStore((s) => s.menu);
  const [cat, setCat] = useState<MenuCategory>('Mains');
  const set = (id: string, qty: number) => onChange({ ...quantities, [id]: Math.max(0, qty) });
  const total = menu.reduce((s, m) => s + (quantities[m.id] ?? 0) * m.price, 0);
  const count = Object.values(quantities).reduce((s, q) => s + q, 0);

  return (
    <div>
      <div role="tablist" aria-label="Menu categories" className="flex gap-1 overflow-x-auto">
        {CATS.map((c) => <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn('rounded-full px-3 py-1.5 text-meta font-medium', cat === c ? 'bg-forest text-ivory' : 'bg-ivory text-slate hover:text-forest')}>{c}</button>)}
      </div>
      <ul className="mt-3 divide-y divide-line rounded border border-line">
        {menu.filter((m) => m.category === cat).map((m) => {
          const q = quantities[m.id] ?? 0;
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0"><p className={cn('truncate text-body font-medium', !m.available && 'text-slate line-through')}>{m.name}</p><p className="text-meta text-slate tnum">{m.available ? canViewFinancials ? formatCurrency(m.price) : 'Available' : 'Unavailable'}</p></div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Remove one ${m.name}`} disabled={q === 0} onClick={() => set(m.id, q - 1)} className="flex h-8 w-8 items-center justify-center rounded border border-line disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden /></button>
                <span className="w-6 text-center text-body tnum" aria-live="polite">{q}</span>
                <button type="button" aria-label={`Add one ${m.name}`} disabled={!m.available} onClick={() => set(m.id, q + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-line disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden /></button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex justify-between text-body"><span className="text-slate">{count} item{count === 1 ? '' : 's'}</span>{canViewFinancials && <span className="font-semibold tnum">{formatCurrency(total)}</span>}</p>
    </div>
  );
}

export const toLines = (q: Record<string, number>) => Object.entries(q).filter(([, n]) => n > 0).map(([menuItemId, qty]) => ({ menuItemId, qty }));
