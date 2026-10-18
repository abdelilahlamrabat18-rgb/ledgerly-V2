import type { Client, Expense, Invoice, Order } from '../types';

export const mockClients: Client[] = [
  { id: 'c1', user_id: 'demo', name: 'Nora Martinez', email: 'nora@northstar.studio', phone: '(415) 555-0182', company: 'Northstar Studio', address: 'San Francisco, CA', notes: null, created_at: '2025-01-08', updated_at: '2025-02-02' },
  { id: 'c2', user_id: 'demo', name: 'Marcus Lee', email: 'marcus@fieldwork.co', phone: '(212) 555-0134', company: 'Fieldwork Co.', address: 'Brooklyn, NY', notes: null, created_at: '2025-01-20', updated_at: '2025-02-01' },
  { id: 'c3', user_id: 'demo', name: 'Aisha Patel', email: 'aisha@apexwellness.com', phone: '(312) 555-0198', company: 'Apex Wellness', address: 'Chicago, IL', notes: null, created_at: '2025-02-04', updated_at: '2025-02-04' },
  { id: 'c4', user_id: 'demo', name: 'Oliver Chen', email: 'oliver@goodform.design', phone: '(206) 555-0128', company: 'Goodform Design', address: 'Seattle, WA', notes: null, created_at: '2025-02-12', updated_at: '2025-02-12' },
  { id: 'c5', user_id: 'demo', name: 'Jasmine Brooks', email: 'jasmine@commonthread.org', phone: '(512) 555-0166', company: 'Common Thread', address: 'Austin, TX', notes: null, created_at: '2025-02-18', updated_at: '2025-02-18' },
];

export const mockInvoices: Invoice[] = [
  { id: 'i1', user_id: 'demo', client_id: 'c1', invoice_number: 'INV-1048', amount: 4850, status: 'paid', issue_date: '2025-02-20', due_date: '2025-03-20', notes: null, created_at: '2025-02-20', updated_at: '2025-02-25', client: { name: 'Nora Martinez', company: 'Northstar Studio' } },
  { id: 'i2', user_id: 'demo', client_id: 'c2', invoice_number: 'INV-1047', amount: 2750, status: 'pending', issue_date: '2025-02-18', due_date: '2025-03-18', notes: null, created_at: '2025-02-18', updated_at: '2025-02-18', client: { name: 'Marcus Lee', company: 'Fieldwork Co.' } },
  { id: 'i3', user_id: 'demo', client_id: 'c3', invoice_number: 'INV-1046', amount: 3200, status: 'overdue', issue_date: '2025-01-30', due_date: '2025-02-28', notes: null, created_at: '2025-01-30', updated_at: '2025-02-28', client: { name: 'Aisha Patel', company: 'Apex Wellness' } },
  { id: 'i4', user_id: 'demo', client_id: 'c4', invoice_number: 'INV-1045', amount: 1900, status: 'paid', issue_date: '2025-01-24', due_date: '2025-02-24', notes: null, created_at: '2025-01-24', updated_at: '2025-02-01', client: { name: 'Oliver Chen', company: 'Goodform Design' } },
  { id: 'i5', user_id: 'demo', client_id: 'c5', invoice_number: 'INV-1044', amount: 1250, status: 'draft', issue_date: '2025-02-20', due_date: '2025-03-20', notes: null, created_at: '2025-02-20', updated_at: '2025-02-20', client: { name: 'Jasmine Brooks', company: 'Common Thread' } },
];

export const mockExpenses: Expense[] = [
  { id: 'e1', user_id: 'demo', description: 'Adobe Creative Cloud', category: 'Software', amount: 79, date: '2025-02-25', notes: null, created_at: '2025-02-25' },
  { id: 'e2', user_id: 'demo', description: 'Coworking membership', category: 'Workspace', amount: 320, date: '2025-02-22', notes: null, created_at: '2025-02-22' },
  { id: 'e3', user_id: 'demo', description: 'Client lunch — Northstar', category: 'Meals', amount: 146, date: '2025-02-19', notes: null, created_at: '2025-02-19' },
  { id: 'e4', user_id: 'demo', description: 'Domain renewals', category: 'Software', amount: 112, date: '2025-02-12', notes: null, created_at: '2025-02-12' },
  { id: 'e5', user_id: 'demo', description: 'Printer supplies', category: 'Office', amount: 68, date: '2025-02-08', notes: null, created_at: '2025-02-08' },
];

export const mockOrders: Order[] = [
  { id: 'o1', user_id: 'demo', client_id: 'c1', product: 'Brand strategy package', quantity: 1, total: 4850, status: 'completed', order_date: '2025-02-25', notes: null, created_at: '2025-02-25', client: { name: 'Nora Martinez', company: 'Northstar Studio' } },
  { id: 'o2', user_id: 'demo', client_id: 'c2', product: 'Website content sprint', quantity: 1, total: 2750, status: 'processing', order_date: '2025-02-24', notes: null, created_at: '2025-02-24', client: { name: 'Marcus Lee', company: 'Fieldwork Co.' } },
  { id: 'o3', user_id: 'demo', client_id: 'c3', product: 'Wellness campaign', quantity: 1, total: 3200, status: 'pending', order_date: '2025-02-21', notes: null, created_at: '2025-02-21', client: { name: 'Aisha Patel', company: 'Apex Wellness' } },
  { id: 'o4', user_id: 'demo', client_id: 'c4', product: 'Product photography', quantity: 2, total: 1900, status: 'completed', order_date: '2025-02-19', notes: null, created_at: '2025-02-19', client: { name: 'Oliver Chen', company: 'Goodform Design' } },
];
