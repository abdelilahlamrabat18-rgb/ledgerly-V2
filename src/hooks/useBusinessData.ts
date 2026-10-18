import { useCallback, useEffect, useState } from 'react';
import { createEntity, deleteEntity, listEntity, updateEntity, type EntityRecord } from '../services/dataService';
import { userFacingError } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import type { EntityName } from '../types';

export function useEntity<T extends EntityRecord>(entity: EntityName) {
  const { user, isDemo } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listEntity<T>(entity)); }
    catch (err) { setError(userFacingError(err)); }
    finally { setLoading(false); }
  }, [entity]);

  useEffect(() => {
    void refresh();
    const handleDataChanged = () => { void refresh(); };
    window.addEventListener('ledgerly:data-updated', handleDataChanged);
    return () => window.removeEventListener('ledgerly:data-updated', handleDataChanged);
  }, [refresh]);

  const create = async (payload: Record<string, unknown>) => {
    const item = await createEntity<T>(entity, { ...payload, ...(isDemo ? { user_id: 'demo' } : { user_id: user?.id }) }, user?.id);
    setItems((current) => [item, ...current]); return item;
  };
  const update = async (id: string, payload: Record<string, unknown>) => {
    const item = await updateEntity<T>(entity, id, payload);
    setItems((current) => current.map((entry) => entry.id === id ? item : entry)); return item;
  };
  const remove = async (id: string) => { await deleteEntity(entity, id); setItems((current) => current.filter((entry) => entry.id !== id)); };
  return { items, loading, error, refresh, create, update, remove };
}
