import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import ComingSoon from '@/pages/ComingSoon';
import NotFound from '@/pages/NotFound';
import Login from '@/pages/auth/Login';
import AcceptInvitation from '@/pages/auth/AcceptInvitation';
import { ROUTES } from '@/routes/nav';
import { pageRegistry } from '@/routes/pageRegistry';
import { GuestRoute } from '@/pages/guest/GuestRoute';
import { GuestSite } from '@/pages/guest/GuestSite';
import { GuestPortal } from '@/pages/guest/GuestPortal';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<AppShell />}>
        {ROUTES.map((r) => {
          const Page = pageRegistry[r.path] ?? ComingSoon;
          return <Route key={r.path} path={r.path} element={<Page />} />;
        })}
      </Route>

      <Route element={<GuestRoute />}>
        <Route path="/guest-site" element={<GuestSite />} />
        <Route path="/guest-site/rooms" element={<GuestSite />} />
        <Route path="/guest-site/rooms/:id" element={<GuestSite />} />
        <Route path="/guest-site/checkout" element={<GuestSite />} />
        <Route path="/guest-site/confirmation" element={<GuestSite />} />
        <Route element={<GuestPortal />}>
          <Route path="/guest-portal" element={<GuestPortal />} />
          <Route path="/guest-portal/reservations" element={<GuestPortal />} />
          <Route path="/guest-portal/profile" element={<GuestPortal />} />
          <Route path="/guest-portal/services" element={<GuestPortal />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
