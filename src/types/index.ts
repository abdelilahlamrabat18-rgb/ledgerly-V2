export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  business_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  amount: number;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, 'name' | 'company'> | null;
}

export interface Expense {
  id: string;
  user_id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  client_id: string | null;
  product: string;
  quantity: number;
  total: number;
  status: OrderStatus;
  order_date: string;
  notes: string | null;
  created_at: string;
  client?: Pick<Client, 'name' | 'company'> | null;
}

export interface GoogleConnection {
  id: string;
  user_id: string;
  provider: 'google';
  connected_email: string | null;
  spreadsheet_id: string | null;
  spreadsheet_name: string | null;
  selected_sheet: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface SpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SpreadsheetTab {
  id: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export type EntityName = 'clients' | 'invoices' | 'expenses' | 'orders';

export type SubscriptionEntitlement =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'unpaid'
  | 'no_provider';

export interface Subscription {
  id: string;
  user_id: string;
  entitlement: SubscriptionEntitlement;
  provider: string;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  provider_order_id: string | null;
  plan: string;
  plan_price_cents: number;
  currency: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  paid_through: string | null;
  provider_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface MappingField {
  key: string;
  label: string;
  required?: boolean;
}

export interface SheetPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface DashboardStats {
  clients: number;
  revenue: number;
  outstanding: number;
  expenses: number;
}
