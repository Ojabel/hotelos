import { useHotelStore } from '@/store/useHotelStore';
import { today } from '@/utils/demoClock';
import type { Expense, PaymentMethod, Result } from '@/types';
import { delay } from './delay';
import { backendMode } from '@/services/api/backendMode';
import { backendOperations } from './backendOperations';

/** MOCK SERVICE — backend integration point for operating expenses. */
export async function addExpense(input: { hotelId: string; category: string; vendor: string; description: string; amount: number; method: PaymentMethod; date: string; status: Expense['status'] }): Promise<Result<Expense>> {
  if (backendMode) return backendOperations.createFinancialExpense(input.hotelId, input);
  await delay(250);
  if (!input.vendor.trim()) return { ok: false, error: 'Enter the vendor.' };
  if (!input.description.trim()) return { ok: false, error: 'Enter a description.' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  if (input.date > today()) return { ok: false, error: 'Expense date cannot be in the future.' };
  const { expenses, setExpenses, log } = useHotelStore.getState();
  const n = Math.max(0, ...expenses.map((e) => Number(e.id.replace('ex-', '')) || 0)) + 1;
  const expense: Expense = { ...input, vendor: input.vendor.trim(), description: input.description.trim(), amount: Math.round(input.amount), id: `ex-${String(n).padStart(3, '0')}` };
  setExpenses((es) => [expense, ...es]);
  log(`Expense recorded: ${expense.description}`, 'payment');
  return { ok: true, value: expense };
}
