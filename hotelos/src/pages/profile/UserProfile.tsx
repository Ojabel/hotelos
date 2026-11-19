import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ROLE_LABELS } from '@/types';
import { useAppStore, toast } from '@/store/useAppStore';

export default function UserProfile() {
  const session = useAppStore((state) => state.session);
  const login = useAppStore((state) => state.login);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();
  const [name, setName] = useState(session?.name ?? '');
  const [saved, setSaved] = useState(false);

  if (!session) return null;

  const initials = (session.name.trim() || session.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    login({ ...session, name: cleanName });
    setSaved(true);
    toast.success('Profile updated', 'Your display name is saved for this session.');
  };
  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return <>
    <PageHeader title="User profile" description="Manage your account details and review your current access." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <Card>
        <CardHeader title="Personal details" />
        <div className="flex items-center gap-4 border-b border-line p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-forest font-heading text-xl font-semibold text-champagne" aria-hidden>{initials || 'U'}</span>
          <div className="min-w-0"><p className="truncate font-heading text-xl font-medium">{session.name}</p><p className="truncate text-sm text-slate">{session.email}</p></div>
        </div>
        <form onSubmit={saveProfile} className="space-y-5 p-5">
          <Input label="Display name" name="name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} hint="This name is used in the current app session." />
          <Input label="Email address" type="email" value={session.email} readOnly disabled hint="Email is supplied by the signed-in identity and cannot be changed here." />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-meta text-slate">Changes to your display name are stored in this browser session.</p>
            <Button type="submit" disabled={!name.trim() || name.trim() === session.name}>{saved ? 'Saved' : 'Save changes'}</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Account access" />
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3"><span className="rounded bg-ivory p-2 text-forest"><ShieldCheck className="h-5 w-5" aria-hidden /></span><div><p className="text-meta text-slate">Your role</p><p className="mt-0.5 font-medium">{ROLE_LABELS[session.role]}</p></div></div>
            <div className="flex items-start gap-3"><span className="rounded bg-ivory p-2 text-forest"><BadgeCheck className="h-5 w-5" aria-hidden /></span><div><p className="text-meta text-slate">Sign-in method</p><p className="mt-0.5 font-medium">Backend identity token</p></div></div>
            <p className="border-t border-line pt-4 text-meta leading-5 text-slate">Your role controls which areas of HotelOS you can access. Contact an administrator to change account access.</p>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3"><span className="rounded bg-ivory p-2 text-forest"><UserRound className="h-5 w-5" aria-hidden /></span><div><h2 className="font-medium">Session</h2><p className="mt-1 text-meta leading-5 text-slate">Sign out of this HotelOS session on this device.</p></div></div>
          <Button variant="secondary" className="mt-5 w-full" onClick={signOut}><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
        </Card>
      </div>
    </div>
  </>;
}
