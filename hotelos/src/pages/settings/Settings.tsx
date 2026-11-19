import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Building2, CircleDollarSign, Clock3, Percent, Plus, Save, Settings2, BedDouble, Tag } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { permissionsForAppRole, useAdminStore, type HotelSettings } from '@/store/useAdminStore';
import { useAppStore, toast } from '@/store/useAppStore';
import { appendAuditEntry } from '@/services/mockAuditLog';
import { calculateConfiguredTotal } from '@/store/useAdminStore';

const sections = [
  { id: 'profile', label: 'Hotel profile', icon: Building2, path: '/settings' },
  { id: 'regional', label: 'Regional', icon: Clock3, path: '/settings/regional' },
  { id: 'tax', label: 'Tax and charges', icon: Percent, path: '/settings/tax' },
  { id: 'rooms', label: 'Rooms', icon: BedDouble, path: '/settings/rooms' },
  { id: 'pricing', label: 'Pricing', icon: Tag, path: '/settings/pricing' },
  { id: 'notifications', label: 'Notifications', icon: Bell, path: '/settings/notifications' },
  { id: 'general', label: 'General', icon: Settings2, path: '/settings/general' },
];
const timezones = ['Africa/Lagos', 'Africa/Accra', 'Europe/London', 'America/New_York', 'Asia/Dubai'];

