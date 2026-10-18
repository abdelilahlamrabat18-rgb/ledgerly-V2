import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LoadingState } from '../../components/shared/LoadingState';
import { PageError } from '../../components/shared/PageError';
import { StatusPill } from '../../components/shared/StatusPill';
import { useEntity } from '../../hooks/useBusinessData';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Expense, Invoice } from '../../types';

type TransactionRow = {
  id: string;
  label: string;
  kind: 'invoice' | 'expense';
  date: string;
  amount: number;
  status?: Invoice['status'];
  detail: string;
};

export function TransactionsPage() {
  const invoices = useEntity<Invoice>('invoices');
  const expenses = useEntity<Expense>('expenses');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const loading = invoices.loading || expenses.loading;
  const error = invoices.error || expenses.error;
  const rows = useMemo<TransactionRow[]>(() => [
    ...invoices.items.map((invoice) => ({
      id: `invoice-${invoice.id}`, label: invoice.invoice_number, kind: 'invoice' as const,
      date: invoice.issue_date, amount: Number(invoice.amount) || 0, status: invoice.status,
      detail: invoice.client?.company || invoice.client?.name || 'Invoice',
    })),
    ...expenses.items.map((expense) => ({
      id: `expense-${expense.id}`, label: expense.description, kind: 'expense' as const,
      date: expense.date, amount: Number(expense.amount) || 0, detail: expense.category || 'Expense',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [invoices.items, expenses.items]);
  const filtered = rows.filter((row) => (type === 'all' || row.kind === type) && `${row.label} ${row.detail} ${row.status || ''}`.toLowerCase().includes(query.toLowerCase()));

  if (loading) return <main className="page-wrap"><LoadingState label="Loading transactions…" /></main>;
  return <main className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">Business activity</p><h1 className="page-title">Transactions</h1><p className="page-subtitle">A combined view of your invoices and recorded expenses.</p></div></div>
    {error && <PageError message={error} onRetry={() => { void invoices.refresh(); void expenses.refresh(); }} />}
    <section className="card table-card"><div className="table-toolbar"><div className="table-toolbar-left"><div className="inline-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transactions…" /></div><select className="filter-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All transactions</option><option value="invoice">Invoices</option><option value="expense">Expenses</option></select></div><span style={{ color: '#9aa4b2', fontSize: 10 }}>{filtered.length} records</span></div>
      {filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><ArrowLeftRight size={19} /></div><h3>{query || type !== 'all' ? 'No matching transactions' : 'No transactions yet'}</h3><p>{query || type !== 'all' ? 'Try changing your search or filter.' : 'Invoices and expenses will appear here as you add them.'}</p></div> : <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Type</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><div className="table-person"><span className="avatar" style={{ background: row.kind === 'invoice' ? '#eaf9f2' : '#fff0e6', color: row.kind === 'invoice' ? '#269c6c' : '#d9783c' }}>{row.kind === 'invoice' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</span><div><strong>{row.label}</strong><span>{row.detail}</span></div></div></td><td>{row.kind === 'invoice' ? 'Invoice' : 'Expense'}</td><td>{formatDate(row.date, true)}</td><td>{row.status ? <StatusPill status={row.status} /> : <span style={{ color: '#9aa4b2' }}>Recorded</span>}</td><td style={{ textAlign: 'right' }}><strong style={{ color: row.kind === 'expense' ? '#d9783c' : undefined }}>{row.kind === 'expense' ? '−' : ''}{formatCurrency(row.amount)}</strong></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
