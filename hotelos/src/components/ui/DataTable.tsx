import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'right';
  className?: string;
}

interface Props<T> {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Rendered instead of the table below the md breakpoint. */
  mobileCard?: (row: T) => ReactNode;
  empty?: ReactNode;
}

export function DataTable<T>({ caption, rows, columns, rowKey, onRowClick, pageSize = 10, initialSort, mobileCard, empty }: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const sv = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = sv(a), y = sv(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  if (rows.length === 0) return <>{empty}</>;

  return (
    <div>
      {mobileCard && <ul className="divide-y divide-line md:hidden">{visible.map((r) => <li key={rowKey(r)}>{mobileCard(r)}</li>)}</ul>}
      <div className={cn('overflow-x-auto', mobileCard && 'hidden md:block')}>
        <table className="w-full min-w-[640px] text-left text-body">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-ivory/60 text-meta uppercase tracking-wide text-slate">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('px-4 py-3 font-medium', c.align === 'right' && 'text-right', c.className)}>
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggle(c.key)} className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-forest', c.align === 'right' && 'flex-row-reverse')}>
                        {c.header}
                        {active ? (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />) : <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r); } : undefined}
                className={cn(onRowClick && 'cursor-pointer hover:bg-ivory/70')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle', c.align === 'right' && 'text-right tnum', c.className)}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={sorted.length} onChange={setPage} />
    </div>
  );
}
