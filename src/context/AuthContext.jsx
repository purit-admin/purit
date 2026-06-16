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
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, name, role: selectedRole, inviteToken, phone }) {
    const metadata = { name, role: selectedRole };
    // 초대 토큰이 있으면 포함 → handle_new_user 트리거가 companies 생성 건너뜀
    if (inviteToken) metadata.invite_token = inviteToken;
    // 휴대폰 인증(Mock) 완료 시 → 트리거가 panels/companies에 phone·phone_verified 저장
    // RoleRoute 게이트가 user_metadata.phone_verified로 통과 판별
    if (phone) { metadata.phone = phone; metadata.phone_verified = true; }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
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

  async function signInWithGoogle(role, source = 'signup', inviteToken = null) {
    localStorage.setItem('purit_oauth_role', role);
    localStorage.setItem('purit_oauth_source', source); // 'login' | 'signup'
    if (inviteToken) localStorage.setItem('purit_oauth_invite_token', inviteToken);
    else localStorage.removeItem('purit_oauth_invite_token');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/oauth/callback',
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  }

  async function signInWithLinkedIn(role) {
    localStorage.setItem('purit_oauth_role', role);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: window.location.origin + '/oauth/callback',
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
    <AuthContext.Provider value={{ user, role, loading, signUp, signIn, signInWithGoogle, signInWithLinkedIn, signOut, dashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
