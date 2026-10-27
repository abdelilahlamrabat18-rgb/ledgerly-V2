import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useOptionalToast } from './ToastContext';
import { fetchBillingState, startTrialOnce } from '../services/billing';
import {
  evaluateEntitlement,
  hasCoreAccess,
  isTrialing,
  isPaid,
  type Entitlement,
  type BillingState,
} from '../lib/billing';

interface BillingContextValue {
  state: BillingState | null;
  entitlement: Entitlement;
  loading: boolean;
  error: string | null;
  trialActive: boolean;
  hasCoreAccess: boolean;
  isPaid: boolean;
  providerConfigured: boolean;
  refresh: () => Promise<void>;
  startTrial: () => Promise<void>;
}

const BillingContext = createContext<BillingContextValue | null>(null);

const DEFAULT_ENTITLEMENT: Entitlement = 'no_provider';

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isDemo } = useAuth();
  const toast = useOptionalToast()?.toast;

  const [state, setState] = useState<BillingState | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement>(DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);

  const refresh = useCallback(async () => {
    if (isDemo) {
      // Demo mode intentionally does NOT grant real paid entitlements.
      // It is a local preview only.
      setState(null);
      setEntitlement(DEFAULT_ENTITLEMENT);
      setProviderConfigured(false);
      setError(null);
      setLoading(false);
      return;
    }
    if (!user || authLoading) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBillingState();
      setState(result);
      setEntitlement(evaluateEntitlement(result.trial));
      setProviderConfigured(Boolean(result.trial?.provider && result.trial.provider !== 'lemonsqueezy') || false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load billing state.';
      setError(message);
      setState(null);
      setEntitlement(DEFAULT_ENTITLEMENT);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, isDemo]);

  const startTrial = useCallback(async () => {
    if (isDemo) {
      toast?.('Demo mode is a local preview and cannot start a real trial.', 'error');
      return;
    }
    setError(null);
    try {
      const result = await startTrialOnce();
      setState(result);
      setEntitlement(evaluateEntitlement(result.trial));
      toast?.('Your 14-day trial has started.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start your trial.';
      setError(message);
      toast?.(message, 'error');
    }
  }, [isDemo, toast]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [refresh, authLoading]);

  // Refresh entitlement when data changes (e.g. after a webhook-updated row).
  useEffect(() => {
    const handleDataChanged = () => { void refresh(); };
    const handleBillingChanged = () => { void refresh(); };
    window.addEventListener('ledgerly:data-updated', handleDataChanged);
    window.addEventListener('ledgerly:billing-updated', handleBillingChanged);
    return () => {
      window.removeEventListener('ledgerly:data-updated', handleDataChanged);
      window.removeEventListener('ledgerly:billing-updated', handleBillingChanged);
    };
  }, [refresh]);

  const value = useMemo<BillingContextValue>(() => ({
    state,
    entitlement,
    loading,
    error,
    trialActive: isTrialing(entitlement),
    hasCoreAccess: hasCoreAccess(entitlement),
    isPaid: isPaid(entitlement),
    providerConfigured,
    refresh,
    startTrial,
  }), [state, entitlement, loading, error, providerConfigured, refresh, startTrial]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) throw new Error('useBilling must be used inside BillingProvider');
  return context;
}

export { BillingContext };