import { useState } from 'react';
import { X, DollarSign, CreditCard, Banknote, Building2, Check, HelpCircle } from 'lucide-react';
import type { Invoice, PaymentMethod } from '../../types';
import { formatCurrency, validateAmount, today } from '../../lib/utils';
import { Modal } from '../shared/Modal';

interface RecordPaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    payment_date: string;
    payment_method: PaymentMethod;
    reference: string;
    notes: string;
  }) => Promise<void>;
  saving: boolean;
  formatCurrency: (value: number | null | undefined) => string;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer', icon: <Building2 size={14} /> },
  { value: 'card', label: 'Card', icon: <CreditCard size={14} /> },
  { value: 'cash', label: 'Cash', icon: <Banknote size={14} /> },
  { value: 'check', label: 'Check', icon: <HelpCircle size={14} /> },
  { value: 'other', label: 'Other', icon: <HelpCircle size={14} /> },
];

export function RecordPaymentModal({
  invoice,
  onClose,
  onSubmit,
  saving,
  formatCurrency,
}: RecordPaymentModalProps) {
  const balanceDue = invoice.balance_due ?? (invoice.amount - (invoice.amount_paid || 0));
  const [amount, setAmount] = useState(String(balanceDue));
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validatedAmount = validateAmount(amount);
    if (validatedAmount === null || validatedAmount <= 0) {
      setAmountError('Enter a valid payment amount.');
      return;
    }
    if (validatedAmount > balanceDue + 0.01) {
      setAmountError(`Amount cannot exceed balance due (${formatCurrency(balanceDue)}).`);
      return;
    }
    setAmountError(null);
    onSubmit({
      amount: validatedAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference: reference.trim() || '',
      notes: notes.trim() || '',
    });
  }

  return (
    <Modal title="Record payment" subtitle={`For ${invoice.invoice_number} · ${invoice.client?.company || invoice.client?.name || 'Unassigned client'}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16, padding: 12, background: '#f2fbf7', border: '1px solid #c6f6d5', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1e4d36' }}>Invoice total</span>
            <strong style={{ fontSize: 14 }}>{formatCurrency(invoice.amount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1e4d36' }}>Amount paid</span>
            <strong style={{ fontSize: 14 }}>{formatCurrency(invoice.amount_paid || 0)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #c6f6d5' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#2db47a' }}>Balance due</span>
            <strong style={{ fontSize: 16, color: '#2db47a' }}>{formatCurrency(balanceDue)}</strong>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">Payment amount <em>*</em></span>
            <div style={{ position: 'relative' }}>
              <DollarSign size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9aa4b2', pointerEvents: 'none' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 32 }}
                type="number"
                min="0.01"
                max={balanceDue}
                step="0.01"
                required
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setAmountError(null); }}
                placeholder="0.00"
                aria-describedby={amountError ? 'amount-error' : undefined}
              />
            </div>
            {amountError && <p id="amount-error" style={{ fontSize: 10, color: '#c53030', margin: '4px 0 0' }}>{amountError}</p>}
          </label>

          <label className="form-field">
            <span className="form-label">Payment date <em>*</em></span>
            <input className="form-input" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} max={today()} />
          </label>

          <label className="form-field full">
            <span className="form-label">Payment method <em>*</em></span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    border: `2px solid ${paymentMethod === method.value ? '#725cea' : '#dde2eb'}`,
                    borderRadius: 8,
                    background: paymentMethod === method.value ? '#f2f0fd' : '#fff',
                    color: paymentMethod === method.value ? '#725cea' : '#3d4852',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {method.icon} {method.label}
                </button>
              ))}
            </div>
          </label>

          <label className="form-field">
            <span className="form-label">Reference</span>
            <input className="form-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID, check #, etc." />
          </label>

          <label className="form-field full">
            <span className="form-label">Notes</span>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional context…" style={{ minHeight: 80 }} />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button-primary" disabled={saving} style={{ fontWeight: 600 }}>
            {saving ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="spinner" style={{ width: 14, height: 14 }} /> Recording…</span> : <><Check size={14} /> Record payment</>}
          </button>
</div>
    </form>
  </Modal>
  );
}