export default function Settings() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = sections.find((x) => x.path === pathname)?.id ?? 'profile';
  const settings = useAdminStore((s) => s.settings);
  const updateSettings = useAdminStore((s) => s.updateSettings);
  const session = useAppStore((s) => s.session);
  const canEdit = Boolean(session && permissionsForAppRole(session.role).Settings?.includes('Edit'));
  const visibleSections = session?.role === 'accountant' ? sections.filter((item) => item.id === 'tax') : sections;
  const [newCategory, setNewCategory] = useState({ name: '', price: '', capacity: '2', bedConfiguration: '1 Queen bed' });
  const activeLabels = useMemo(() => visibleSections.map(({ id, label }) => ({ id, label })), [visibleSections]);
  const commit = (next: HotelSettings, title: string) => {
    if (!canEdit) { toast.error('This demo role can view settings but cannot edit them.'); return; }
    updateSettings(next);
    appendAuditEntry({ user: 'Blessing Ojo', role: 'General Manager', action: 'Hotel settings updated', module: 'Settings', description: `${title} configuration saved locally for this demonstration.`, related: `CFG-${section.toUpperCase()}`, status: 'Success' });
    toast.success('Settings saved', `${title} changes are stored in this browser.`);
  };
  const patch = <K extends keyof HotelSettings>(key: K, value: HotelSettings[K]) => { if (canEdit) updateSettings({ ...settings, [key]: value }); };
  const save = (title: string) => (event: React.FormEvent) => { event.preventDefault(); commit(settings, title); };

  return <>
    <PageHeader title="Hotel settings" description="Manage hotel configuration for this browser-based demonstration." actions={<Button disabled={!canEdit} title={!canEdit ? 'View only for this demo role' : undefined} onClick={() => commit(settings, sections.find((x) => x.id === section)?.label ?? 'Hotel')}><Save className="h-4 w-4" aria-hidden />Save changes</Button>} />
    <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="h-fit min-w-0 p-2"><nav aria-label="Settings categories" className="flex min-w-0 gap-1 overflow-x-auto lg:flex-col">{visibleSections.map(({ id, label, icon: Icon, path }) => <Link key={id} to={path} aria-current={id === section ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded px-3 py-2 text-body ${id === section ? 'bg-forest text-white' : 'text-slate hover:bg-ivory hover:text-forest'}`}><Icon className="h-4 w-4" aria-hidden />{label}</Link>)}</nav></Card>
      <div className="min-w-0">
        <div className="mb-4 lg:hidden"><Tabs label="Settings categories" tabs={activeLabels} value={section} onChange={(id) => { const target = sections.find((x) => x.id === id); if (target) navigate(target.path); }} /></div>
        {section === 'profile' && <Card><CardHeader title="Hotel profile" /><form onSubmit={save('Hotel profile')} className="grid gap-4 p-5 sm:grid-cols-2">
          <Input label="Hotel name" required value={settings.profile.name} onChange={(e) => patch('profile', { ...settings.profile, name: e.target.value })} />
          <Select label="Hotel type" value={settings.profile.type} onChange={(e) => patch('profile', { ...settings.profile, type: e.target.value })} options={['Boutique hotel', 'Business hotel', 'Resort', 'Serviced apartments', 'Guest house'].map((x) => ({ value: x, label: x }))} />
          <Input label="Contact email" type="email" required value={settings.profile.email} onChange={(e) => patch('profile', { ...settings.profile, email: e.target.value })} />
          <Input label="Phone number" type="tel" value={settings.profile.phone} onChange={(e) => patch('profile', { ...settings.profile, phone: e.target.value })} />
          <Input label="Website" type="url" value={settings.profile.website} onChange={(e) => patch('profile', { ...settings.profile, website: e.target.value })} />
          <Input label="Logo URL (optional)" type="url" value={settings.profile.logo} hint="Logo preview appears when a valid URL is supplied." onChange={(e) => patch('profile', { ...settings.profile, logo: e.target.value })} />
          <Input label="Street address" value={settings.profile.address} onChange={(e) => patch('profile', { ...settings.profile, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><Input label="City" value={settings.profile.city} onChange={(e) => patch('profile', { ...settings.profile, city: e.target.value })} /><Input label="Country" value={settings.profile.country} onChange={(e) => patch('profile', { ...settings.profile, country: e.target.value })} /></div>
          <Input label="Properties" type="number" min="1" value={settings.profile.properties} onChange={(e) => patch('profile', { ...settings.profile, properties: Math.max(1, Number(e.target.value)) })} />
          <div className="sm:col-span-2"><label className="mb-1.5 block text-meta font-medium">Hotel description</label><textarea value={settings.profile.description} onChange={(e) => patch('profile', { ...settings.profile, description: e.target.value })} rows={3} className="w-full rounded border border-line bg-white px-3 py-2 text-body focus:border-champagne" /></div>
          {settings.profile.logo && <img src={settings.profile.logo} alt="Hotel logo preview" className="h-16 w-16 rounded border border-line object-contain" />}
          <div className="sm:col-span-2"><Button type="submit" disabled={!canEdit}>Save hotel profile</Button></div>
        </form></Card>}

        {section === 'regional' && <Card><CardHeader title="Regional preferences" /><form onSubmit={save('Regional preferences')} className="grid gap-4 p-5 sm:grid-cols-2">
          <Select label="Default currency" value={settings.regional.currency} onChange={(e) => patch('regional', { ...settings.regional, currency: e.target.value })} options={['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'].map((x) => ({ value: x, label: x }))} />
          <Select label="Time zone" value={settings.regional.timezone} onChange={(e) => patch('regional', { ...settings.regional, timezone: e.target.value })} options={timezones.map((x) => ({ value: x, label: x }))} />
          <Select label="Date format" value={settings.regional.dateFormat} onChange={(e) => patch('regional', { ...settings.regional, dateFormat: e.target.value })} options={['dd MMM yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].map((x) => ({ value: x, label: x }))} />
          <Select label="Time format" value={settings.regional.timeFormat} onChange={(e) => patch('regional', { ...settings.regional, timeFormat: e.target.value })} options={['24-hour', '12-hour'].map((x) => ({ value: x, label: x }))} />
          <Select label="Language" value={settings.regional.language} onChange={(e) => patch('regional', { ...settings.regional, language: e.target.value })} options={['English', 'French', 'Portuguese'].map((x) => ({ value: x, label: x }))} />
          <div className="flex items-center gap-2 rounded bg-ivory p-3 text-body"><CircleDollarSign className="h-5 w-5 text-champagne" aria-hidden />Example: {new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings.regional.currency, maximumFractionDigits: 0 }).format(185000)}</div>
          <p className="text-meta text-slate sm:col-span-2">Regional preferences are saved locally. Existing historical payments and invoices remain unchanged.</p><div className="sm:col-span-2"><Button type="submit" disabled={!canEdit}>Save regional preferences</Button></div>
        </form></Card>}

        {section === 'tax' && <Card><CardHeader title="Tax and service charges" /><form onSubmit={save('Tax and service charges')} className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Tax name" required value={settings.tax.name} onChange={(e) => patch('tax', { ...settings.tax, name: e.target.value })} /><Input label="Tax percentage" type="number" min="0" max="100" step="0.1" value={settings.tax.percentage} onChange={(e) => patch('tax', { ...settings.tax, percentage: Number(e.target.value) })} error={settings.tax.percentage < 0 || settings.tax.percentage > 100 ? 'Enter a percentage from 0 to 100.' : undefined} /><Input label="Service charge (%)" type="number" min="0" max="100" step="0.1" value={settings.tax.serviceCharge} onChange={(e) => patch('tax', { ...settings.tax, serviceCharge: Number(e.target.value) })} /></div>
          <fieldset><legend className="mb-2 text-meta font-medium">Applicable services</legend><div className="flex flex-wrap gap-4">{['Room', 'Restaurant', 'Room service', 'Laundry', 'Other'].map((name) => <label key={name} className="inline-flex min-h-10 items-center gap-2 text-body"><input type="checkbox" checked={settings.tax.applicable.includes(name)} onChange={(e) => patch('tax', { ...settings.tax, applicable: e.target.checked ? [...settings.tax.applicable, name] : settings.tax.applicable.filter((x) => x !== name) })} />{name}</label>)}</div></fieldset>
          <label className="flex min-h-10 items-center gap-2 text-body"><input type="checkbox" checked={settings.tax.inclusive} onChange={(e) => patch('tax', { ...settings.tax, inclusive: e.target.checked })} />Prices include tax</label>
          <label className="flex min-h-10 items-center gap-2 text-body"><input type="checkbox" checked={settings.tax.active} onChange={(e) => patch('tax', { ...settings.tax, active: e.target.checked })} />Tax and service charges are active</label>
          <div className="rounded border border-line bg-ivory/70 p-4"><p className="text-meta font-medium">Pricing preview · ₦100,000 base amount</p><p className="mt-1 text-card font-semibold">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings.regional.currency, maximumFractionDigits: 0 }).format(calculateConfiguredTotal(100000, settings))}</p><p className="text-meta text-slate">Preview only. Historical folios and invoices are not recalculated.</p></div>
          <Button type="submit" disabled={!canEdit || settings.tax.percentage < 0 || settings.tax.percentage > 100 || settings.tax.serviceCharge < 0 || settings.tax.serviceCharge > 100}>Save tax settings</Button>
        </form></Card>}

        {section === 'rooms' && <Card><CardHeader title="Room categories and defaults" action={<span className="text-meta text-slate">Existing rooms keep their category IDs.</span>} /><div className="divide-y divide-line">{settings.roomCategories.map((c, i) => <div key={c.id} className="grid gap-3 p-4 sm:grid-cols-[1.3fr_1fr_110px_100px] sm:items-end"><Input label="Category name" value={c.name} onChange={(e) => patch('roomCategories', settings.roomCategories.map((x, n) => n === i ? { ...x, name: e.target.value } : x))} /><Input label="Base rate" type="number" min="0" value={c.basePrice} onChange={(e) => patch('roomCategories', settings.roomCategories.map((x, n) => n === i ? { ...x, basePrice: Math.max(0, Number(e.target.value)) } : x))} /><Input label="Capacity" type="number" min="1" value={c.capacity} onChange={(e) => patch('roomCategories', settings.roomCategories.map((x, n) => n === i ? { ...x, capacity: Math.max(1, Number(e.target.value)) } : x))} /><Button variant={c.active ? 'secondary' : 'ghost'} onClick={() => patch('roomCategories', settings.roomCategories.map((x, n) => n === i ? { ...x, active: !x.active } : x))}>{c.active ? 'Active' : 'Inactive'}</Button><Input label="Bed configuration" value={c.bedConfiguration} onChange={(e) => patch('roomCategories', settings.roomCategories.map((x, n) => n === i ? { ...x, bedConfiguration: e.target.value } : x))} /><Input label="Amenities (comma separated)" value={c.amenities.join(', ')} onChange={(e) => patch('roomCategories', settings.roomCategories.map((x, n) => n === i ? { ...x, amenities: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) } : x))} /></div>)}</div>
          <form className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (!newCategory.name.trim() || Number(newCategory.price) < 1) return; patch('roomCategories', [...settings.roomCategories, { id: `cat-custom-${Date.now()}`, name: newCategory.name.trim(), basePrice: Number(newCategory.price), capacity: Number(newCategory.capacity), bedConfiguration: newCategory.bedConfiguration, amenities: [], active: true }]); setNewCategory({ name: '', price: '', capacity: '2', bedConfiguration: '1 Queen bed' }); toast.success('Room category added'); }}><Input label="New category name" required value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} /><Input label="Base rate" type="number" min="1" required value={newCategory.price} onChange={(e) => setNewCategory({ ...newCategory, price: e.target.value })} /><Input label="Capacity" type="number" min="1" value={newCategory.capacity} onChange={(e) => setNewCategory({ ...newCategory, capacity: e.target.value })} /><Input label="Bed configuration" value={newCategory.bedConfiguration} onChange={(e) => setNewCategory({ ...newCategory, bedConfiguration: e.target.value })} /><Button type="submit" className="self-end"><Plus className="h-4 w-4" aria-hidden />Add category</Button></form>
          <p className="px-4 pb-4 text-meta text-slate">Room status options: Available, Reserved, Occupied, Dirty, Cleaning, Inspected, Maintenance, Out of service. Room types and amenities are stored as local configuration.</p>
        </Card>}

        {section === 'pricing' && <Card><CardHeader title="Rates and cancellation" /><form onSubmit={save('Pricing rules')} className="grid gap-4 p-5 sm:grid-cols-2">
          <Select label="Rate plan" value={settings.pricing.ratePlan} onChange={(e) => patch('pricing', { ...settings.pricing, ratePlan: e.target.value })} options={['Best available rate', 'Room only', 'Bed and breakfast', 'Corporate', 'Flexible'].map((x) => ({ value: x, label: x }))} />
          <Select label="Season" value={settings.pricing.season} onChange={(e) => patch('pricing', { ...settings.pricing, season: e.target.value })} options={['Low season', 'Shoulder season', 'Peak season', 'Festive'].map((x) => ({ value: x, label: x }))} />
          <Input label="Seasonal adjustment (%)" type="number" min="-100" max="500" value={settings.pricing.seasonalPercent} onChange={(e) => patch('pricing', { ...settings.pricing, seasonalPercent: Number(e.target.value) })} />
          <Input label="Weekend adjustment (%)" type="number" min="-100" max="500" value={settings.pricing.weekendPercent} onChange={(e) => patch('pricing', { ...settings.pricing, weekendPercent: Number(e.target.value) })} />
          <Input label="Additional guest charge" type="number" min="0" value={settings.pricing.additionalGuest} onChange={(e) => patch('pricing', { ...settings.pricing, additionalGuest: Math.max(0, Number(e.target.value)) })} />
          <Input label="Discount limit (%)" type="number" min="0" max="100" value={settings.pricing.discountPercent} onChange={(e) => patch('pricing', { ...settings.pricing, discountPercent: Math.max(0, Number(e.target.value)) })} />
          <Input label="Free cancellation window (hours)" type="number" min="0" value={settings.pricing.cancellationHours} onChange={(e) => patch('pricing', { ...settings.pricing, cancellationHours: Math.max(0, Number(e.target.value)) })} />
          <div className="rounded bg-ivory p-3"><p className="text-meta font-medium">Pricing preview</p><p className="mt-1 text-body">{settings.pricing.ratePlan} · {settings.pricing.season}</p><p className="text-card font-semibold">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: settings.regional.currency, maximumFractionDigits: 0 }).format(85000 * (1 + settings.pricing.seasonalPercent / 100))} / night</p></div>
          <div className="sm:col-span-2"><Button type="submit">Save pricing rules</Button></div>
        </form></Card>}

        {section === 'notifications' && <Card><CardHeader title="Notification preferences" action={<span className="text-meta text-slate">Local demo settings only</span>} /><div className="divide-y divide-line">{Object.entries(settings.notifications).map(([name, enabled]) => <label key={name} className="flex min-h-14 items-center justify-between gap-3 px-5"><span className="text-body font-medium">{name} notifications</span><input disabled={!canEdit} aria-label={`${name} notifications`} type="checkbox" checked={enabled} onChange={(e) => patch('notifications', { ...settings.notifications, [name]: e.target.checked })} /></label>)}</div><div className="border-t border-line p-5"><Button disabled={!canEdit} onClick={() => commit(settings, 'Notification preferences')}>Save notification preferences</Button><p className="mt-2 text-meta text-slate">No email, SMS, WhatsApp or push services are connected.</p></div></Card>}

        {section === 'general' && <Card><CardHeader title="General hotel preferences" /><form onSubmit={save('General preferences')} className="grid gap-4 p-5 sm:grid-cols-2">
          <Input label="Standard check-in" type="time" value={settings.preferences.checkInTime} onChange={(e) => patch('preferences', { ...settings.preferences, checkInTime: e.target.value })} /><Input label="Standard check-out" type="time" value={settings.preferences.checkOutTime} onChange={(e) => patch('preferences', { ...settings.preferences, checkOutTime: e.target.value })} />
          <Input label="Reservation hold (minutes)" type="number" min="0" value={settings.preferences.bookingHoldMinutes} onChange={(e) => patch('preferences', { ...settings.preferences, bookingHoldMinutes: Math.max(0, Number(e.target.value)) })} />
          <label className="flex min-h-10 items-center gap-2 text-body"><input type="checkbox" checked={settings.preferences.overbooking} onChange={(e) => patch('preferences', { ...settings.preferences, overbooking: e.target.checked })} />Allow overbooking in demo workflows</label>
          <label className="flex min-h-10 items-center gap-2 text-body"><input type="checkbox" checked={settings.preferences.guestIdRequired} onChange={(e) => patch('preferences', { ...settings.preferences, guestIdRequired: e.target.checked })} />Require guest ID at check-in</label>
          <p className="text-meta text-slate sm:col-span-2">These preferences configure the frontend demonstration and do not change historical operational records.</p><div className="sm:col-span-2"><Button type="submit" disabled={!canEdit}>Save general preferences</Button></div>
        </form></Card>}
      </div>
    </div>
  </>;
}
