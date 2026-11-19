import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { chartColors } from '@/styles/chartColors';
import { formatCurrency } from '@/utils/format';
import type { DayPoint } from '@/utils/metrics';

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`;
};
const axis = { tick: { fill: chartColors.slate, fontSize: 12 }, tickLine: false, axisLine: { stroke: chartColors.line } } as const;
const compactMoney = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`);

export function RevenueChart({ data }: { data: DayPoint[] }) {
  return (
    <Card>
      <CardHeader title="Room revenue" action={<span className="text-meta text-slate">Actual vs. booked</span>} />
      <div className="h-64 p-4" role="img" aria-label="Daily room revenue, actual and booked">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={chartColors.line} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis} />
            <YAxis tickFormatter={compactMoney} width={44} {...axis} />
            <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v, name) => [formatCurrency(Number(v)), name === 'revenueActual' ? 'Actual' : 'Booked']} cursor={{ fill: 'rgba(196,165,116,0.12)' }} />
            <Bar dataKey="revenueActual" stackId="r" fill={chartColors.forest} radius={[2, 2, 0, 0]} />
            <Bar dataKey="revenueProjected" stackId="r" fill={chartColors.champagne} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function OccupancyChart({ data }: { data: DayPoint[] }) {
  return (
    <Card>
      <CardHeader title="Occupancy" />
      <div className="h-64 p-4" role="img" aria-label="Daily occupancy percentage">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={chartColors.line} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} {...axis} />
            <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [`${v}%`, 'Occupancy']} />
            <Line type="monotone" dataKey="occupancy" stroke={chartColors.deep} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function TrendsChart({ data }: { data: Array<{ date: string; bookings: number }> }) {
  return (
    <Card>
      <CardHeader title="Reservation trends" action={<span className="text-meta text-slate">New bookings per day</span>} />
      <div className="h-56 p-4" role="img" aria-label="New bookings created per day">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={chartColors.line} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axis} />
            <YAxis allowDecimals={false} width={28} {...axis} />
            <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [String(v), 'Bookings']} cursor={{ fill: 'rgba(196,165,116,0.12)' }} />
            <Bar dataKey="bookings" fill={chartColors.info} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
