import { useMemo, useState } from 'react';
import { Download, Eye, History, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAuditEntries, type AuditEntry } from '@/services/mockAuditLog';
import { toast, useAppStore } from '@/store/useAppStore';
import { permissionsForAppRole } from '@/store/useAdminStore';

function exportRows(rows: AuditEntry[]) {
  const heads = ['Reference', 'Date/time', 'User', 'Role', 'Action', 'Module', 'Description', 'Related record', 'Status'];
  const csv = [heads, ...rows.map((r) => [r.id, r.at, r.user, r.role, r.action, r.module, r.description, r.related, r.status])]
    .map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'hotelos-demo-activity.csv'; a.click(); URL.revokeObjectURL(url); toast.success('Activity export downloaded', 'This file contains local demonstration records.');
}

export default function AuditLogs() {
  const session = useAppStore((s) => s.session);
  const canExport = Boolean(session && permissionsForAppRole(session.role)['Audit logs']?.includes('Export'));
  const [entries] = useState(() => getAuditEntries());
  const [search, setSearch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [user, setUser] = useState('all');
  const [module, setModule] = useState('all');
  const [action, setAction] = useState('all');
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const users = useMemo(() => [...new Set(entries.map((x) => x.user))].sort(), [entries]);
  const modules = useMemo(() => [...new Set(entries.map((x) => x.module))].sort(), [entries]);
  const actions = useMemo(() => [...new Set(entries.map((x) => x.action))].sort(), [entries]);
  const filtered = useMemo(() => entries.filter((x) => {
    const term = search.toLowerCase(); const date = x.at.slice(0, 10);
    return (!term || [x.id, x.user, x.role, x.action, x.module, x.description, x.related].some((v) => v.toLowerCase().includes(term))) &&
      (!start || date >= start) && (!end || date <= end) && (user === 'all' || x.user === user) && (module === 'all' || x.module === module) && (action === 'all' || x.action === action);
  }), [entries, search, start, end, user, module, action]);
  const columns: Column<AuditEntry>[] = [
    { key: 'id', header: 'Reference', render: (r) => <span className="font-medium">{r.id}</span>, sortValue: (r) => r.id },
    { key: 'at', header: 'Date and time', render: (r) => <span>{new Date(r.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>, sortValue: (r) => r.at },
    { key: 'user', header: 'User', render: (r) => <span>{r.user}<span className="block text-meta text-slate">{r.role}</span></span>, sortValue: (r) => r.user },
    { key: 'action', header: 'Action', render: (r) => <span>{r.action}<span className="block text-meta text-slate">{r.module}</span></span>, sortValue: (r) => r.action },
    { key: 'description', header: 'Description', render: (r) => <span className="line-clamp-2 max-w-sm text-slate" title={r.description}>{r.description}</span>, sortValue: (r) => r.description },
    { key: 'related', header: 'Related record', render: (r) => r.related, sortValue: (r) => r.related },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Success' ? 'success' : r.status === 'Pending' ? 'warning' : 'danger'}>{r.status}</Badge> },
    { key: 'details', header: '', render: (r) => <Button aria-label={`View details for ${r.id}`} variant="ghost" size="icon" onClick={() => setSelected(r)}><Eye className="h-4 w-4" aria-hidden /></Button> },
  ];

  return <>
    <PageHeader title="Activity log" description="Search simulated hotel operations and administration activity." actions={<Button disabled={!canExport} onClick={() => exportRows(filtered)}><Download className="h-4 w-4" aria-hidden />Export CSV</Button>} />
    <Card className="mb-5 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div className="relative"><Input label="Search activity" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User, action, reference" /><Search className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-slate" aria-hidden /></div>
      <Input label="From" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <Input label="To" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={start && end && start > end ? 'End date must follow start date.' : undefined} />
      <Select label="User" value={user} onChange={(e) => setUser(e.target.value)} options={[{ value: 'all', label: 'All users' }, ...users.map((x) => ({ value: x, label: x }))]} />
      <Select label="Module" value={module} onChange={(e) => setModule(e.target.value)} options={[{ value: 'all', label: 'All modules' }, ...modules.map((x) => ({ value: x, label: x }))]} />
      <Select label="Action" value={action} onChange={(e) => setAction(e.target.value)} options={[{ value: 'all', label: 'All actions' }, ...actions.map((x) => ({ value: x, label: x }))]} />
    </div></Card>
    <Card><CardHeader title="Activity records" action={<span className="text-meta text-slate">{filtered.length} matching records</span>} /><DataTable caption="Audit activity records" rows={start && end && start > end ? [] : filtered} rowKey={(r) => r.id} columns={columns} pageSize={10} mobileCard={(r) => <button type="button" onClick={() => setSelected(r)} className="w-full p-4 text-left hover:bg-ivory"><span className="flex items-center justify-between gap-3"><span className="font-medium">{r.action}</span><Badge tone={r.status === 'Success' ? 'success' : r.status === 'Pending' ? 'warning' : 'danger'}>{r.status}</Badge></span><span className="mt-1 block text-meta text-slate">{r.user} · {r.module} · {new Date(r.at).toLocaleString('en-GB')}</span><span className="mt-1 block text-meta">{r.description}</span></button>} empty={<div className="p-8"><EmptyState icon={History} title="No activity matches these filters" description="Try a wider date range or clear one of the filters." /></div>} /></Card>
    <p className="mt-3 text-meta text-slate">These are local demonstration entries. They are editable browser data and are not secure, immutable, or production audit records.</p>
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} title="Activity details" description={selected?.id}>
      {selected && <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[['User', selected.user], ['Role', selected.role], ['Action', selected.action], ['Module', selected.module], ['Date and time', new Date(selected.at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })], ['Related record', selected.related], ['Status', selected.status], ['Description', selected.description]].map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-meta text-slate">{k}</dt><dd className="break-words text-body font-medium">{v}</dd></div>)}</dl>}
    </Dialog>
  </>;
}
