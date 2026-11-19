import { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAppStore } from '@/store/useAppStore';
import { useHotelStore } from '@/store/useHotelStore';
import type { StockMovement } from '@/types';
import { formatDate } from '@/utils/format';
import { InventoryShell } from './InventoryShell';

const TONE = { delivery: 'success', usage: 'neutral', adjustment: 'warning' } as const;

export default function Movements() {
  const hotelId = useAppStore((s) => s.hotelId);
  const all = useHotelStore((s) => s.movements);
  const items = useHotelStore((s) => s.inventory);
  const [type, setType] = useState('all');
  const [itemId, setItemId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const scopedItems = useMemo(() => items.filter((i) => hotelId === 'all' || i.hotelId === hotelId), [items, hotelId]);
  const name = (id: string) => items.find((i) => i.id === id);
  const rangeError = from && to && to < from ? 'End date must be on or after the start date.' : '';
  const rows = useMemo(() => all.filter((m) => (hotelId === 'all' || m.hotelId === hotelId) && (type === 'all' || m.type === type) && (itemId === 'all' || m.itemId === itemId) && (rangeError || ((!from || m.date >= from) && (!to || m.date <= to)))), [all, hotelId, type, itemId, from, to, rangeError]);
  const clear = () => { setType('all'); setItemId('all'); setFrom(''); setTo(''); };

  const cols: Column<StockMovement>[] = [
    { key: 'date', header: 'Date', sortValue: (m) => m.date + m.id, render: (m) => formatDate(m.date, false) },
    { key: 'item', header: 'Item', sortValue: (m) => name(m.itemId)?.name ?? '', render: (m) => <span className="font-medium">{name(m.itemId)?.name ?? m.itemId}</span> },
    { key: 'type', header: 'Type', render: (m) => <Badge tone={TONE[m.type]}>{m.type === 'delivery' ? 'Delivery' : m.type === 'usage' ? 'Usage' : 'Adjustment'}</Badge> },
    { key: 'change', header: 'Change', align: 'right', sortValue: (m) => m.change, render: (m) => <span className={m.change > 0 ? 'text-success' : ''}>{m.change > 0 ? '+' : ''}{m.change} {name(m.itemId)?.unit}</span> },
    { key: 'reason', header: 'Reason', render: (m) => <span className="text-slate">{m.reason}</span> },
    { key: 'ref', header: 'Reference', render: (m) => m.reference ?? '—' },
    { key: 'by', header: 'By', render: (m) => m.by },
  ];

  return (
    <InventoryShell title="Stock movements" description={`${rows.length} movements`}>
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr_1fr_auto] lg:items-start">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'all', label: 'All types' }, { value: 'delivery', label: 'Deliveries' }, { value: 'usage', label: 'Usage' }, { value: 'adjustment', label: 'Adjustments' }]} />
          <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)} options={[{ value: 'all', label: 'All items' }, ...scopedItems.map((i) => ({ value: i.id, label: i.name }))]} />
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={rangeError || undefined} />
          <Button variant="ghost" className="lg:mt-[22px]" onClick={clear}>Clear</Button>
        </div>
        <DataTable caption="Stock movements" rows={rows} columns={cols} rowKey={(m) => m.id} pageSize={12} initialSort={{ key: 'date', dir: 'desc' }} empty={<EmptyState icon={ArrowLeftRight} title="No movements match" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
          mobileCard={(m) => (<div className="p-4"><div className="flex items-center justify-between"><p className="font-medium">{name(m.itemId)?.name}</p><span className="tnum">{m.change > 0 ? '+' : ''}{m.change}</span></div><p className="text-meta text-slate">{formatDate(m.date, false)} · {m.reason}{m.reference ? ` · ${m.reference}` : ''}</p></div>)} />
      </Card>
    </InventoryShell>
  );
}
