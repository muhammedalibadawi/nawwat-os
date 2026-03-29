/**
 * AuthContext.tsx — NawwatOS · Supabase - Only Auth(v3 — Bulletproof Loading)
 *
 * Users may authenticate before a tenant exists (registration wizard).
 * buildAppUser never returns null — missing tenant_id yields empty strings + role 'owner'.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppRole =
  | 'owner'
  | 'master_admin'
  | 'customer'
  | 'employee'
  | 'branch_manager'
  | 'accountant'
  | 'cashier'
  | 'kitchen'
  | 'warehouse'
  | 'hr'
  | 'procurement'
  | 'sales'
  | 'doctor'
  | 'pharmacist'
  | 'receptionist'
  | 'teacher'
  | 'viewer';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  tenant_id: string;
  branch_id: string;
}

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOtp: (email: string, redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// buildAppUser — reads app_metadata; allows empty tenant (onboarding).
// ---------------------------------------------------------------------------

const buildAppUser = async (supabaseUser: User): Promise<AppUser> => {
  const appMeta = supabaseUser.app_metadata ?? {};

  const role = ((appMeta.user_role as AppRole) || 'owner') as AppRole;
  const tenant_id = (appMeta.tenant_id as string) || '';
  const branch_id = (appMeta.default_branch_id as string) || '';

  const metaName = (supabaseUser.user_metadata?.full_name as string | undefined)?.trim();
  let full_name: string = metaName || supabaseUser.email || 'User';

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .maybeSingle();

    if (error) {
      console.warn('[AuthContext] profiles fetch:', error.message);
    } else if (profile && typeof profile === 'object' && 'full_name' in profile && profile.full_name) {
      full_name = String(profile.full_name).trim() || full_name;
    }
    // لو profile فارغ أو بدون full_name: نبقى على user_metadata (metaName / email) أعلاه
  } catch (profileErr: unknown) {
    const msg = profileErr instanceof Error ? profileErr.message : String(profileErr);
    console.warn('[AuthContext] profiles fetch caught unexpected error:', msg);
  }

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    full_name,
    role,
    tenant_id,
    branch_id,
  };
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => {},
  signInWithOtp: async () => {},
  signOut: async () => {},
  refreshUserSession: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * hydrateUser — builds the AppUser and updates state.
   * NEVER throws — all errors are caught internally.
   * No signOut when tenant_id is missing (RegisterPage handles onboarding).
   */
  const hydrateUser = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setUser(null);
      return;
    }
    try {
      const appUser = await buildAppUser(activeSession.user);
      setUser(appUser);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AuthContext] hydrateUser unexpected error:', msg);
      setUser(null);
    }
  }, []);

  const refreshUserSession = useCallback(async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[AuthContext] refreshSession failed:', error.message);
      throw error;
    }
    // لا setSession هنا — لا hydrateUser هنا — onAuthStateChange يحدّث
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session: activeSession },
          error,
        } = await supabase.auth.getSession();
        if (error) console.warn('[AuthContext] getSession warning:', error.message);
        if (!mounted) return;
        setSession(activeSession);
        await hydrateUser(activeSession);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[AuthContext] getSession lock collision ignored:', msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setTimeout(() => {
        if (!mounted) return;
        void (async () => {
          try {
            await hydrateUser(nextSession);
          } catch (err) {
            console.error('[AuthContext] onAuthStateChange error:', err);
          } finally {
            if (mounted) setLoading(false);
          }
        })();
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser]);

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error as AuthError;
  };

  const signInWithOtp = async (email: string, redirectPath = '/portal'): Promise<void> => {
    const redirectTo = `${window.location.origin}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error as AuthError;
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signInWithOtp,
        signOut,
        refreshUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAuth = () => useContext(AuthContext);
