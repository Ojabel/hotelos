import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ApiClientError } from '@/services/api/client';
import { guestApi, type GuestProfile, type GuestReservation, type GuestServiceRequest } from '@/services/api/guest';
import { firebaseConfigured, firebaseIdentity, type FirebaseUser } from '@/services/auth/firebase';
import { GuestSiteHeader } from './GuestSiteHeader';
import { GuestFooter } from './GuestFooter';
import { Button } from '@/components/ui/Button';

function expireGuestSession() { void firebaseIdentity.signOut(); }

export function FirebaseGuestRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPortal = location.pathname.startsWith('/guest-portal');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [registrationName, setRegistrationName] = useState('');

  const loadGuest = useCallback(async (current: FirebaseUser, resolve = false) => {
    setBusy(true); setMessage('');
    try {
      if (!current.emailVerified) { setProfile(null); setMessage('Verify your email before opening guest reservations or profile information.'); return; }
      let result: GuestProfile;
      try { result = await guestApi.me(); }
      catch (error) {
        if (!resolve || !(error instanceof ApiClientError) || error.status !== 404) throw error;
        result = await guestApi.resolve(current.displayName || registrationName || current.email?.split('@')[0] || 'Hotel guest');
      }
      setProfile(result);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) setMessage('An existing hotel guest record needs staff-assisted identity verification. Contact the hotel before creating or linking another profile.');
      else if (error instanceof ApiClientError && error.status === 401) setMessage('Your session expired. Sign in again.');
      else setMessage(error instanceof Error ? error.message : 'Guest account could not be loaded.');
      setProfile(null);
    } finally { setBusy(false); }
  }, [registrationName]);

  useEffect(() => firebaseIdentity.subscribe((current) => {
    setUser(current);
    setProfile(null);
    if (current?.emailVerified) void loadGuest(current, true);
    else if (current) setMessage('Check your inbox and verify your email to continue.');
    else setMessage('');
  }), [loadGuest]);

  async function authenticate(kind: 'email' | 'google', email?: string, password?: string) {
    setBusy(true); setMessage('');
    try {
      const result = kind === 'google' ? await firebaseIdentity.signInGoogle() : await firebaseIdentity.signInEmail(email!, password!);
      setUser(result.user);
      if (!result.user.emailVerified) { setMessage('Verify your email before opening your guest information.'); return; }
      await loadGuest(result.user, true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    setBusy(true); setMessage('');
    try {
      if (mode === 'reset') {
        try { await firebaseIdentity.sendPasswordReset(email); } catch { /* Keep Firebase account existence private. */ }
        setMessage('If an account exists for that address, password reset instructions have been sent.');
      } else if (mode === 'register') {
        if (password !== String(data.get('confirmPassword') ?? '')) throw new Error('Passwords do not match.');
        const name = String(data.get('fullName') ?? '').trim();
        if (!name) throw new Error('Enter your name.');
        setRegistrationName(name);
        const result = await firebaseIdentity.registerEmail(email, password);
        await firebaseIdentity.sendVerification(result.user);
        setUser(result.user);
        setMode('login');
        setMessage('Your account is created. Use the verification link in your email, then return here and choose “I verified my email”.');
      } else await authenticate('email', email, password);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  }

  async function verifyAndContinue() {
    setBusy(true); setMessage('');
    try {
      const current = await firebaseIdentity.reloadCurrentUser();
      if (!current?.emailVerified) { setMessage('Email verification has not been confirmed yet.'); return; }
      setUser(current);
      await loadGuest(current, true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not refresh account status.'); }
    finally { setBusy(false); }
  }

  async function logout() { await firebaseIdentity.signOut(); setProfile(null); setUser(null); navigate('/guest-site'); }

  if (isPortal && (!profile || !user)) return <>
    <GuestSiteHeader />
    <main className="mx-auto min-h-[70vh] max-w-xl px-5 py-14">
      <p className="guest-eyebrow">Secure guest access</p><h1 className="mt-2 font-heading text-4xl">Your stay, thoughtfully looked after.</h1>
      {!firebaseConfigured ? <p className="mt-5 rounded bg-warning/10 p-4 text-sm">Firebase Authentication is not configured. Set the VITE_FIREBASE_* values to enable guest access.</p> : null}
      {user && !user.emailVerified ? <section className="mt-6 rounded border border-line bg-white p-6"><h2 className="font-heading text-xl">Verify your email</h2><p className="mt-2 text-sm text-slate">Guest records stay locked until Firebase confirms your email address.</p><Button className="mt-4" disabled={busy} onClick={verifyAndContinue}>I verified my email</Button><Button className="ml-2 mt-4" variant="secondary" disabled={busy} onClick={() => user && firebaseIdentity.sendVerification(user)}>Resend verification</Button></section> : null}
      {profile ? <p className="mt-5 text-sm">Guest profile loaded. <Link className="underline" to="/guest-portal">Continue</Link></p> : null}
      {!profile && (!user || user.emailVerified) && firebaseConfigured ? <>
        <div className="mt-6 flex gap-2">{(['login', 'register', 'reset'] as const).map((item) => <button className={`rounded px-3 py-2 text-sm ${mode === item ? 'bg-forest text-white' : 'bg-white'}`} key={item} onClick={() => { setMode(item); setMessage(''); }}>{item === 'login' ? 'Sign in' : item === 'register' ? 'Create account' : 'Reset password'}</button>)}</div>
        <form className="mt-4 space-y-4 rounded border border-line bg-white p-6" onSubmit={submit}>
          {mode === 'register' ? <label className="block text-sm">Full name<input name="fullName" autoComplete="name" required className="mt-1 block w-full rounded border border-line p-3" /></label> : null}
          <label className="block text-sm">Email<input name="email" type="email" autoComplete="email" required className="mt-1 block w-full rounded border border-line p-3" /></label>
          {mode !== 'reset' ? <label className="block text-sm">Password<input name="password" type="password" minLength={8} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required className="mt-1 block w-full rounded border border-line p-3" /></label> : null}
          {mode === 'register' ? <label className="block text-sm">Confirm password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required className="mt-1 block w-full rounded border border-line p-3" /></label> : null}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create guest account' : mode === 'reset' ? 'Send reset instructions' : 'Sign in'}</Button>
        </form>
        {mode !== 'reset' ? <Button className="mt-3 w-full" variant="secondary" disabled={busy} onClick={() => void authenticate('google')}>Continue with Google</Button> : null}
      </> : null}
      {message ? <p role="status" className="mt-4 rounded bg-ivory p-3 text-sm">{message}</p> : null}
      {busy ? <p className="mt-3 text-sm text-slate">Checking your secure guest session…</p> : null}
    </main><GuestFooter />
  </>;

  if (!isPortal) return <><GuestSiteHeader /><Outlet /><GuestFooter /></>;
  if (!profile) return null;
  return <><GuestSiteHeader portal guestName={profile.fullName} onGuestLogout={() => void logout()} /><GuestBackendPortal profile={profile} onProfile={setProfile} onSessionExpired={expireGuestSession} /><GuestFooter /></>;
}

function GuestBackendPortal({ profile, onProfile, onSessionExpired }: { profile: GuestProfile; onProfile: (profile: GuestProfile | null) => void; onSessionExpired: () => void }) {
  const location = useLocation();
  const [reservations, setReservations] = useState<GuestReservation[]>([]);
  const [requests, setRequests] = useState<GuestServiceRequest[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const handleFailure = useCallback((error: unknown, fallback: string) => { setNote(error instanceof Error ? error.message : fallback); if (error instanceof ApiClientError && error.status === 401) { onProfile(null); onSessionExpired(); } }, [onProfile, onSessionExpired]);
  useEffect(() => { void guestApi.reservations().then(setReservations).catch((error) => handleFailure(error, 'Could not load reservations.')); void guestApi.requests().then(setRequests).catch((error) => handleFailure(error, 'Could not load service requests.')); }, [handleFailure]);
  async function cancel(id: string) { setBusy(true); try { await guestApi.cancel(id); setReservations(await guestApi.reservations()); setNote('Reservation cancelled.'); } catch (error) { handleFailure(error, 'Could not cancel reservation.'); } finally { setBusy(false); } }
  async function saveProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { onProfile(await guestApi.update({ fullName: String(form.get('fullName')), phone: String(form.get('phone')), preferences: String(form.get('preferences')).split(',').map((item) => item.trim()).filter(Boolean) })); setNote('Profile updated.'); } catch (error) { handleFailure(error, 'Profile update failed.'); } finally { setBusy(false); } }
  async function requestService(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { await guestApi.createRequest({ hotelId: profile.hotel.id, category: String(form.get('category')), description: String(form.get('description')) }); setRequests(await guestApi.requests()); event.currentTarget.reset(); setNote('Your request was sent to the hotel.'); } catch (error) { handleFailure(error, 'Request failed.'); } finally { setBusy(false); } }
  const title = location.pathname.endsWith('/reservations') ? 'My reservations' : location.pathname.endsWith('/profile') ? 'My profile' : location.pathname.endsWith('/services') ? 'Hotel services' : 'Your guest space';
  return <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-10"><p className="guest-eyebrow">{profile.hotel.name}</p><h1 className="mt-2 font-heading text-4xl">{title}</h1><nav className="mt-5 flex flex-wrap gap-4 text-sm"><Link to="/guest-portal">Overview</Link><Link to="/guest-portal/reservations">Reservations</Link><Link to="/guest-portal/profile">Profile</Link><Link to="/guest-portal/services">Services</Link></nav>
    {note ? <p role="status" className="mt-5 rounded bg-ivory p-3 text-sm">{note}</p> : null}
    {location.pathname.endsWith('/profile') ? <form className="mt-6 max-w-xl space-y-4 rounded border border-line bg-white p-6" onSubmit={saveProfile}><label className="block text-sm">Full name<input name="fullName" defaultValue={profile.fullName} required className="mt-1 block w-full rounded border border-line p-3" /></label><label className="block text-sm">Phone<input name="phone" defaultValue={profile.phone ?? ''} className="mt-1 block w-full rounded border border-line p-3" /></label><label className="block text-sm">Preferences (comma separated)<input name="preferences" defaultValue={profile.preferences.join(', ')} className="mt-1 block w-full rounded border border-line p-3" /></label><p className="text-sm text-slate">{profile.email}</p><Button type="submit" disabled={busy}>Save profile</Button></form> : null}
    {location.pathname.endsWith('/services') ? <><form className="mt-6 max-w-xl space-y-4 rounded border border-line bg-white p-6" onSubmit={requestService}><label className="block text-sm">Service<select name="category" className="mt-1 block w-full rounded border border-line p-3"><option>Housekeeping</option><option>Room service</option><option>Extra towels</option><option>Maintenance assistance</option><option>Concierge</option></select></label><label className="block text-sm">Describe your request<textarea name="description" minLength={5} maxLength={1000} required className="mt-1 block w-full rounded border border-line p-3" /></label><Button type="submit" disabled={busy}>Send request</Button></form><ul className="mt-6 space-y-3">{requests.map((item) => <li key={item.id} className="rounded border border-line bg-white p-4"><strong>{item.category}</strong><p className="mt-1 text-sm">{item.description}</p><p className="text-xs text-slate">{item.status}</p></li>)}</ul></> : null}
    {location.pathname.endsWith('/reservations') || location.pathname === '/guest-portal' ? <section className="mt-6 space-y-3">{reservations.length ? reservations.map((item) => <article key={item.id} className="rounded border border-line bg-white p-5"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="font-heading text-xl">{item.category.name} · Room {item.room.number}</h2><p className="mt-1 text-sm">{item.reference} · {item.status}</p><p className="mt-1 text-sm text-slate">{new Date(item.checkIn).toLocaleDateString()} – {new Date(item.checkOut).toLocaleDateString()}</p></div>{['PENDING', 'CONFIRMED'].includes(item.status) ? <Button variant="secondary" disabled={busy} onClick={() => void cancel(item.id)}>Cancel reservation</Button> : null}</div></article>) : <p className="rounded border border-line bg-white p-6 text-sm">No reservations are linked to this guest account yet.</p>}</section> : null}
  </main>;
}
