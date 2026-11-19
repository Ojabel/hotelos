import { useMemo, useState } from 'react';
import { Copy, Plus, Shield, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { permissionsForAppRole, useAdminStore, ADMIN_ROLES, MODULES, ACTIONS } from '@/store/useAdminStore';
import { useHotelStore } from '@/store/useHotelStore';
import { useAppStore, toast } from '@/store/useAppStore';
import { appendAuditEntry } from '@/services/mockAuditLog';
import { ROLE_LABELS } from '@/types';

export default function AccessControl() {
  const permissions = useAdminStore((s) => s.permissions);
  const roleActive = useAdminStore((s) => s.roleActive);
  const staffRoles = useAdminStore((s) => s.staffRoles);
  const { updatePermissions, setRoleActive, setStaffRole, addRole, duplicateRole } = useAdminStore();
  const renameRole = useAdminStore((s) => s.renameRole);
  const staff = useHotelStore((s) => s.staff);
  const session = useAppStore((s) => s.session);
  const canManage = Boolean(session && permissionsForAppRole(session.role)['Access control']?.includes('Manage'));
  const [selected, setSelected] = useState('General Manager');
  const [query, setQuery] = useState('');
  const [newRole, setNewRole] = useState('');
  const [rename, setRename] = useState('');
  const roleNames = useMemo(() => [...new Set([...ADMIN_ROLES, ...Object.keys(permissions)])].filter((r) => r.toLowerCase().includes(query.trim().toLowerCase())), [permissions, query]);
  const selectedPermissions = permissions[selected] ?? {};

  const audit = (action: string, description: string) => appendAuditEntry({ user: session?.name ?? 'Demo administrator', role: session ? ROLE_LABELS[session.role] : 'General Manager', action, module: 'Administration', description, related: `ROLE-${selected.toUpperCase().replace(/ /g, '-')}`, status: 'Success' });
  const create = () => {
    if (!canManage) { toast.error('This demo role can view roles but cannot manage them.'); return; }
    const name = newRole.trim(); if (!name) return;
    if (roleNames.some((x) => x.toLowerCase() === name.toLowerCase()) || ADMIN_ROLES.some((x) => x.toLowerCase() === name.toLowerCase())) { toast.error('Role already exists'); return; }
    addRole(name); setSelected(name); setNewRole(''); audit('Role created', `${name} role created with no permissions by default.`); toast.success('Role created', 'Configure the permission matrix for this role.');
  };
  const duplicate = () => {
    if (!canManage) { toast.error('This demo role cannot manage role definitions.'); return; }
    const target = `${selected} copy`; duplicateRole(selected, target); setSelected(target); audit('Role duplicated', `${selected} permissions copied into ${target}.`); toast.success('Role duplicated', 'Review its permissions before assigning it.');
  };
  const toggle = (module: typeof MODULES[number], action: typeof ACTIONS[number], checked: boolean) => {
    if (!canManage) { toast.error('This demo role cannot change permissions.'); return; }
    updatePermissions(selected, module, action, checked);
    appendAuditEntry({ user: session?.name ?? 'Demo administrator', role: session ? ROLE_LABELS[session.role] : 'General Manager', action: 'Permission updated', module: 'Administration', description: `${action} permission ${checked ? 'enabled' : 'disabled'} for ${module} on ${selected}.`, related: `ROLE-${selected.toUpperCase().replace(/ /g, '-')}`, status: 'Success' });
  };

  return <>
    <PageHeader title="Roles and permissions" description="Configure demonstration roles, employee assignments and module actions. Frontend checks are for simulation only." actions={<Badge tone="warning"><Shield className="mr-1 h-3.5 w-3.5" aria-hidden />Demo access controls</Badge>} />
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-fit overflow-hidden"><CardHeader title="Role directory" action={<span className="text-meta text-slate">{roleNames.length} roles</span>} /><div className="space-y-3 p-4"><Input label="Search roles" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roles" /><ul className="max-h-[520px] space-y-1 overflow-auto">{roleNames.map((name) => <li key={name}><button type="button" onClick={() => { setSelected(name); setRename(name); }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded px-3 text-left text-body ${selected === name ? 'bg-forest text-white' : 'hover:bg-ivory'}`}><span className="truncate">{name}</span><span className={`h-2 w-2 rounded-full ${roleActive[name] === false ? 'bg-danger' : selected === name ? 'bg-champagne' : 'bg-success'}`} aria-label={roleActive[name] === false ? 'Inactive' : 'Active'} /></button></li>)}</ul>
        <div className="flex gap-2 border-t border-line pt-3"><Input label="New role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="e.g. Night Auditor" /><Button className="mt-6 shrink-0" disabled={!canManage} aria-label="Create role" onClick={create}><Plus className="h-4 w-4" aria-hidden />Create</Button></div></div></Card>

      <div className="min-w-0 space-y-5"><Card><CardHeader title={selected} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={!canManage} onClick={duplicate}><Copy className="h-4 w-4" aria-hidden />Duplicate</Button><Button variant={roleActive[selected] === false ? 'primary' : 'danger'} size="sm" disabled={!canManage} onClick={() => { const active = roleActive[selected] === false; setRoleActive(selected, active); audit('Role status changed', `${selected} role ${active ? 'activated' : 'deactivated'}.`); toast.success(active ? 'Role activated' : 'Role deactivated'); }}>{roleActive[selected] === false ? 'Activate role' : 'Deactivate role'}</Button></div>} />
        <div className="flex flex-wrap items-center gap-3 px-5 py-4"><Badge tone={roleActive[selected] === false ? 'danger' : 'success'}>{roleActive[selected] === false ? 'Inactive' : 'Active'}</Badge><p className="text-meta text-slate">{Object.values(selectedPermissions).flat().length} action grants configured. Changes are stored in this browser.</p></div>
        {!ADMIN_ROLES.includes(selected as typeof ADMIN_ROLES[number]) && <form className="flex flex-wrap items-end gap-2 px-5 pb-4" onSubmit={(e) => { e.preventDefault(); if (!canManage) { toast.error('This demo role cannot rename roles.'); return; } const target = rename.trim(); if (!target || target === selected || roleNames.some((x) => x.toLowerCase() === target.toLowerCase())) { toast.error('Choose a unique role name'); return; } renameRole(selected, target); audit('Role renamed', `${selected} renamed to ${target}.`); setSelected(target); setRename(target); toast.success('Role updated'); }}><div className="w-full max-w-sm"><Input label="Role name" value={rename || selected} onChange={(e) => setRename(e.target.value)} required /></div><Button type="submit" disabled={!canManage} variant="secondary">Save role name</Button></form>}
        <div className="border-t border-line"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-body"><caption className="sr-only">Permission matrix for {selected}</caption><thead className="bg-ivory/60 text-meta uppercase text-slate"><tr><th className="sticky left-0 z-10 bg-ivory px-4 py-3">Module</th>{ACTIONS.map((a) => <th key={a} className="px-3 py-3 text-center">{a}</th>)}</tr></thead><tbody className="divide-y divide-line">{MODULES.map((module) => <tr key={module} className="hover:bg-ivory/50"><th scope="row" className="sticky left-0 bg-white px-4 py-3 text-left font-medium">{module}</th>{ACTIONS.map((action) => { const enabled = selectedPermissions[module]?.includes(action) ?? false; return <td key={action} className="px-3 py-2 text-center"><input aria-label={`${action} ${module}`} type="checkbox" disabled={!canManage} checked={enabled} onChange={(e) => toggle(module, action, e.target.checked)} /></td>; })}</tr>)}</tbody></table></div><p className="px-5 py-3 text-meta text-slate">Use horizontal scroll to review all actions on smaller screens. Permission checkboxes can be reached with the keyboard.</p></div>
      </Card>

      <Card><CardHeader title="Assign roles to employees" action={<span className="text-meta text-slate">{staff.length} staff records</span>} /><div className="divide-y divide-line">{staff.map((person) => <div key={person.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_240px] sm:items-center"><div><p className="text-body font-medium">{person.name}</p><p className="text-meta text-slate">{person.title} · {person.department}</p></div><Select disabled={!canManage} label={`Role for ${person.name}`} hideLabel value={staffRoles[person.id] ?? (person.department === 'Front Desk' ? 'Front Desk Manager' : person.department === 'Housekeeping' ? 'Housekeeping Staff' : person.department === 'Restaurant' ? 'Restaurant Staff' : person.department === 'Finance' ? 'Accountant' : person.department === 'Maintenance' ? 'Maintenance Staff' : 'Staff Member')} onChange={(e) => { if (!canManage) { toast.error('This demo role cannot assign employee roles.'); return; } setStaffRole(person.id, e.target.value); audit('Employee role assigned', `${e.target.value} assigned to ${person.name}.`); toast.success('Role assignment updated'); }} options={roleNames.filter((r) => roleActive[r] !== false).map((r) => ({ value: r, label: r }))} /></div>)}</div></Card>
      </div>
    </div>
    <p className="mt-4 rounded border border-warning/30 bg-warning/5 p-3 text-meta text-slate"><ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden />This is a frontend access demonstration, not production authorization. A future backend must independently enforce every permission.</p>
  </>;
}
