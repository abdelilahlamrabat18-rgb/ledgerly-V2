import type { Client, Expense, GoogleConnection, Invoice, Order, Profile, Subscription } from './index';

export type TableRow = {
  profiles: Profile;
  clients: Client;
  invoices: Invoice;
  expenses: Expense;
  orders: Order;
  google_connections: GoogleConnection;
  subscriptions: Subscription;
};

export type Database = {
  public: {
    Tables: {
      [K in keyof TableRow]: {
        Row: TableRow[K];
        Insert: Partial<Omit<TableRow[K], 'id' | 'created_at' | 'updated_at'>> & Pick<TableRow[K], 'user_id'>;
        Update: Partial<Omit<TableRow[K], 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
