import { describe, expect, it } from 'vitest';
import type { Invoice } from '../types';
import { summariseInvoiceMetrics } from './analytics';

describe('summariseInvoiceMetrics', () => {
  it('counts only truly paid invoices toward revenue and keeps outstanding totals separate', () => {
    const invoices: Invoice[] = [
      { id: '1', user_id: 'u1', client_id: 'c1', invoice_number: 'INV-100', amount: 1000, status: 'paid', issue_date: '2026-01-01', due_date: '2026-01-15', notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: '2', user_id: 'u1', client_id: 'c1', invoice_number: 'INV-101', amount: 1200, status: 'pending', issue_date: '2026-02-01', due_date: '2026-02-15', notes: null, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
      { id: '3', user_id: 'u1', client_id: 'c1', invoice_number: 'INV-102', amount: 1500, status: 'overdue', issue_date: '2026-01-10', due_date: '2026-01-20', notes: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
      { id: '4', user_id: 'u1', client_id: 'c1', invoice_number: 'INV-103', amount: 500, status: 'cancelled', issue_date: '2026-03-01', due_date: '2026-03-15', notes: null, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
    ];

    const summary = summariseInvoiceMetrics(invoices);

    expect(summary.totalInvoiced).toBe(4200);
    expect(summary.paidRevenue).toBe(1000);
    expect(summary.outstanding).toBe(2700);
    expect(summary.openInvoices).toBe(2);
    expect(summary.cancelledInvoices).toBe(1);
    expect(summary.paidInvoices).toBe(1);
  });

  it('ignores invalid values and keeps missing data explicit', () => {
    const invoices: Invoice[] = [
      { id: 'invalid', user_id: 'u1', client_id: 'c1', invoice_number: 'INV-999', amount: Number.NaN, status: 'paid', issue_date: 'bad-date', due_date: null, notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'valid', user_id: 'u1', client_id: 'c1', invoice_number: 'INV-200', amount: 200, status: 'paid', issue_date: '2026-04-01', due_date: '2026-04-15', notes: null, created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z' },
    ];

    const summary = summariseInvoiceMetrics(invoices);

    expect(summary.totalInvoiced).toBe(200);
    expect(summary.paidRevenue).toBe(200);
    expect(summary.invalidAmountCount).toBe(1);
  });
});
