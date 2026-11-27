import { BarChart3, Calendar, ChevronDown, ChevronUp, DollarSign, Download, FileText, Receipt, Search, TrendingUp, X } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMemo, useState } from 'react';
import { MetricCard } from '../../components/shared/MetricCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { PageError } from '../../components/shared/PageError';
import { useEntity } from '../../hooks/useBusinessData';
import { usePreferences } from '../../context/PreferencesContext';
import { formatDate, parseISO, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, today } from '../../lib/utils';
import { buildCashFlow, hasCashFlowData } from '../../lib/analytics';
import { toCSV, downloadCSV } from '../../lib/export';
import type { Expense, Invoice } from '../../types';

type DateRange = 'all' | 'month' | '30d' | '90d' | 'custom';
type InvoiceStatusFilter = 'all' | 'paid' | 'draft' | 'pending' | 'overdue' | 'cancelled';
type OrderStatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'cancelled';

function filterByDate<T extends { created_at?: string; date?: string }>(items: T[], range: DateRange, customStart?: string, customEnd?: string): T[] {
  if (range === 'all') return items;
  const now = new Date();
  let start: Date;
  let end: Date = endOfDay(now);
  if (range === 'month') { start = startOfMonth(now); }
  else if (range === '30d') { start = startOfDay(subDays(now, 30)); }
  else if (range === '90d') { start = startOfDay(subDays(now, 90)); }
  else if (range === 'custom' && customStart && customEnd) { start = startOfDay(parseISO(customStart)); end = endOfDay(parseISO(customEnd)); }
  else { return items; }
  return items.filter((item) => {
    const d = item.created_at || item.date;
    if (!d) return false;
    const itemDate = new Date(d);
    return itemDate >= start && itemDate <= end;
  });
}

