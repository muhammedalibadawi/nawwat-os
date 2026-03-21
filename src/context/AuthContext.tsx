/**
 * AuthContext.tsx — NawwatOS · Supabase - Only Auth(v3 — Bulletproof Loading)
  *
 * Critical Fix(v3): buildAppUser previously threw when the `profiles` table
  * didn't exist, causing hydrateUser() to reject silently and leaving
    * setLoading(false) unreachable → infinite spinner.
 *
 * Fix: buildAppUser is now fully try/catch wrapped and ALWAYS returns a valid
  * AppUser object(falling back to email / defaults).hydrateUser() is wrapped in
 * try/catch, and the useEffect wraps both getSession() and onAuthStateChange()
  * in try/catch/finally so setLoading(false) is GUARANTEED to run.
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
}

// ---------------------------------------------------------------------------
// buildAppUser — reads app_metadata only (no user_metadata fallbacks).
// Returns null if tenant_id is missing (invalid JWT for app access).
// ---------------------------------------------------------------------------

const buildAppUser = async (supabaseUser: User): Promise<AppUser | null> => {
  const appMeta = supabaseUser.app_metadata ?? {};

  // اقرأ من app_metadata فقط — لا fallback لـ user_metadata
  const role = (appMeta.user_role as AppRole) || '';
  const tenant_id = (appMeta.tenant_id as string) || '';
  const branch_id = (appMeta.default_branch_id as string) || '';

  // لو app_metadata فارغة — امنع الدخول
  if (!tenant_id) {
    console.error('JWT missing tenant_id in app_metadata');
    return null;
  }

  // Attempt to fetch display name — this is OPTIONAL and non-critical.
  // If the `profiles` table doesn't exist yet, we fall back to email.
  let full_name = supabaseUser.email ?? 'User';
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', supabaseUser.id)
      .single();

    if (!error && profile?.full_name) {
      full_name = profile.full_name;
    }
    // If error (table missing, no row, etc.) — silently fall back. No throw.
    if (error) {
      console.warn('[AuthContext] profiles fetch skipped (table may not exist):', error.message);
    }
  } catch (profileErr: any) {
    console.warn('[AuthContext] profiles fetch caught unexpected error:', profileErr?.message);
  }

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    full_name,
    role: role as AppRole,
    tenant_id,
    branch_id,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => { },
  signInWithOtp: async () => { },
  signOut: async () => { },
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
   */
  const hydrateUser = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setUser(null);
      return;
    }
    try {
      const appUser = await buildAppUser(activeSession.user);
      if (appUser === null) {
        setUser(null);
        await supabase.auth.signOut();
        setSession(null);
        return;
      }
      setUser(appUser);
    } catch (err: any) {
      console.error('[AuthContext] hydrateUser unexpected error:', err?.message);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── Initial session check ──────────────────────────────────────────────
    // StrictMode workaround: without getSession(), the `INITIAL_SESSION` event 
    // from onAuthStateChange is often swallowed by the first unmount.
    const bootstrap = async () => {
      try {
        const { data: { session: activeSession }, error } = await supabase.auth.getSession();
        if (error) console.warn('[AuthContext] getSession warning:', error.message);
        if (!mounted) return;
        setSession(activeSession);
        await hydrateUser(activeSession);
      } catch (err: any) {
        // Lock stealing under StrictMode triggers here. It is safe to ignore 
        // because onAuthStateChange will eventually resolve the state.
        console.warn('[AuthContext] getSession lock collision ignored:', err?.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    // ── Auth state changes (login, logout, token refresh) ──────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        try {
          await hydrateUser(nextSession);
        } catch (err: any) {
          console.error('[AuthContext] onAuthStateChange error:', err?.message);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser]);

  /**
   * signIn — throws AuthError to the caller (LoginPage) on failure.
   * NO mock sessions. NO fallback. Failure is always visible.
   */
  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error as AuthError;
    // onAuthStateChange listener handles setUser/setSession automatically
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
    <AuthContext.Provider value={{ session, user, loading, signIn, signInWithOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAuth = () => useContext(AuthContext);