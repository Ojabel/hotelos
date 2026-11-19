import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-meta text-slate tnum">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
        <span className="text-meta tnum">Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight className="h-4 w-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}
