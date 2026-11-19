import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthLayout } from './AuthLayout';
import { firebaseConfigured, firebaseIdentity } from '@/services/auth/firebase';
import { useAuth } from '@/services/auth/AuthProvider';
import { invitationApi } from '@/services/api/invitations';
import { apiClient } from '@/services/api/client';
import { hotelOperationsApi } from '@/services/api/hotelOperations';
import { setBackendHotels } from '@/services/api/backendMode';
import { useAppStore } from '@/store/useAppStore';

type Invitation = { status: string; email?: string; expiresAt?: string; roles?: string[] };

export default function AcceptInvitation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const doLogin = useAppStore((state) => state.login);
  const token = useState(() => new URLSearchParams(location.search).get('token') ?? '')[0];
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { navigate('/accept-invitation', { replace: true }); }, [navigate]);
  useEffect(() => {
    if (!token) return;
    void invitationApi.validate(token).then((result) => {
      setInvitation(result);
      if (result.email) setEmail(result.email);
    }).catch(() => setInvitation({ status: 'INVALID' }));
  }, [token]);

  const completeAcceptance = async () => {
    if (!firebaseUser) throw new Error('Sign in with the invited work email first.');
    await firebaseUser.reload();
    if (!firebaseUser.emailVerified) {
      setMessage('Verify your email using the link in your inbox, then select Continue.');
      return;
    }
    if (firebaseUser.email?.trim().toLowerCase() !== invitation?.email?.trim().toLowerCase()) {
      throw new Error('Sign in with the exact email address named in this invitation.');
    }
    const identity = await apiClient.request<{ subject: string; email?: string; authenticationProvider?: string }>('/api/v1/auth/me');
    if (identity.authenticationProvider !== 'password') throw new Error('Staff invitations require email and password sign-in.');
    await invitationApi.accept(token);
    const hotels = await hotelOperationsApi.listHotels();
    if (!hotels.length) throw new Error('Membership was activated, but hotel access has not been assigned. Contact your administrator.');
    setBackendHotels(hotels);
    doLogin({ name: identity.subject, email: identity.email ?? firebaseUser.email ?? email, role: 'general_manager', remember: true });
    navigate('/dashboard', { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'register') {
        if (email.trim().toLowerCase() !== invitation?.email?.trim().toLowerCase()) throw new Error('Use the exact email address that received the invitation.');
        const credential = await firebaseIdentity.registerEmail(email, password);
        await firebaseIdentity.sendVerification(credential.user);
        setMessage('Account created. Follow the email verification link, return here, and continue.');
      } else {
        await firebaseIdentity.signInEmail(email, password);
        await completeAcceptance();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The invitation could not be accepted.'); }
    finally { setBusy(false); }
  };

  const continueAfterVerification = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await completeAcceptance(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The invitation could not be accepted.'); }
    finally { setBusy(false); }
  };

  if (!token) return <AuthLayout title="Invitation unavailable" subtitle="This invitation link is missing its secure token."><p role="alert" className="text-body text-danger">Ask your HotelOS administrator to resend the invitation.</p></AuthLayout>;
  if (!invitation) return <AuthLayout title="Checking invitation" subtitle="Validating the invitation with HotelOS."><p role="status" className="text-body text-slate">Please wait…</p></AuthLayout>;
  if (invitation.status !== 'PENDING') return <AuthLayout title="Invitation unavailable" subtitle="This invitation cannot be accepted."><p role="alert" className="text-body text-danger">This invitation is {invitation.status.toLowerCase()}. Ask the administrator to send a new invitation.</p></AuthLayout>;
  if (!firebaseConfigured) return <AuthLayout title="Authentication unavailable" subtitle="Firebase is not configured for this application."><p role="alert" className="text-body text-danger">Contact the administrator. No invitation was accepted.</p></AuthLayout>;

  return <AuthLayout title={mode === 'signin' ? 'Accept your staff invitation' : 'Create your staff account'} subtitle={`Invited as ${invitation.roles?.join(', ') || 'HotelOS staff'} · ${invitation.email}`}>
    {firebaseUser?.emailVerified ? <div className="space-y-4"><p className="text-body">Verified as {firebaseUser.email}. Continue to activate the assigned membership.</p><Button className="w-full" loading={busy} onClick={() => void continueAfterVerification()}>Accept invitation</Button></div> : <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded bg-danger/5 p-3 text-meta text-danger">{error}</p>}
      {message && <p role="status" className="rounded bg-forest/5 p-3 text-meta text-forest">{message}</p>}
      <Input label="Invited email" type="email" autoComplete="email" value={email} readOnly />
      <Input label="Password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
      <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === 'register' ? 'Create account and verify email' : 'Sign in and continue'}</Button>
      {mode === 'signin' ? <button type="button" className="text-meta font-medium text-forest underline" onClick={() => setMode('register')}>New to HotelOS? Create an account from this invitation</button> : <button type="button" className="text-meta font-medium text-forest underline" onClick={() => setMode('signin')}>Already have an account? Sign in</button>}
    </form>}
    {firebaseUser && !firebaseUser.emailVerified && <Button variant="secondary" className="mt-4 w-full" loading={busy} onClick={() => void continueAfterVerification()}>I verified my email — continue</Button>}
  </AuthLayout>;
}