export function AnalyticsPage() {
  const invoices = useEntity<Invoice>('invoices');
  const expenses = useEntity<Expense>('expenses');
  const { formatCurrency } = usePreferences();
  const loading = invoices.loading || expenses.loading;
  const error = invoices.error || expenses.error;
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filteredInvoices = useMemo(() => {
    let items = filterByDate(invoices.items, dateRange, customStart, customEnd);
    if (invoiceStatusFilter !== 'all') items = items.filter((inv) => inv.status === invoiceStatusFilter);
    return items;
  }, [invoices.items, dateRange, customStart, customEnd, invoiceStatusFilter]);

  const filteredExpenses = useMemo(() => filterByDate(expenses.items, dateRange, customStart, customEnd), [expenses.items, dateRange, customStart, customEnd]);

  const cashFlow = buildCashFlow(filteredInvoices, filteredExpenses, 12);
  const hasFlow = hasCashFlowData(cashFlow);
  const revenue = cashFlow.reduce((sum, month) => sum + month.income, 0);
  const expenseTotal = cashFlow.reduce((sum, month) => sum + month.expenses, 0);
  const expenseCategories = Object.entries(filteredExpenses.reduce<Record<string, number>>((totals, expense) => {
    const category = expense.category?.trim() || 'Other';
    totals[category] = (totals[category] || 0) + (Number(expense.amount) || 0);
    return totals;
  }, {})).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total).slice(0, 8);

  const handleExportInvoices = () => {
    const headers = [
      { key: 'invoice_number', label: 'Invoice Number' },
      { key: 'client', label: 'Client' },
      { key: 'status', label: 'Status' },
      { key: 'issue_date', label: 'Issue Date' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'amount', label: 'Amount' },
    ];
    const rows = filteredInvoices.map((inv) => ({
      invoice_number: inv.invoice_number,
      client: inv.client?.company || inv.client?.name || '—',
      status: inv.status,
      issue_date: inv.issue_date,
      due_date: inv.due_date || '',
      amount: formatCurrency(inv.amount),
    }));
    downloadCSV(toCSV(rows, headers), `invoices-${dateRange}-${today()}.csv`);
    setShowExportMenu(false);
  };
  const handleExportExpenses = () => {
    const headers = [
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'date', label: 'Date' },
      { key: 'amount', label: 'Amount' },
    ];
    const rows = filteredExpenses.map((exp) => ({
      description: exp.description,
      category: exp.category,
      date: exp.date,
      amount: formatCurrency(exp.amount),
    }));
    downloadCSV(toCSV(rows, headers), `expenses-${dateRange}-${today()}.csv`);
    setShowExportMenu(false);
  };

  if (loading) return <main className="page-wrap"><LoadingState label="Loading your analytics…" /></main>;
  return <main className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">Performance</p><h1 className="page-title">Analytics</h1><p className="page-subtitle">A view of recorded paid invoices and expenses from your workspace.</p></div>
      <div className="analytics-toolbar" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button className="button button-secondary" onClick={() => setShowExportMenu(!showExportMenu)}><Download size={14} /> Export</button>
          {showExportMenu && <div className="export-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 200 }}><button className="dropdown-item" onClick={handleExportInvoices} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3d4852' }}>Invoices (CSV)</button><button className="dropdown-item" onClick={handleExportExpenses} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3d4852', borderTop: '1px solid #f0f2f5' }}>Expenses (CSV)</button></div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'month', '30d', '90d', 'custom'] as DateRange[]).map((r) => <button key={r} className={`button ${dateRange === r ? 'button-primary' : 'button-secondary'}`} onClick={() => { setDateRange(r); if (r !== 'custom') { setCustomStart(''); setCustomEnd(''); } }}>{r === 'all' ? 'All Time' : r === 'month' ? 'This Month' : r === '30d' ? 'Last 30 Days' : r === '90d' ? 'Last 90 Days' : 'Custom'}</button>)}
          {dateRange === 'custom' && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="date" className="form-input" style={{ width: 160 }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} placeholder="Start date" /><input type="date" className="form-input" style={{ width: 160 }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} placeholder="End date" /></div>}
        </div>
        <select className="filter-select" value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value as InvoiceStatusFilter)} style={{ minWidth: 160 }}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
    {error && <PageError message={error} onRetry={() => { void invoices.refresh(); void expenses.refresh(); }} />}
    <div className="stats-grid"><MetricCard label="Revenue · filtered" value={formatCurrency(revenue)} detail={`${filteredInvoices.filter((invoice) => invoice.status === 'paid').length} paid invoices`} icon={DollarSign} tone="green" /><MetricCard label="Expenses · filtered" value={formatCurrency(expenseTotal)} detail={`${filteredExpenses.length} recorded expense entries`} icon={Receipt} tone="orange" /><MetricCard label="Net recorded" value={formatCurrency(revenue - expenseTotal)} detail="Revenue minus tracked expenses" icon={TrendingUp} tone="purple" /><MetricCard label="Expense categories" value={String(expenseCategories.length)} detail="Categories with recorded activity" icon={BarChart3} tone="blue" /></div>
    <div className="dashboard-grid">
      <section className="card"><div className="card-header"><div><h2 className="card-title">Revenue & expenses</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Monthly totals for the selected range</p></div></div>{hasFlow ? <div className="chart-wrap" style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashFlow} margin={{ top: 8, right: 15, left: -12, bottom: 0 }}><defs><linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8d7cf1" stopOpacity={.2} /><stop offset="95%" stopColor="#8d7cf1" stopOpacity={0} /></linearGradient><linearGradient id="analyticsExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59b64" stopOpacity={.16} /><stop offset="95%" stopColor="#f59b64" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${formatCurrency(value / 1000).replace(/[^0-9.]/g, '')}k` : formatCurrency(value)} /><Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 8, fontSize: 11 }} /><Area type="monotone" dataKey="income" name="Paid revenue" stroke="#725cea" fill="url(#analyticsRevenue)" strokeWidth={2} /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f59b64" fill="url(#analyticsExpense)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <AnalyticsEmptyState />}</section>
      <section className="card"><div className="card-header"><div><h2 className="card-title">Expenses by category</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Based on your recorded expenses</p></div></div>{expenseCategories.length ? <div className="chart-wrap" style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={expenseCategories} layout="vertical" margin={{ top: 6, right: 14, left: 4, bottom: 0 }}><CartesianGrid horizontal={false} /><XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${formatCurrency(value / 1000).replace(/[^0-9.]/g, '')}k` : formatCurrency(value)} /><YAxis dataKey="category" type="category" width={80} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 8, fontSize: 11 }} /><Bar dataKey="total" name="Expenses" fill="#8d7cf1" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <AnalyticsEmptyState message="Record expenses to see category totals." />}</section>
    </div>
  </main>;
}

function AnalyticsEmptyState({ message = 'Record a paid invoice or expense to build your analytics.' }: { message?: string }) {
  return <div className="chart-empty-state"><div className="empty-icon"><BarChart3 size={18} /></div><strong>No data available yet</strong><p>{message}</p></div>;
}
