import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, LogOut, Menu, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ROLE_LABELS } from '@/types';
import { today } from '@/utils/demoClock';
import { formatDate } from '@/utils/format';
import { Breadcrumbs } from './Breadcrumbs';
import { GlobalSearch } from './GlobalSearch';
import { Popover } from '@/components/ui/Popover';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import { localApiToken, useBackendHotels } from '@/services/api/backendMode';

const iconBtn = 'relative inline-flex h-10 w-10 items-center justify-center rounded text-forest hover:bg-forest/5';

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const navigate = useNavigate();
  const { session, logout, sidebarCollapsed, toggleSidebar, hotelId, setHotelId, notifications, markRead, markAllRead } = useAppStore();
  const backendHotels = useBackendHotels();
  const unread = notifications.filter((n) => !n.read).length;
  const initials = (session?.name ?? 'HO').split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ivory/95 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-3 sm:px-6">
        <button type="button" onClick={onOpenMobileNav} aria-label="Open navigation" className={cn(iconBtn, 'lg:hidden')}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn(iconBtn, 'hidden lg:inline-flex')}>
          {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1 lg:flex-none"><Breadcrumbs /></div>
        <div className="ml-auto hidden flex-1 justify-center px-4 md:flex"><GlobalSearch /></div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <div className="hidden items-center gap-1.5 px-2 text-meta text-slate xl:flex" title="Current date">
            <CalendarDays className="h-4 w-4" aria-hidden />
            <span className="tnum">{formatDate(today())}</span>
          </div>

          <Popover
            ariaLabel="Notifications"
            triggerClassName={iconBtn}
            trigger={<>
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-champagne px-1 text-[10px] font-semibold text-forest">{unread}</span>}
            </>}
            panelClassName="w-[min(22rem,calc(100vw-1.5rem))]"
          >
            {(close) => (
              <div>
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="text-card font-semibold">Notifications</h2>
                  <button type="button" onClick={markAllRead} disabled={unread === 0} className="text-meta font-medium text-info hover:underline disabled:text-slate disabled:no-underline">Mark all read</button>
                </div>
                <ul className="max-h-96 divide-y divide-line overflow-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => { markRead(n.id); if (n.to) navigate(n.to); close(); }} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-ivory', !n.read && 'bg-champagne/10')}>
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-champagne')} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-body font-medium">{n.title}</span>
                            <span className="shrink-0 text-meta text-slate">{n.time}</span>
                          </span>
                          <span className="block text-meta text-slate">{n.body}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Popover>

          <Popover
            ariaLabel="Account menu"
            triggerClassName="flex h-10 items-center gap-2 rounded pl-1 pr-2 hover:bg-forest/5"
            trigger={<>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-meta font-semibold text-champagne">{initials}</span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-meta font-medium">{session?.name}</span>
                <span className="block text-[11px] text-slate">{session ? ROLE_LABELS[session.role] : ''}</span>
              </span>
            </>}
            panelClassName="w-72 p-3"
          >
            {(close) => (
              <div className="space-y-3">
                <div>
                  <p className="text-body font-medium">{session?.name}</p>
                  <p className="truncate text-meta text-slate">{session?.email}</p>
                  <div className="mt-2"><Badge tone="champagne">Backend session</Badge></div>
                </div>
                <Select
                  label="Property"
                  value={hotelId}
                  onChange={(e) => setHotelId(e.target.value)}
                  options={backendHotels.map((h) => ({ value: h.id, label: h.name }))}
                />
                <div className="border-t border-line pt-2">
                  <button type="button" onClick={() => { close(); navigate('/profile'); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-body hover:bg-ivory"><User className="h-4 w-4" aria-hidden />User profile</button>
                  <button type="button" onClick={() => { close(); localApiToken.clear(); logout(); navigate('/login'); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-body hover:bg-ivory"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
                </div>
              </div>
            )}
          </Popover>
        </div>
      </div>
      <div className="px-3 pb-3 md:hidden"><GlobalSearch /></div>
    </header>
  );
}
