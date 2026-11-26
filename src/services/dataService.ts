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

function toDataError(error: unknown) { return new Error(userFacingError(error)); }

function requireRemote() {
  if (isDemoMode) return false;
  if (!isSupabaseConfigured) throw new Error(getSupabaseConfigurationIssue() || 'Supabase is not configured.');
  return true;
}

function declinedImportIds() {
  try {
    const raw = window.localStorage.getItem('ledgerly:declined-import-records');
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export async function listEntity<T>(entity: EntityName): Promise<T[]> {
  if (!requireRemote()) return (demoStore[entity] as T[]).filter((item) => !declinedImportIds().has(String((item as { id?: string }).id ?? '')));
  try {
    const orderColumn = entity === 'expenses' ? 'date' : entity === 'orders' ? 'order_date' : 'created_at';
    const { data, error } = await supabase.from(entity).select('*').order(orderColumn, { ascending: false });
    if (error) throw error;
    const records = (data || []) as unknown as Array<Record<string, unknown> & { client_id?: string | null }>;
    const declined = declinedImportIds();
    const activeRecords = records.filter((record) => !declined.has(String(record.id ?? '')));
    if ((entity === 'invoices' || entity === 'orders') && activeRecords.length) {
      const clientIds = [...new Set(activeRecords.map((record) => record.client_id).filter((id): id is string => Boolean(id)))];
      if (clientIds.length) {
        const { data: clientData, error: clientError } = await supabase.from('clients').select('id,name,company').in('id', clientIds);
        if (clientError) throw clientError;
        const relatedClients = (clientData || []) as unknown as Array<{ id: string; name: string; company: string | null }>;
        const clientsById = new Map(relatedClients.map((client) => [client.id, { name: client.name, company: client.company }]));
        return activeRecords.map((record) => ({ ...record, client: record.client_id ? clientsById.get(record.client_id) || null : null })) as T[];
      }
    }
    return activeRecords as T[];
  } catch (error) {
    throw toDataError(error);
  }
}

export async function createEntity<T>(entity: EntityName, payload: Record<string, unknown>, userId?: string): Promise<T> {
  if (!requireRemote()) {
    const item = { ...payload, id: `${entity}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, user_id: userId || 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    demoStore[entity].unshift(item);
    console.log('[ledgerly][import] demo insert', { table: entity, userId: item.user_id, payload, response: item });
    return item as T;
  }
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[ledgerly][import] supabase.auth.getUser error', { table: entity, error: authError });
    }
    const resolvedUserId = authData?.user?.id || userId;
    if (!resolvedUserId) {
      const err = new Error('Cannot import: authenticated user ID is missing. Please sign in again.');
      console.error('[ledgerly][import] missing user id', { table: entity, userIdArg: userId, authUserId: authData?.user?.id, payload });
      throw err;
    }
    const record = { ...payload, user_id: resolvedUserId };
    console.log('[ledgerly][import] inserting', { table: entity, userId: resolvedUserId, payload: record });
    const { data, error } = await supabase.from(entity).insert(record as never).select().single();
    if (error) {
      console.error('[ledgerly][import] supabase insert error', { table: entity, userId: resolvedUserId, payload: record, error });
      throw error;
    }
    console.log('[ledgerly][import] supabase insert success', { table: entity, userId: resolvedUserId, payload: record, response: data });
    return data as T;
  } catch (error) {
    console.error('[ledgerly][import] createEntity failed', { table: entity, userIdArg: userId, payload, error });
    throw toDataError(error);
  }
}

export async function createEntitiesBatch<T>(entity: EntityName, payloads: Record<string, unknown>[], userId?: string): Promise<T[]> {
  if (!payloads.length) return [];
  if (!requireRemote()) {
    const items = payloads.map((payload, index) => ({ ...payload, id: `${entity}-${Date.now()}-${index}`, user_id: userId || 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    demoStore[entity].unshift(...items);
    console.log('[ledgerly][import] demo batch insert', { table: entity, userId: userId || 'demo', count: items.length });
    return items as T[];
  }
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) console.error('[ledgerly][import] auth.getUser error', { table: entity, error: authError });
    const resolvedUserId = authData?.user?.id || userId;
    if (!resolvedUserId) {
      const err = new Error('Cannot import: authenticated user ID is missing. Please sign in again.');
      console.error('[ledgerly][import] missing user id (batch)', { table: entity, userIdArg: userId, authUserId: authData?.user?.id });
      throw err;
    }
    const records = payloads.map((payload) => ({ ...payload, user_id: resolvedUserId }));
    console.log('[ledgerly][import] batch inserting', { table: entity, userId: resolvedUserId, count: records.length, sample: records[0] ?? null });
    const inserted: T[] = [];
    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { data, error } = await supabase.from(entity).insert(chunk as never).select();
      if (error) {
        console.error('[ledgerly][import] batch insert error', { table: entity, userId: resolvedUserId, chunkIndex: i, chunkSize: chunk.length, error });
        throw error;
      }
      if (data) inserted.push(...(data as T[]));
      console.log('[ledgerly][import] batch chunk inserted', { table: entity, userId: resolvedUserId, chunkIndex: i, inserted: data?.length ?? 0 });
    }
    console.log('[ledgerly][import] batch insert success', { table: entity, userId: resolvedUserId, totalInserted: inserted.length });
    return inserted;
  } catch (error) {
    console.error('[ledgerly][import] createEntitiesBatch failed', { table: entity, userIdArg: userId, count: payloads.length, error });
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

