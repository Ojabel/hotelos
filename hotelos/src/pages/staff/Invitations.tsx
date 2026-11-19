import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { MailPlus, RotateCw, UserRoundX } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invitationApi, type InvitationRecord, type OrganizationRole } from '@/services/api/invitations';
import { ApiClientError } from '@/services/api/client';
import { toast } from '@/store/useAppStore';
import { formatDate } from '@/utils/format';

function safeError(error: unknown) {
  return error instanceof ApiClientError ? error.message : 'Could not complete the invitation request.';
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACCEPTED' || status === 'DELIVERED') return 'success';
  if (status === 'PENDING' || status === 'NOT_SENT') return 'warning';
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
  return 'neutral';
}

export default function Invitations() {
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revoke, setRevoke] = useState<InvitationRecord | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [outbox, setOutbox] = useState<Array<{ to: string; subject: string; text: string; createdAt: string }>>([]);

  const reload = useCallback(async () => {
    const [rows, availableRoles] = await Promise.all([invitationApi.list(), invitationApi.roles()]);
    setInvitations(rows);
    setRoles(availableRoles.filter((role) => !role.hotelId && role.name.toLowerCase() !== 'owner'));
    try { setOutbox(await invitationApi.outbox()); } catch { setOutbox([]); }
  }, []);
  useEffect(() => { void reload().catch((reason: unknown) => setError(safeError(reason))); }, [reload]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId), [roles, roleId]);
  const review = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selectedRole) return setError('Select an organization role you are permitted to delegate.');
    setReviewOpen(true);
  };

  const create = async () => {
    if (!selectedRole) return;
    setBusy(true);
    try {
      const result = await invitationApi.create(email.trim().toLowerCase(), [selectedRole.id]);
      setReviewOpen(false);
      if (result.deliveryStatus === 'DELIVERED') toast.success('Invitation email delivered', email);
      else if (result.deliveryStatus === 'NOT_SENT') toast.error('Invitation captured locally; no email was sent', 'Configure SMTP delivery before inviting staff outside local development.');
      else toast.error('Invitation created, but email delivery failed', 'Use resend after checking the configured provider.');
      setEmail('');
      await reload();
    } catch (reason) { setError(safeError(reason)); }
    finally { setBusy(false); }
  };

  const resend = async (item: InvitationRecord) => {
    setBusy(true);
    try {
      const result = await invitationApi.resend(item.id);
      if (result.deliveryStatus === 'DELIVERED') toast.success('Invitation email delivered', item.email);
      else if (result.deliveryStatus === 'NOT_SENT') toast.error('Invitation captured locally; no email was sent', 'Configure SMTP delivery before inviting staff outside local development.');
      else toast.error('Email delivery failed', 'Check mail configuration, then try again.');
      await reload();
    }
    catch (reason) { setError(safeError(reason)); }
    finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!revoke) return;
    setBusy(true);
    try { await invitationApi.cancel(revoke.id); setRevoke(null); toast.success('Invitation revoked'); await reload(); }
    catch (reason) { setError(safeError(reason)); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeader title="Staff invitations" description="Invite staff using an authorized organization role. The server enforces delegation and invitation expiry." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
      <Card><CardHeader title="Invite a staff member" /><form onSubmit={review} className="space-y-4 p-5">
        <Input label="Work email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Select label="Organization role" value={roleId} onChange={(event) => setRoleId(event.target.value)} options={[{ value: '', label: 'Select a role' }, ...roles.map((role) => ({ value: role.id, label: role.name }))]} />
        <p className="text-meta leading-5 text-slate">Owner and hotel-scoped roles are excluded. You can assign an active member to housekeeping or maintenance at a hotel after they accept.</p>
        {error && <p role="alert" className="rounded bg-danger/5 p-3 text-meta text-danger">{error}</p>}
        <Button type="submit" disabled={!email.trim() || !roleId}><MailPlus className="h-4 w-4" aria-hidden />Review invitation</Button>
      </form></Card>

      <Card><CardHeader title="Local mail capture" /><div className="space-y-3 p-5"><p className="text-meta leading-5 text-slate">Captured invitations are available here for development only. Capturing a message does not send an email; delivery status changes to delivered only after the SMTP provider accepts it.</p>{outbox.length ? outbox.slice(0, 6).map((mail) => <details key={`${mail.to}-${mail.createdAt}`} className="rounded border border-line p-3"><summary className="cursor-pointer text-meta font-medium">{mail.to} · {formatDate(mail.createdAt, false)}</summary><pre className="mt-3 whitespace-pre-wrap break-all text-xs leading-5 text-slate">{mail.text}</pre></details>) : <p className="text-meta text-slate">No captured messages.</p>}</div></Card>
    </div>

    <Card className="mt-6"><CardHeader title="Invitation history" action={<Button size="sm" variant="secondary" onClick={() => void reload().catch((reason: unknown) => setError(safeError(reason)))}><RotateCw className="h-4 w-4" aria-hidden />Refresh</Button>} />
      {invitations.length ? <div className="divide-y divide-line">{invitations.map((item) => <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div className="min-w-0"><p className="truncate font-medium">{item.email}</p><p className="mt-1 text-meta text-slate">{item.roles.map(({ role }) => role.name).join(', ') || 'No role'} · Invited by {item.invitedBy.email ?? 'administrator'} · Expires {formatDate(item.expiresAt, false)}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={statusTone(item.status)}>{item.status}</Badge><Badge tone={statusTone(item.deliveryStatus)}>Email {item.deliveryStatus === 'NOT_SENT' ? 'not sent' : item.deliveryStatus.toLowerCase()}</Badge>{item.acceptedAt && <span className="text-meta text-slate">Accepted {formatDate(item.acceptedAt, false)}</span>}{item.deliveryError && <span className="text-meta text-danger">{item.deliveryError === 'local_capture_only' ? 'Message captured locally only' : 'Delivery unavailable'}</span>}</div></div><div className="flex flex-wrap gap-2">{item.status === 'PENDING' && <><Button size="sm" variant="secondary" disabled={busy} onClick={() => void resend(item)}><RotateCw className="h-4 w-4" aria-hidden />Resend</Button><Button size="sm" variant="danger" disabled={busy} onClick={() => setRevoke(item)}><UserRoundX className="h-4 w-4" aria-hidden />Revoke</Button></>}</div></div>)}</div> : <p className="p-5 text-body text-slate">No invitations have been created.</p>}
    </Card>
    <ConfirmDialog open={reviewOpen} title="Send this staff invitation?" confirmLabel="Send invitation" loading={busy} onClose={() => setReviewOpen(false)} onConfirm={() => void create()}>
      <span className="block">{email.trim().toLowerCase()} will be invited as <strong>{selectedRole?.name}</strong>. The invitation expires in seven days.</span>
    </ConfirmDialog>
    <ConfirmDialog open={Boolean(revoke)} title="Revoke this invitation?" danger confirmLabel="Revoke invitation" loading={busy} onClose={() => setRevoke(null)} onConfirm={() => void cancel()}>{revoke?.email} will no longer be able to accept this invitation.</ConfirmDialog>
  </>;
}
