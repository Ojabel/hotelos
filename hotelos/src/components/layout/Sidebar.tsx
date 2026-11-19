import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { activeNavPath, navForRole } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';
import { useAdminStore } from '@/store/useAdminStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const role = useAppStore((s) => s.session?.role ?? 'general_manager');
  const permissions = useAdminStore((s) => s.permissions);
  const roleActive = useAdminStore((s) => s.roleActive);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const compact = collapsed && isDesktop;
  void permissions; void roleActive;
  const groups = navForRole(role);
  const { pathname } = useLocation();
  const activePath = activeNavPath(pathname);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);

  const showTip = (label: string, el: HTMLElement) => {
    if (compact) setTip({ label, top: el.getBoundingClientRect().top + el.offsetHeight / 2 });
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-forest/60 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        aria-label="Primary"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-forest text-ivory transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          compact ? 'w-[72px]' : 'w-72 lg:w-64',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', compact ? 'justify-center' : 'justify-between px-5')}>
          <Logo compact={compact} className="text-ivory" />
          {!compact && (
            <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded p-1.5 text-ivory/70 hover:bg-white/10 lg:hidden">
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" onScroll={() => setTip(null)}>
          {groups.map((g) => {
            const open = !closedGroups[g.id];
            return (
              <div key={g.id} className={cn(compact ? 'border-b border-white/10 py-2 first:pt-0' : 'mb-1 px-3')}>
                {!compact && (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setClosedGroups((c) => ({ ...c, [g.id]: open }))}
                    className="flex w-full items-center justify-between rounded px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-champagne/90 hover:text-champagne"
                  >
                    {g.label}
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} aria-hidden />
                  </button>
                )}
                {(open || compact) && (
                  <ul className={cn(compact ? 'flex flex-col items-center gap-1' : 'space-y-0.5')}>
                    {g.items.map((item) => {
                      const active = item.path === activePath;
                      const Icon = item.icon;
                      return (
                        <li key={item.path} className={compact ? undefined : 'w-full'}>
                          <Link
                            to={item.path}
                            onClick={onClose}
                            aria-current={active ? 'page' : undefined}
                            aria-label={compact ? item.label : undefined}
                            onMouseEnter={(e) => showTip(item.label, e.currentTarget)}
                            onMouseLeave={() => setTip(null)}
                            onFocus={(e) => showTip(item.label, e.currentTarget)}
                            onBlur={() => setTip(null)}
                            className={cn(
                              'relative flex items-center rounded text-body transition-colors',
                              compact ? 'h-10 w-10 justify-center' : 'gap-3 px-3 py-2',
                              active ? 'bg-deep font-medium text-white' : 'text-ivory/75 hover:bg-white/5 hover:text-white',
                            )}
                          >
                            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-champagne" aria-hidden />}
                            <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-champagne')} aria-hidden />
                            {!compact && <span className="truncate">{item.label}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      {compact && tip && (
        <div role="tooltip" style={{ top: tip.top }} className="pointer-events-none fixed left-[80px] z-[70] -translate-y-1/2 whitespace-nowrap rounded bg-forest px-2.5 py-1.5 text-meta font-medium text-white shadow-pop">
          {tip.label}
        </div>
      )}
    </>
  );
}
