import { supabase, isDemoMode, isSupabaseConfigured, getSupabaseConfigurationIssue } from '../lib/supabase';
import { userFacingError } from '../lib/errors';
import { mockClients, mockExpenses, mockInvoices, mockOrders } from '../lib/mock-data';
import type { Client, EntityName, Expense, GoogleConnection, Invoice, Order } from '../types';

const demoStore: Record<EntityName, unknown[]> = {
  clients: [...mockClients], invoices: [...mockInvoices], expenses: [...mockExpenses], orders: [...mockOrders],
};

export const entityFields: Record<EntityName, string[]> = {
  clients: ['name', 'email', 'phone', 'company', 'address', 'notes'],
  invoices: ['invoice_number', 'amount', 'status', 'issue_date', 'due_date', 'notes', 'client_id'],
  expenses: ['description', 'category', 'amount', 'date', 'notes'],
  orders: ['product', 'quantity', 'total', 'status', 'order_date', 'notes', 'client_id'],
};

function requireRemote() {
  if (isDemoMode) return false;
  if (!isSupabaseConfigured) throw new Error(getSupabaseConfigurationIssue() || 'Supabase is not configured.');
  return true;
}

function toDataError(error: unknown) { return new Error(userFacingError(error)); }

export async function listEntity<T>(entity: EntityName): Promise<T[]> {
  if (!requireRemote()) return [...(demoStore[entity] as T[])];
  try {
    const orderColumn = entity === 'expenses' ? 'date' : entity === 'orders' ? 'order_date' : 'created_at';
    const { data, error } = await supabase.from(entity).select('*').order(orderColumn, { ascending: false });
    if (error) throw error;
    const records = (data || []) as unknown as Array<Record<string, unknown> & { client_id?: string | null }>;
    if ((entity === 'invoices' || entity === 'orders') && records.length) {
      const clientIds = [...new Set(records.map((record) => record.client_id).filter((id): id is string => Boolean(id)))];
      if (clientIds.length) {
        const { data: clientData, error: clientError } = await supabase.from('clients').select('id,name,company').in('id', clientIds);
        if (clientError) throw clientError;
        const relatedClients = (clientData || []) as unknown as Array<{ id: string; name: string; company: string | null }>;
        const clientsById = new Map(relatedClients.map((client) => [client.id, { name: client.name, company: client.company }]));
        return records.map((record) => ({ ...record, client: record.client_id ? clientsById.get(record.client_id) || null : null })) as T[];
      }
    }
    return records as T[];
  } catch (error) {
    throw toDataError(error);
  }
}

export async function createEntity<T>(entity: EntityName, payload: Record<string, unknown>, userId?: string): Promise<T> {
  if (!requireRemote()) {
    const item = { ...payload, id: `${entity}-${Date.now()}`, user_id: userId || 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    demoStore[entity].unshift(item);
    return item as T;
  }
  try {
    const { data, error } = await supabase.from(entity).insert(payload as never).select().single();
    if (error) throw error;
    return data as T;
  } catch (error) {
    throw toDataError(error);
  }
}

export async function updateEntity<T>(entity: EntityName, id: string, payload: Record<string, unknown>): Promise<T> {
  if (!requireRemote()) {
    const index = demoStore[entity].findIndex((item) => (item as { id?: string }).id === id);
    if (index < 0) throw new Error('This record could not be found.');
    demoStore[entity][index] = { ...(demoStore[entity][index] as Record<string, unknown>), ...payload, updated_at: new Date().toISOString() };
    return demoStore[entity][index] as T;
  }
  try {
    const { data, error } = await supabase.from(entity).update(payload as never).eq('id', id).select().single();
    if (error) throw error;
    return data as T;
  } catch (error) {
    throw toDataError(error);
  }
}

export async function deleteEntity(entity: EntityName, id: string) {
  if (!requireRemote()) {
    demoStore[entity] = demoStore[entity].filter((item) => (item as { id?: string }).id !== id);
    return;
  }
  try {
    const { error } = await supabase.from(entity).delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error);
  }
}

export async function getConnection(): Promise<GoogleConnection | null> {
  if (!requireRemote()) return null;
  try {
    const { data, error } = await supabase.from('google_connections').select('*').maybeSingle();
    if (error) throw error;
    return data as GoogleConnection | null;
  } catch (error) {
    throw toDataError(error);
  }
}

export async function saveConnection(payload: Record<string, unknown>) {
  if (!requireRemote()) return payload as unknown as GoogleConnection;
  try {
    const { data, error } = await supabase.from('google_connections').upsert(payload as never, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return data as GoogleConnection;
  } catch (error) {
    throw toDataError(error);
  }
}

export type EntityRecord = Client | Invoice | Expense | Order;

