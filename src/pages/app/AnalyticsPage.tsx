import { BarChart3, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MetricCard } from '../../components/shared/MetricCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { PageError } from '../../components/shared/PageError';
import { useEntity } from '../../hooks/useBusinessData';
import { formatCurrency } from '../../lib/utils';
import { buildCashFlow, hasCashFlowData } from '../../lib/analytics';
import type { Expense, Invoice } from '../../types';

export function AnalyticsPage() {
  const invoices = useEntity<Invoice>('invoices');
  const expenses = useEntity<Expense>('expenses');
  const loading = invoices.loading || expenses.loading;
  const error = invoices.error || expenses.error;
  const cashFlow = buildCashFlow(invoices.items, expenses.items, 12);
  const hasFlow = hasCashFlowData(cashFlow);
  const revenue = cashFlow.reduce((sum, month) => sum + month.income, 0);
  const expenseTotal = cashFlow.reduce((sum, month) => sum + month.expenses, 0);
  const expenseCategories = Object.entries(expenses.items.reduce<Record<string, number>>((totals, expense) => {
    const category = expense.category?.trim() || 'Other';
    totals[category] = (totals[category] || 0) + (Number(expense.amount) || 0);
    return totals;
  }, {})).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total).slice(0, 8);

  if (loading) return <main className="page-wrap"><LoadingState label="Loading your analytics…" /></main>;
  return <main className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">Performance</p><h1 className="page-title">Analytics</h1><p className="page-subtitle">A view of recorded paid invoices and expenses from your workspace.</p></div></div>
    {error && <PageError message={error} onRetry={() => { void invoices.refresh(); void expenses.refresh(); }} />}
    <div className="stats-grid"><MetricCard label="Revenue · 12 months" value={formatCurrency(revenue)} detail={`${invoices.items.filter((invoice) => invoice.status === 'paid').length} paid invoices in your records`} icon={DollarSign} tone="green" /><MetricCard label="Expenses · 12 months" value={formatCurrency(expenseTotal)} detail={`${expenses.items.length} recorded expense entries`} icon={Receipt} tone="orange" /><MetricCard label="Net recorded" value={formatCurrency(revenue - expenseTotal)} detail="Revenue minus tracked expenses" icon={TrendingUp} tone="purple" /><MetricCard label="Expense categories" value={String(expenseCategories.length)} detail="Categories with recorded activity" icon={BarChart3} tone="blue" /></div>
    <div className="dashboard-grid">
      <section className="card"><div className="card-header"><div><h2 className="card-title">Revenue & expenses</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Monthly totals for the last 12 months</p></div></div>{hasFlow ? <div className="chart-wrap" style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashFlow} margin={{ top: 8, right: 15, left: -12, bottom: 0 }}><defs><linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8d7cf1" stopOpacity={.2} /><stop offset="95%" stopColor="#8d7cf1" stopOpacity={0} /></linearGradient><linearGradient id="analyticsExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59b64" stopOpacity={.16} /><stop offset="95%" stopColor="#f59b64" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `$${Math.round(value / 100) / 10}k` : `$${value}`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 8, fontSize: 11 }} /><Area type="monotone" dataKey="income" name="Paid revenue" stroke="#725cea" fill="url(#analyticsRevenue)" strokeWidth={2} /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f59b64" fill="url(#analyticsExpense)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <AnalyticsEmptyState />}</section>
      <section className="card"><div className="card-header"><div><h2 className="card-title">Expenses by category</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Based on your recorded expenses</p></div></div>{expenseCategories.length ? <div className="chart-wrap" style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={expenseCategories} layout="vertical" margin={{ top: 6, right: 14, left: 4, bottom: 0 }}><CartesianGrid horizontal={false} /><XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `$${Math.round(value / 100) / 10}k` : `$${value}`} /><YAxis dataKey="category" type="category" width={80} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 8, fontSize: 11 }} /><Bar dataKey="total" name="Expenses" fill="#8d7cf1" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <AnalyticsEmptyState message="Record expenses to see category totals." />}</section>
    </div>
  </main>;
}

function AnalyticsEmptyState({ message = 'Record a paid invoice or expense to build your analytics.' }: { message?: string }) {
  return <div className="chart-empty-state"><div className="empty-icon"><BarChart3 size={18} /></div><strong>No data available yet</strong><p>{message}</p></div>;
}
