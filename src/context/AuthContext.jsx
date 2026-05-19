import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, name, role: selectedRole }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: selectedRole } },
    });
    if (error) throw error;
    // 테이블 insert는 DB 트리거(handle_new_user)가 자동 처리
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle(role) {
    localStorage.setItem('purit_oauth_role', role);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/oauth/callback',
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const DEST = { company: '/company', panel: '/panel', admin: '/admin' };
  const dashboardPath = role ? (DEST[role] ?? '/') : '/';

  return (
    <AuthContext.Provider value={{ user, role, loading, signUp, signIn, signInWithGoogle, signOut, dashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
