import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isDemoMode, isSupabaseConfigured } from '../lib/supabase';
import { userFacingError } from '../lib/errors';
import { useOptionalToast } from './ToastContext';

export interface UserProfile {
  name: string | null;
  business_name: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  displayName: string;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  isDemo: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
  signOut: () => Promise<{ error: Error | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  updateProfile: (profile: UserProfile) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const emptyProfile: UserProfile = { name: null, business_name: null };

function getMetadataDisplayName(user: User | null) {
  if (!user) return '';
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  for (const key of ['name', 'full_name', 'display_name', 'username']) {
    const candidate = metadata?.[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return user.email?.split('@')[0]?.trim() || '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!isDemoMode && isSupabaseConfigured);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const toast = useOptionalToast()?.toast;
  const user = session?.user ?? null;

  useEffect(() => {
    if (isDemoMode || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const message = userFacingError(error);
          setProfileError(message);
          toast?.(message, 'error');
        }
        setSession(data.session);
      })
      .catch((error: unknown) => {
        if (active) {
          const message = userFacingError(error);
          setProfileError(message);
          toast?.(message, 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [toast]);

  const refreshProfile = useCallback(async () => {
    if (!user || !isSupabaseConfigured || isDemoMode) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase.from('profiles').select('name,business_name').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      const row = data as unknown as UserProfile | null;
      setProfile(row ?? emptyProfile);
    } catch (error) {
      setProfileError(userFacingError(error));
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const metadataName = getMetadataDisplayName(user);
    const displayName = profile?.name?.trim() || metadataName || 'Welcome';
    return {
      user,
      session,
      profile,
      displayName,
      loading,
      profileLoading,
      profileError,
      isDemo: isDemoMode,
      isConfigured: isSupabaseConfigured,
      signIn: async (email, password) => {
        if (isDemoMode) return { error: null };
        if (!isSupabaseConfigured) return { error: new Error('Supabase is not configured. Add your project URL and anon key to .env.local.') };
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { error: error ? new Error(userFacingError(error)) : null };
        } catch (error) {
          return { error: new Error(userFacingError(error)) };
        }
      },
      signUp: async (name, email, password) => {
        if (isDemoMode) return { error: null, needsConfirmation: false };
        if (!isSupabaseConfigured) return { error: new Error('Supabase is not configured. Add your project URL and anon key to .env.local.'), needsConfirmation: false };
        try {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
          return { error: error ? new Error(userFacingError(error)) : null, needsConfirmation: !data.session };
        } catch (error) {
          return { error: new Error(userFacingError(error)), needsConfirmation: false };
        }
      },
      signOut: async () => {
        if (isDemoMode) return { error: null };
        try {
          const { error } = await supabase.auth.signOut();
          return { error: error ? new Error(userFacingError(error)) : null };
        } catch (error) {
          return { error: new Error(userFacingError(error)) };
        }
      },
      sendPasswordReset: async (email) => {
        if (isDemoMode) return { error: null };
        if (!isSupabaseConfigured) return { error: new Error('Supabase is not configured. Add your project URL and anon key to .env.local.') };
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
          return { error: error ? new Error(userFacingError(error)) : null };
        } catch (error) {
          return { error: new Error(userFacingError(error)) };
        }
      },
      updatePassword: async (password) => {
        if (isDemoMode) return { error: null };
        if (!isSupabaseConfigured) return { error: new Error('Supabase is not configured.') };
        try {
          const { error } = await supabase.auth.updateUser({ password });
          return { error: error ? new Error(userFacingError(error)) : null };
        } catch (error) {
          return { error: new Error(userFacingError(error)) };
        }
      },
      updateProfile: async (nextProfile) => {
        setProfileError(null);
        if (isDemoMode) {
          setProfile(nextProfile);
          return { error: null };
        }
        if (!user || !isSupabaseConfigured) return { error: new Error('Sign in to update your profile.') };
        try {
          const { error: authError } = await supabase.auth.updateUser({ data: { name: nextProfile.name || '' } });
          if (authError) throw authError;
          const { error } = await supabase.from('profiles').update(nextProfile as never).eq('user_id', user.id);
          if (error) throw error;
          setProfile(nextProfile);
          return { error: null };
        } catch (error) {
          const message = userFacingError(error);
          return { error: new Error(message) };
        }
      },
      refreshProfile,
    };
  }, [loading, profile, profileError, profileLoading, refreshProfile, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export { AuthContext };
