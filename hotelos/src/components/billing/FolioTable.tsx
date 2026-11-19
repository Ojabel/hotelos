import { formatCurrency, formatDate } from '@/utils/format';
import type { Folio } from '@/utils/folio';
import { PaymentStatusBadge } from '@/components/ui/StatusBadge';

export function FolioTable({ folio }: { folio: Folio }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-body">
          <caption className="sr-only">Folio lines</caption>
          <thead className="text-meta uppercase tracking-wide text-slate"><tr><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Charge</th><th className="py-2 text-right font-medium">Credit</th></tr></thead>
          <tbody className="divide-y divide-line">
            {folio.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-3 text-slate">{formatDate(l.date, false)}</td>
                <td className="py-2 pr-3">{l.description}</td>
                <td className="py-2 text-right tnum">{l.debit ? formatCurrency(l.debit) : ''}</td>
                <td className="py-2 text-right tnum text-success">{l.credit ? formatCurrency(l.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-body">
        <div className="flex justify-between"><dt className="text-slate">Room charges</dt><dd className="tnum">{formatCurrency(folio.roomTotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate">Extra services</dt><dd className="tnum">{formatCurrency(folio.extrasTotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate">Net payments</dt><dd className="tnum">{formatCurrency(folio.netPaid)}</dd></div>
        <div className="flex items-center justify-between font-semibold"><dt>Outstanding balance</dt><dd className="flex items-center gap-2 tnum">{formatCurrency(Math.max(0, folio.balance))}<PaymentStatusBadge status={folio.status} /></dd></div>
      </dl>
    </div>
  );
}
