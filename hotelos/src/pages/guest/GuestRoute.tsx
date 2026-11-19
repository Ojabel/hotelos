import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { demoGuestLogin } from '@/services/mockAuthService';
import { useGuestPortalStore } from '@/services/mockGuestPortalService';
import { useHotelStore } from '@/store/useHotelStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { GuestSiteHeader } from './GuestSiteHeader';
import { GuestFooter } from './GuestFooter';
import { setCurrency } from '@/utils/format';
import { useAdminStore } from '@/store/useAdminStore';
import { backendMode } from '@/services/api/backendMode';
import { FirebaseGuestRoute } from './FirebaseGuestRoute';

export function GuestRoute() {
  return backendMode ? <FirebaseGuestRoute /> : <DemoGuestRoute />;
}

function DemoGuestRoute() {
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/guest-portal');
  const selectedId = useGuestPortalStore((s) => s.selectedGuestId);
  const selectGuest = useGuestPortalStore((s) => s.selectGuest);
  const guests = useHotelStore((s) => s.guests);
  const currency = useAdminStore((s) => s.settings.regional.currency);
  const navigate = useNavigate();
  const [demoId, setDemoId] = useState('g-001');
  useEffect(() => setCurrency(currency), [currency]);
  if (isPortal && !selectedId) return <GuestAccess onEnter={async () => { try { await demoGuestLogin(demoId); selectGuest(demoId); navigate('/guest-portal'); } catch { /* guest choices are always local seed data */ } }} demoId={demoId} onSelect={setDemoId} />;
  const guest = guests.find((g) => g.id === selectedId);
  if (isPortal && !guest) { selectGuest(null); return <Navigate to="/guest-portal" replace />; }
  return <><GuestSiteHeader portal={isPortal} guestName={guest?.fullName} onGuestLogout={() => { selectGuest(null); navigate('/guest-site'); }} /><Outlet /><GuestFooter /></>;
}

function GuestAccess({ onEnter, demoId, onSelect }: { onEnter: () => void; demoId: string; onSelect: (id: string) => void }) {
  const guests = useHotelStore((s) => s.guests);
  return <div className="min-h-screen bg-ivory"><GuestSiteHeader /><main className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:px-8"><div><p className="guest-eyebrow">A more personal stay</p><h1 className="mt-4 max-w-xl font-heading text-4xl font-medium leading-tight text-forest sm:text-5xl">Your stay, thoughtfully looked after.</h1><p className="mt-4 max-w-lg text-lg leading-8 text-slate">Choose a demonstration guest to explore reservations, preferences and hotel services.</p></div><section className="rounded border border-line bg-white p-6 shadow-sm sm:p-8"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-ivory text-forest"><KeyRound className="h-5 w-5" aria-hidden /></span><h2 className="mt-5 font-heading text-2xl font-medium">Guest demo access</h2><p className="mt-2 text-body leading-6 text-slate">This local demonstration does not verify identity or protect real guest records.</p><div className="mt-6 space-y-4"><Select label="Explore as guest" value={demoId} onChange={(e) => onSelect(e.target.value)} options={guests.map((g) => ({ value: g.id, label: `${g.fullName} · ${g.email}` }))} /><Button className="w-full" onClick={onEnter}>Continue to guest portal <ArrowRight className="h-4 w-4" aria-hidden /></Button><p className="text-meta text-slate">For demo use only. Guest records are scoped in this interface.</p></div></section></main><GuestFooter /></div>;
}
