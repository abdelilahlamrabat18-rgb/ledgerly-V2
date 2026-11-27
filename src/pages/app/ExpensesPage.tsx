import { Pencil, Plus, Receipt, Search, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { LoadingState } from '../../components/shared/LoadingState';
import { Modal } from '../../components/shared/Modal';
import { PageError } from '../../components/shared/PageError';
import { useEntity } from '../../hooks/useBusinessData';
import { usePreferences } from '../../context/PreferencesContext';
import { useToast } from '../../context/ToastContext';
import type { Expense } from '../../types';
import { formatDate, today, validateAmount } from '../../lib/utils';
import { toCSV, downloadCSV } from '../../lib/export';

type ExpenseForm = { description: string; category: string; amount: string; date: string; notes: string };
const emptyForm: ExpenseForm = { description: '', category: 'Software', amount: '', date: today(), notes: '' };
const categories = ['Software', 'Workspace', 'Meals', 'Travel', 'Office', 'Marketing', 'Contractors', 'Other'];

export function ExpensesPage() {
  const expenses = useEntity<Expense>('expenses');
  const { formatCurrency } = usePreferences();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filtered = useMemo(() => expenses.items.filter((expense) => (category === 'all' || expense.category === category) && `${expense.description} ${expense.category}`.toLowerCase().includes(query.toLowerCase())), [expenses.items, query, category]);
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0);

  function openCreate() { setSelected(null); setForm(emptyForm); setModal(true); }
  function openEdit(expense: Expense) { setSelected(expense); setForm({ description: expense.description, category: expense.category, amount: String(expense.amount), date: expense.date, notes: expense.notes || '' }); setModal(true); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.description.trim()) { toast('Description is required.', 'error'); return; }
    const amount = validateAmount(form.amount);
    if (amount === null) { toast('Enter a valid expense amount.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount };
      if (selected) { await expenses.update(selected.id, payload); toast('Expense updated.'); }
      else { await expenses.create(payload); toast('Expense recorded.'); }
      setModal(false);
    } catch (err) { toast(err instanceof Error ? err.message : 'Unable to save expense.', 'error'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try { await expenses.remove(deleteTarget.id); toast('Expense deleted.'); setDeleteTarget(null); }
    catch (err) { toast(err instanceof Error ? err.message : 'Unable to delete expense.', 'error'); }
    finally { setSaving(false); }
  }

  const handleExport = () => {
    const headers = [
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'date', label: 'Date' },
      { key: 'amount', label: 'Amount' },
    ];
    const rows = filtered.map((expense) => ({
      description: expense.description,
      category: expense.category,
      date: expense.date,
      amount: formatCurrency(expense.amount),
    }));
    downloadCSV(toCSV(rows, headers), `expenses-${today()}.csv`);
    setShowExportMenu(false);
  };

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Money out</p>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Know where your money is going, without the digging.</p>
        </div>
        <button className="button button-primary" onClick={openCreate}><Plus size={15} /> Add expense</button>
      </div>
      {expenses.error && <PageError message={expenses.error} onRetry={() => void expenses.refresh()} />}
      <section className="card table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="inline-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses…" /></div>
            <select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#9aa4b2', fontSize: 10 }}>{formatCurrency(total)} shown</span>
            <div style={{ position: 'relative' }}>
              <button className="button button-secondary" onClick={() => setShowExportMenu(!showExportMenu)}><Download size={14} /> Export</button>
              {showExportMenu && <div className="export-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 200 }}>
                <button className="dropdown-item" onClick={handleExport} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3d4852' }}>Export filtered (CSV)</button>
              </div>}
            </div>
          </div>
        </div>
        {expenses.loading ? <LoadingState label="Loading expenses…" /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Receipt size={19} /></div>
            <h3>{query || category !== 'all' ? 'No matching expenses' : 'No expenses yet'}</h3>
            <p>{query || category !== 'all' ? 'Try changing your search or filter.' : 'Start tracking the costs that keep your business moving.'}</p>
            {!query && category === 'all' && <button className="button button-primary" onClick={openCreate}><Plus size={14} /> Add expense</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Description</th><th>Category</th><th>Date</th><th>Notes</th><th>Amount</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id}>
                    <td><strong>{expense.description}</strong></td>
                    <td><span style={{ display: 'inline-block', background: '#f2f3f7', borderRadius: 5, padding: '5px 7px', fontSize: 9, color: '#697689', fontWeight: 700 }}>{expense.category}</span></td>
                    <td>{formatDate(expense.date, true)}</td>
                    <td>{expense.notes || '—'}</td>
                    <td><strong>{formatCurrency(expense.amount)}</strong></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="button button-ghost" onClick={() => openEdit(expense)} aria-label="Edit expense"><Pencil size={14} /></button>
                        <button className="button button-ghost" onClick={() => { setDeleteTarget(expense); }} aria-label="Delete expense"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && <ExpenseModal form={form} setForm={setForm} selected={Boolean(selected)} saving={saving} onClose={() => setModal(false)} onSubmit={save} />}
      {deleteTarget && <ConfirmDialog title="Delete this expense?" message={`This will permanently remove ${deleteTarget.description} and cannot be undone.`} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} loading={saving} />}
    </main>
  );
}

function ExpenseModal({ form, setForm, selected, saving, onClose, onSubmit }: { form: ExpenseForm; setForm: (form: ExpenseForm) => void; selected: boolean; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const field = (key: keyof ExpenseForm, value: string) => setForm({ ...form, [key]: value });
  return (
    <Modal title={selected ? 'Edit expense' : 'Add an expense'} subtitle="A small record now makes month-end much easier." onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="form-field full"><span className="form-label">Description <em>*</em></span><input className="form-input" autoFocus required value={form.description} onChange={(e) => field('description', e.target.value)} placeholder="Adobe Creative Cloud" /></label>
          <label className="form-field"><span className="form-label">Category</span><select className="form-select" value={form.category} onChange={(e) => field('category', e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="form-field"><span className="form-label">Amount <em>*</em></span><input className="form-input" type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => field('amount', e.target.value)} placeholder="0.00" /></label>
          <label className="form-field"><span className="form-label">Date <em>*</em></span><input className="form-input" type="date" required value={form.date} onChange={(e) => field('date', e.target.value)} /></label>
          <label className="form-field full"><span className="form-label">Notes</span><textarea className="form-textarea" value={form.notes} onChange={(e) => field('notes', e.target.value)} placeholder="Optional context…" /></label>
        </div>
        <div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : selected ? 'Save changes' : 'Add expense'}</button></div>
      </form>
    </Modal>
  );
}