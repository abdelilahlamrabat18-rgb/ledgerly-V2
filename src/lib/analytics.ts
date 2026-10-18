import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import type { Expense, Invoice } from '../types';

export interface CashFlowPoint {
  month: string;
  monthKey: string;
  income: number;
  expenses: number;
}

export function buildCashFlow(invoices: Invoice[], expenses: Expense[], monthCount = 6, now = new Date()): CashFlowPoint[] {
  const count = Math.max(1, monthCount);
  const months = Array.from({ length: count }, (_, index) => startOfMonth(subMonths(now, count - index - 1)));
  const points = months.map((date) => ({ month: format(date, 'MMM'), monthKey: format(date, 'yyyy-MM'), income: 0, expenses: 0 }));
  const pointByKey = new Map(points.map((point) => [point.monthKey, point]));

  for (const invoice of invoices) {
    if (invoice.status !== 'paid' || !invoice.issue_date) continue;
    const point = pointByKey.get(format(parseISO(invoice.issue_date), 'yyyy-MM'));
    if (point) point.income += Number(invoice.amount) || 0;
  }
  for (const expense of expenses) {
    if (!expense.date) continue;
    const point = pointByKey.get(format(parseISO(expense.date), 'yyyy-MM'));
    if (point) point.expenses += Number(expense.amount) || 0;
  }
  return points;
}

export function hasCashFlowData(points: CashFlowPoint[]) {
  return points.some((point) => point.income > 0 || point.expenses > 0);
}

export function parseRecordDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const date = parseISO(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
