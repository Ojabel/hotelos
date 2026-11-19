import { Suspense, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toaster } from '@/components/ui/Toaster';
import { canAccess, landingPageForRole } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';
import { useAdminStore } from '@/store/useAdminStore';
import { setCurrency, setDateFormat } from '@/utils/format';
import AccessDenied from '@/pages/AccessDenied';
import { ApiClientError } from '@/services/api/client';
import { backendMode, localApiToken, setBackendHotels } from '@/services/api/backendMode';
import { hotelOperationsApi } from '@/services/api/hotelOperations';
import { loadHotelOperations } from '@/services/backendOperations';

export function AppShell() {
  const session = useAppStore((s) => s.session);
  const hotelId = useAppStore((s) => s.hotelId);
  const setHotelId = useAppStore((s) => s.setHotelId);
  const [backendStatus, setBackendStatus] = useState<{ loading: boolean; error: string }>({ loading: false, error: '' });
  const settings = useAdminStore((s) => s.settings);
  const permissions = useAdminStore((s) => s.permissions);
  const roleActive = useAdminStore((s) => s.roleActive);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { setCurrency(settings.regional.currency); setDateFormat(settings.regional.dateFormat); }, [settings.regional.currency, settings.regional.dateFormat]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (!backendMode || !session) return;
    let active = true;
    const load = async () => {
      setBackendStatus({ loading: true, error: '' });
      try {
        const hotels = await hotelOperationsApi.listHotels();
        if (!active) return;
        setBackendHotels(hotels);
        const selected = hotels.some((hotel) => hotel.id === hotelId) ? hotelId : hotels[0]?.id;
        if (!selected) throw new Error('This account has no accessible hotels. Ask an administrator to grant hotel access.');
        if (selected !== hotelId) setHotelId(selected);
        await loadHotelOperations(selected);
        if (active) setBackendStatus({ loading: false, error: '' });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiClientError && error.status === 401) {
          localApiToken.clear();
          setBackendStatus({ loading: false, error: 'Your backend session expired. Sign in again with a fresh local development token.' });
        } else setBackendStatus({ loading: false, error: error instanceof Error ? error.message : 'Unable to load hotel data.' });
      }
    };
    void load();
    return () => { active = false; };
  }, [session, hotelId, setHotelId]);

  useEffect(() => {
    const onExpired = () => setBackendStatus({ loading: false, error: 'Your backend session expired. Sign in again with a fresh local development token.' });
    window.addEventListener('hotelos-api-session-expired', onExpired);
    return () => window.removeEventListener('hotelos-api-session-expired', onExpired);
  }, []);

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  void permissions; void roleActive;
  if (!canAccess(session.role, location.pathname)) {
    if (location.pathname === '/dashboard') {
      const landing = landingPageForRole(session.role);
      if (landing) return <Navigate to={landing} replace />;
    }
    return <div className="min-h-screen bg-ivory p-6"><AccessDenied /></div>;
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded focus:bg-forest focus:px-3 focus:py-2 focus:text-ivory">Skip to content</a>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main" className="flex-1 px-3 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-64 w-full" /></div>}>
          {backendMode && backendStatus.loading ? <div className="rounded border border-line bg-white p-6 text-body text-slate" role="status">Loading saved hotel data from PostgreSQL…</div>
            : backendMode && backendStatus.error ? <div className="rounded border border-danger/30 bg-danger/5 p-5 text-body text-danger" role="alert"><p className="font-medium">Backend data is unavailable</p><p className="mt-1">{backendStatus.error}</p><p className="mt-2 text-meta">Mock records are not being shown in backend mode.</p></div>
              : <Outlet />}
          </Suspense>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
