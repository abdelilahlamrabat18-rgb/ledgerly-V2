import { ArrowUpRight, BriefcaseBusiness, DollarSign, FileText, Package, Receipt } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { MetricCard } from '../../components/shared/MetricCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { PageError } from '../../components/shared/PageError';
import { StatusPill } from '../../components/shared/StatusPill';
import { useAuth } from '../../context/AuthContext';
import { useEntity } from '../../hooks/useBusinessData';
import type { Client, Expense, Invoice, Order } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { buildCashFlow, hasCashFlowData } from '../../lib/analytics';

export function DashboardPage() {
  const { displayName, isDemo } = useAuth();
  const clients = useEntity<Client>('clients');
  const invoices = useEntity<Invoice>('invoices');
  const expenses = useEntity<Expense>('expenses');
  const orders = useEntity<Order>('orders');
  const loading = clients.loading || invoices.loading || expenses.loading || orders.loading;
  const error = clients.error || invoices.error || expenses.error || orders.error;
  const revenue = invoices.items.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const openInvoices = invoices.items.filter((invoice) => ['pending', 'overdue'].includes(invoice.status));
  const outstanding = openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const expenseTotal = expenses.items.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const recentInvoices = invoices.items.slice(0, 4);
  const chartData = buildCashFlow(invoices.items, expenses.items);
  const hasChartData = hasCashFlowData(chartData);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetingTitle = isDemo ? 'Good morning, Demo workspace' : displayName === 'Welcome' ? 'Welcome to your workspace' : `${greeting}, ${displayName}`;
  const todayLabel = format(new Date(), 'EEEE, MMMM d');
  const recentActivity = [
    ...clients.items.map((client) => ({ id: `client-${client.id}`, kind: 'client' as const, title: 'Client added', detail: client.company || client.name, createdAt: client.created_at })),
    ...invoices.items.map((invoice) => ({ id: `invoice-${invoice.id}`, kind: 'invoice' as const, title: `Invoice ${invoice.status}`, detail: invoice.invoice_number, createdAt: invoice.created_at })),
    ...expenses.items.map((expense) => ({ id: `expense-${expense.id}`, kind: 'expense' as const, title: 'Expense recorded', detail: expense.description, createdAt: expense.created_at })),
    ...orders.items.map((order) => ({ id: `order-${order.id}`, kind: 'order' as const, title: `Order ${order.status}`, detail: order.product, createdAt: order.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  if (loading) return <main className="page-wrap"><LoadingState /></main>;
  return <main className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">Overview · {todayLabel}</p><h1 className="page-title">{greetingTitle}</h1><p className="page-subtitle">Here’s what’s happening across your business today.</p></div><Link className="button button-primary" to="/app/google-sheets"><ArrowUpRight size={15} /> Sync your sheet</Link></div>
    {error && <PageError message={error} onRetry={() => { void clients.refresh(); void invoices.refresh(); void expenses.refresh(); void orders.refresh(); }} />}
    <div className="stats-grid">
      <MetricCard label="Total clients" value={String(clients.items.length)} detail={`${clients.items.length} ${clients.items.length === 1 ? 'client' : 'clients'} in your workspace`} icon={BriefcaseBusiness} tone="purple" />
      <MetricCard label="Paid revenue" value={formatCurrency(revenue)} detail={`${invoices.items.filter((invoice) => invoice.status === 'paid').length} paid ${invoices.items.filter((invoice) => invoice.status === 'paid').length === 1 ? 'invoice' : 'invoices'} recorded`} icon={DollarSign} tone="green" />
      <MetricCard label="Outstanding" value={formatCurrency(outstanding)} detail={`${openInvoices.length} ${openInvoices.length === 1 ? 'invoice' : 'invoices'} to follow up`} icon={FileText} tone="orange" />
      <MetricCard label="Total expenses" value={formatCurrency(expenseTotal)} detail={`${expenses.items.length} tracked ${expenses.items.length === 1 ? 'expense' : 'expenses'}`} icon={Receipt} tone="blue" />
    </div>
    <div className="dashboard-grid">
      <section className="card"><div className="card-header"><div><h2 className="card-title">Cash flow</h2><p className="page-subtitle" style={{ marginTop: 4, fontSize: 10 }}>Paid invoices and recorded expenses · last 6 months</p></div><Link className="card-link" to="/app/analytics">View analytics</Link></div>
        {hasChartData ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 5, right: 17, left: -15, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8d7cf1" stopOpacity={.2} /><stop offset="95%" stopColor="#8d7cf1" stopOpacity={0} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59b64" stopOpacity={.16} /><stop offset="95%" stopColor="#f59b64" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `$${Math.round(value / 100) / 10}k` : `$${value}`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 8, fontSize: 11 }} /><Area type="monotone" dataKey="income" name="Paid revenue" stroke="#725cea" fill="url(#incomeFill)" strokeWidth={2} /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f59b64" fill="url(#expenseFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <ChartEmptyState />}
      </section>
      <section className="card"><div className="card-header"><h2 className="card-title">Recent invoices</h2><Link className="card-link" to="/app/invoices">View all</Link></div><div className="recent-list">{recentInvoices.length ? recentInvoices.map((invoice) => <div className="recent-row" key={invoice.id}><div className="recent-icon"><FileText size={14} /></div><div className="recent-copy"><strong>{invoice.invoice_number}</strong><span>{invoice.client?.company || invoice.client?.name || 'Unassigned client'}</span></div><div style={{ textAlign: 'right' }}><div className="recent-amount">{formatCurrency(invoice.amount)}</div><div style={{ marginTop: 4 }}><StatusPill status={invoice.status} /></div></div></div>) : <div className="empty-state"><p>No invoices yet.</p><Link className="card-link" to="/app/invoices">Add your first invoice</Link></div>}</div></section>
    </div>
    <div className="dashboard-bottom">
      <section className="card"><div className="card-header"><h2 className="card-title">Latest orders</h2><Link className="card-link" to="/app/orders">View all</Link></div>{orders.items.length ? <div className="table-scroll"><table><thead><tr><th>Order</th><th>Client</th><th>Status</th><th>Total</th></tr></thead><tbody>{orders.items.slice(0, 4).map((order) => <tr key={order.id}><td><div className="table-person"><span className="avatar" style={{ background: '#fff0e6', color: '#d9783c' }}><Package size={13} /></span><strong>{order.product}</strong></div></td><td>{order.client?.company || order.client?.name || '—'}</td><td><StatusPill status={order.status} /></td><td><strong>{formatCurrency(order.total)}</strong></td></tr>)}</tbody></table></div> : <div className="empty-state"><p>No orders yet.</p><Link className="card-link" to="/app/orders">Add your first order</Link></div>}</section>
      <section className="card"><div className="card-header"><h2 className="card-title">Recent activity</h2><Link className="card-link" to="/app/transactions">Transactions</Link></div><div className="recent-list">{recentActivity.length ? recentActivity.map((item) => <div className="recent-row" key={item.id}><div className="recent-icon">{item.kind === 'client' ? <BriefcaseBusiness size={14} /> : item.kind === 'expense' ? <Receipt size={14} /> : item.kind === 'order' ? <Package size={14} /> : <FileText size={14} />}</div><div className="recent-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><span style={{ fontSize: 9, color: '#a0a9b6', whiteSpace: 'nowrap' }}>{formatDate(item.createdAt, true)}</span></div>) : <div className="empty-state"><p>No activity yet.</p><span style={{ fontSize: 10, color: '#9aa4b2' }}>New records will appear here.</span></div>}</div></section>
    </div>
  </main>;
}

function ChartEmptyState() {
  return <div className="chart-empty-state"><div className="empty-icon"><Receipt size={18} /></div><strong>No data available yet</strong><p>Record paid invoices or expenses to see your cash flow.</p></div>;
}
