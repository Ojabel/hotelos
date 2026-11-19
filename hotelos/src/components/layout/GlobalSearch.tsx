import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { mockGuests } from '@/data/mockGuests';
import { mockReservations } from '@/data/mockReservations';
import { mockRooms } from '@/data/mockRooms';
import { navForRole } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';

interface Result { key: string; label: string; sub: string; to: string; kind: 'Page' | 'Guest' | 'Reservation' | 'Room' }

export function GlobalSearch() {
  const role = useAppStore((s) => s.session?.role ?? 'general_manager');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const pages: Result[] = navForRole(role).flatMap((g) => g.items)
      .filter((i) => i.label.toLowerCase().includes(term))
      .map((i) => ({ key: i.path, label: i.label, sub: 'Go to page', to: i.path, kind: 'Page' as const }));
    const guests: Result[] = mockGuests
      .filter((g) => g.fullName.toLowerCase().includes(term) || g.email.includes(term))
      .map((g) => ({ key: g.id, label: g.fullName, sub: g.email, to: `/guests/${g.id}`, kind: 'Guest' as const }));
    const reservations: Result[] = mockReservations
      .filter((r) => r.reference.toLowerCase().includes(term))
      .map((r) => ({ key: r.id, label: r.reference, sub: mockGuests.find((g) => g.id === r.guestId)?.fullName ?? '', to: `/reservations/${r.id}`, kind: 'Reservation' as const }));
    const rooms: Result[] = mockRooms
      .filter((r) => r.number.toLowerCase() === term || `room ${r.number.toLowerCase()}` === term)
      .map((r) => ({ key: r.id, label: `Room ${r.number}`, sub: `Floor ${r.floor}`, to: `/rooms/${r.id}`, kind: 'Room' as const }));
    return [...pages, ...rooms, ...reservations, ...guests].slice(0, 8);
  }, [q, role]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (r: Result) => { navigate(r.to); setOpen(false); setQ(''); };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) go(results[active]);
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <label htmlFor="global-search" className="sr-only">Search guests, reservations, rooms and pages</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden />
      <input
        id="global-search"
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        autoComplete="off"
        value={q}
        placeholder="Search guests, bookings, rooms…"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded border border-line bg-white pl-9 pr-3 text-body placeholder:text-slate/70 focus:border-champagne"
      />
      {open && q.trim().length >= 2 && (
        <ul id="global-search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-lg border border-line bg-white py-1 shadow-pop">
          {results.length === 0 && <li className="px-4 py-3 text-body text-slate">No results for “{q}”.</li>}
          {results.map((r, i) => (
            <li key={r.kind + r.key} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left ${i === active ? 'bg-ivory' : ''}`}>
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium">{r.label}</span>
                  <span className="block truncate text-meta text-slate">{r.sub}</span>
                </span>
                <span className="shrink-0 text-meta text-slate">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
