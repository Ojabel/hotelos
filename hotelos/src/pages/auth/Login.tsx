import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { canAccess, landingPageForRole } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';
import { AuthLayout } from './AuthLayout';
import { localApiToken, localDevAuthEnabled, setBackendHotels } from '@/services/api/backendMode';
import { apiClient } from '@/services/api/client';
import { hotelOperationsApi } from '@/services/api/hotelOperations';
import { firebaseConfigured, firebaseIdentity } from '@/services/auth/firebase';
import { useAuth } from '@/services/auth/AuthProvider';

export default function Login() {
  const session = useAppStore((state) => state.session);
  const doLogin = useAppStore((state) => state.login);
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [devToken, setDevToken] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session && !firebaseUser && !localApiToken.get()) useAppStore.getState().logout();
  }, [session, firebaseUser]);

  if (session && (firebaseUser || localApiToken.get())) return <Navigate to={canAccess(session.role, from) ? from : landingPageForRole(session.role) ?? '/login'} replace />;

  const finishBackendSignIn = async (subject: string, userEmail: string) => {
    const hotels = await hotelOperationsApi.listHotels();
    if (!hotels.length) throw new Error('This account has no active hotel access. Use the invitation link or contact your administrator.');
    setBackendHotels(hotels);
    const next = { name: subject, email: userEmail, role: 'general_manager' as const, remember: true };
    doLogin(next);
    navigate(from, { replace: true });
  };

  const onFirebaseSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFormError('');
    try {
      const credential = await firebaseIdentity.signInEmail(email, password);
      if (!credential.user.emailVerified) {
        await firebaseIdentity.sendVerification(credential.user);
        throw new Error('Verify your email using the link we just sent, then sign in again.');
      }
      const identity = await apiClient.request<{ subject: string; email?: string; emailVerified: boolean; authenticationProvider?: string }>('/api/v1/auth/me');
      if (identity.authenticationProvider !== 'password') throw new Error('Hotel staff must sign in with email and password.');
      await finishBackendSignIn(identity.subject, identity.email ?? email.trim().toLowerCase());
    } catch (error) {
      await firebaseIdentity.signOut();
      setFormError(error instanceof Error ? error.message : 'Sign-in failed. Check your credentials and try again.');
    } finally { setLoading(false); }
  };

  const onDevelopmentSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!localDevAuthEnabled) return;
    setLoading(true);
    setFormError('');
    localApiToken.set(devToken.trim());
    try {
      const identity = await apiClient.request<{ subject: string; email?: string }>('/api/v1/auth/me');
      await finishBackendSignIn(identity.subject, identity.email ?? 'Local development identity');
    } catch (error) {
      localApiToken.clear();
      setFormError(error instanceof Error ? error.message : 'Local backend sign-in failed.');
    } finally { setLoading(false); }
  };

  return <AuthLayout title="Staff sign in" subtitle="Use your HotelOS staff account to continue.">
    {firebaseConfigured ? <form onSubmit={onFirebaseSignIn} noValidate className="space-y-4">
      {formError && <div role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-body text-danger">{formError}</div>}
      <Input label="Work email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
      <p className="text-meta text-slate">Staff access requires an active invitation and a verified email address. Staff accounts do not use Google sign-in.</p>
    </form> : <div className="rounded border border-warning/30 bg-warning/10 p-4 text-body">Firebase is not configured yet. Add the Firebase web app values to the frontend environment. Local development-token access is available below when explicitly enabled.</div>}
    {localDevAuthEnabled && <details className="mt-6 border-t border-line pt-4"><summary className="cursor-pointer text-meta font-medium">Local development sign-in</summary><form onSubmit={onDevelopmentSignIn} className="mt-4 space-y-3"><label htmlFor="local-dev-token" className="block text-meta font-medium">Short-lived backend token</label><textarea id="local-dev-token" value={devToken} onChange={(event) => setDevToken(event.target.value)} rows={3} autoComplete="off" spellCheck={false} className="block w-full rounded border border-line bg-white px-3 py-2 font-mono text-meta" />{formError && <p role="alert" className="text-meta text-danger">{formError}</p>}<Button type="submit" variant="secondary" loading={loading}>Connect with development token</Button></form></details>}
  </AuthLayout>;
}
