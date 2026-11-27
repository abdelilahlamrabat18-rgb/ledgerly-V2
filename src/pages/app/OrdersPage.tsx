import { Package, Pencil, Plus, Search, Trash2, Download, ChevronDown, ChevronUp, Check, X, Calendar, DollarSign, User, Save, Edit2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { LoadingState } from '../../components/shared/LoadingState';
import { Modal } from '../../components/shared/Modal';
import { PageError } from '../../components/shared/PageError';
import { StatusPill } from '../../components/shared/StatusPill';
import { useEntity } from '../../hooks/useBusinessData';
import { usePreferences } from '../../context/PreferencesContext';
import { useToast } from '../../context/ToastContext';
import type { Client, Order, OrderStatus } from '../../types';
import { formatDate, today, validateAmount, validateQuantity } from '../../lib/utils';
import { toCSV, downloadCSV } from '../../lib/export';

type OrderForm = { client_id: string; product: string; quantity: string; total: string; status: OrderStatus; order_date: string; notes: string };
const emptyForm: OrderForm = { client_id: '', product: '', quantity: '1', total: '', status: 'pending', order_date: today(), notes: '' };

export function OrdersPage() {
  const orders = useEntity<Order>('orders');
  const clients = useEntity<Client>('clients');
  const { formatCurrency } = usePreferences();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<OrderForm>>({});

  const filtered = useMemo(() => orders.items.filter((order) => (status === 'all' || order.status === status) && `${order.product} ${order.client?.name || ''} ${order.client?.company || ''}`.toLowerCase().includes(query.toLowerCase())), [orders.items, query, status]);

  function openCreate() { setSelected(null); setForm(emptyForm); setModal(true); }
  function openEdit(order: Order) { setSelected(order); setForm({ client_id: order.client_id || '', product: order.product, quantity: String(order.quantity), total: String(order.total), status: order.status, order_date: order.order_date, notes: order.notes || '' }); setModal(true); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.product.trim()) { toast('Product or service is required.', 'error'); return; }
    const quantity = validateQuantity(form.quantity);
    if (quantity === null) { toast('Enter a valid quantity.', 'error'); return; }
    const total = validateAmount(form.total);
    if (total === null) { toast('Enter a valid total.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, client_id: form.client_id || null, quantity, total };
      if (selected) { await orders.update(selected.id, payload); toast('Order updated.'); }
      else { await orders.create(payload); toast('Order added.'); }
      setModal(false);
    } catch (err) { toast(err instanceof Error ? err.message : 'Unable to save order.', 'error'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try { await orders.remove(deleteTarget.id); toast('Order deleted.'); setDeleteTarget(null); }
    catch (err) { toast(err instanceof Error ? err.message : 'Unable to delete order.', 'error'); }
    finally { setSaving(false); }
  }

  async function quickStatusChange(order: Order, newStatus: OrderStatus) {
    if (order.status === newStatus) return;
    try { await orders.update(order.id, { status: newStatus }); toast(`Order marked as ${newStatus}.`); }
    catch (err) { toast(err instanceof Error ? err.message : 'Failed to update status.'); }
  }

  // Inline edit functions
  function startInlineEdit(order: Order) {
    setEditingId(order.id);
    setEditForm({
      client_id: order.client_id || '',
      product: order.product,
      quantity: String(order.quantity),
      total: String(order.total),
      status: order.status,
      order_date: order.order_date,
      notes: order.notes || '',
    });
  }

  function cancelInlineEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function saveInlineEdit(order: Order) {
    if (saving) return;
    const quantity = validateQuantity(editForm.quantity || '');
    if (quantity === null) { toast('Enter a valid quantity.', 'error'); return; }
    const total = validateAmount(editForm.total || '');
    if (total === null) { toast('Enter a valid total.', 'error'); return; }
    if (!editForm.product?.trim()) { toast('Product or service is required.', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: editForm.client_id || null,
        product: editForm.product,
        quantity,
        total,
        status: editForm.status as OrderStatus,
        order_date: editForm.order_date,
        notes: editForm.notes || '',
      };
      await orders.update(order.id, payload);
      toast('Order updated.');
      cancelInlineEdit();
    } catch (err) { toast(err instanceof Error ? err.message : 'Unable to save order.', 'error'); }
    finally { setSaving(false); }
  }

  const handleExport = () => {
    const headers = [
      { key: 'product', label: 'Product / Service' },
      { key: 'client', label: 'Client' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'status', label: 'Status' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'total', label: 'Total' },
    ];
    const rows = filtered.map((order) => ({
      product: order.product,
      client: order.client?.company || order.client?.name || '—',
      quantity: String(order.quantity),
      status: order.status,
      order_date: order.order_date,
      total: formatCurrency(order.total),
    }));
    downloadCSV(toCSV(rows, headers), `orders-${today()}.csv`);
    setShowExportMenu(false);
  };

  const statusOptions: OrderStatus[] = ['pending', 'processing', 'completed', 'cancelled'];

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Work in motion</p>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Keep deliverables and customer work moving forward.</p>
        </div>
        <button className="button button-primary" onClick={openCreate}><Plus size={15} /> Add order</button>
      </div>
      {(orders.error || clients.error) && <PageError message={orders.error || clients.error || ''} onRetry={() => { void orders.refresh(); void clients.refresh(); }} />}
      <section className="card table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="inline-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders…" /></div>
            <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#9aa4b2', fontSize: 10 }}>{filtered.length} {filtered.length === 1 ? 'order' : 'orders'}</span>
            <div style={{ position: 'relative' }}>
              <button className="button button-secondary" onClick={() => setShowExportMenu(!showExportMenu)}><Download size={14} /> Export</button>
              {showExportMenu && <div className="export-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 200 }}>
                <button className="dropdown-item" onClick={handleExport} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3d4852' }}>Export filtered (CSV)</button>
              </div>}
            </div>
          </div>
        </div>
        {orders.loading ? <LoadingState label="Loading orders…" /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Package size={19} /></div>
            <h3>{query || status !== 'all' ? 'No matching orders' : 'No orders yet'}</h3>
            <p>{query || status !== 'all' ? 'Try changing your search or filter.' : 'Add your first order to keep delivery visible.'}</p>
            {!query && status === 'all' && <button className="button button-primary" onClick={openCreate}><Plus size={14} /> Add order</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Product / service</th><th>Client</th><th>Qty</th><th>Status</th><th>Date</th><th>Total</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const isEditing = editingId === order.id;
                  const clientName = order.client?.company || order.client?.name || clients.items.find((client) => client.id === order.client_id)?.company || clients.items.find((client) => client.id === order.client_id)?.name || '—';
                  return (
                    <tr key={order.id} style={isEditing ? { background: '#f2fbf7' } : {}}>
                      {isEditing ? (
                        <>
                          <td>
                            <input
                              className="form-input"
                              value={editForm.product || ''}
                              onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                              autoFocus
                            />
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={editForm.client_id || ''}
                              onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })}
                            >
                              <option value="">Unassigned</option>
                              {clients.items.map((client) => (
                                <option key={client.id} value={client.id}>{client.company || client.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              min="1"
                              value={editForm.quantity || ''}
                              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={editForm.status || 'pending'}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as OrderStatus })}
                            >
                              {statusOptions.map((s) => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="date"
                              value={editForm.order_date || ''}
                              onChange={(e) => setEditForm({ ...editForm, order_date: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.total || ''}
                              onChange={(e) => setEditForm({ ...editForm, total: e.target.value })}
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="button button-primary" onClick={() => saveInlineEdit(order)} disabled={saving}>
                                {saving ? <Save size={14} /> : <Check size={14} />}
                              </button>
                              <button className="button button-ghost" onClick={cancelInlineEdit} aria-label="Cancel"><X size={14} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td><strong>{order.product}</strong></td>
                          <td>{clientName}</td>
                          <td>{order.quantity}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <StatusPill status={order.status} />
                              <div style={{ position: 'relative' }}>
                                <button className="icon-button" aria-label="Change status" onClick={(e) => { e.stopPropagation(); }}><ChevronDown size={12} /></button>
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 6, boxShadow: '0 8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 140 }}>
                                  {statusOptions.map((s) => (
                                    <button key={s} className="dropdown-item" onClick={(e) => { e.stopPropagation(); quickStatusChange(order, s); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#3d4852', borderTop: s === statusOptions[0] ? 'none' : '1px solid #f0f2f5' }}>
                                      {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{formatDate(order.order_date, true)}</td>
                          <td><strong>{formatCurrency(order.total)}</strong></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="button button-ghost" onClick={() => startInlineEdit(order)} aria-label="Edit order"><Edit2 size={14} /></button>
                              <button className="button button-ghost" onClick={() => { setDeleteTarget(order); }} aria-label="Delete order"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && <OrderModal form={form} setForm={setForm} clients={clients.items} selected={Boolean(selected)} saving={saving} onClose={() => setModal(false)} onSubmit={save} />}
      {deleteTarget && <ConfirmDialog title="Delete this order?" message={`This will permanently remove ${deleteTarget.product} and cannot be undone.`} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} loading={saving} />}
    </main>
  );
}

function OrderModal({ form, setForm, clients, selected, saving, onClose, onSubmit }: { form: OrderForm; setForm: (form: OrderForm) => void; clients: Client[]; selected: boolean; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const field = (key: keyof OrderForm, value: string) => setForm({ ...form, [key]: value });
  return (
    <Modal title={selected ? 'Edit order' : 'Add an order'} subtitle="Track what's in progress for each customer." onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="form-field full"><span className="form-label">Product or service <em>*</em></span><input className="form-input" autoFocus required value={form.product} onChange={(e) => field('product', e.target.value)} placeholder="Brand strategy package" /></label>
          <label className="form-field"><span className="form-label">Client</span><select className="form-select" value={form.client_id} onChange={(e) => field('client_id', e.target.value)}><option value="">Unassigned</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company || client.name}</option>)}</select></label>
          <label className="form-field"><span className="form-label">Status</span><select className="form-select" value={form.status} onChange={(e) => field('status', e.target.value as OrderStatus)}><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <label className="form-field"><span className="form-label">Quantity <em>*</em></span><input className="form-input" type="number" min="1" required value={form.quantity} onChange={(e) => field('quantity', e.target.value)} /></label>
          <label className="form-field"><span className="form-label">Total <em>*</em></span><input className="form-input" type="number" min="0" step="0.01" required value={form.total} onChange={(e) => field('total', e.target.value)} placeholder="0.00" /></label>
          <label className="form-field"><span className="form-label">Order date <em>*</em></span><input className="form-input" type="date" required value={form.order_date} onChange={(e) => field('order_date', e.target.value)} /></label>
          <label className="form-field full"><span className="form-label">Notes</span><textarea className="form-textarea" value={form.notes} onChange={(e) => field('notes', e.target.value)} placeholder="Delivery details or context…" /></label>
        </div>
        <div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : selected ? 'Save changes' : 'Add order'}</button></div>
      </form>
    </Modal>
  );
}