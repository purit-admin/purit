import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/login', { replace: true });
      return;
    }

    const user = session.user;
    const existingRole = user.user_metadata?.role;

    if (existingRole) {
      // 기존 유저 — 바로 대시보드로
      navigate(DEST[existingRole] ?? '/company', { replace: true });
      return;
    }

    // 신규 OAuth 유저 — role 설정 및 DB 레코드 생성
    const ALLOWED_ROLES = ['company', 'panel'];
    const raw = localStorage.getItem('purit_oauth_role');
    const savedRole = ALLOWED_ROLES.includes(raw) ? raw : 'company';
    localStorage.removeItem('purit_oauth_role');

    // user_metadata에 role 저장
    await supabase.auth.updateUser({ data: { role: savedRole } });

    const displayName = user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split('@')[0]
      || '사용자';

    if (savedRole === 'panel') {
      const { data: existing } = await supabase
        .from('panels').select('id').eq('user_id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('panels').insert({
          user_id: user.id,
          name: displayName,
          status: 'active',
          trust_score: 100,
          total_missions: 0,
          honor_points: 0,
          selected_badge: null,
        });
      }
    } else {
      const { data: existing } = await supabase
        .from('companies').select('id').eq('user_id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('companies').insert({
          user_id: user.id,
          name: displayName,
          plan: 'starter',
          credit_balance: 0,
        });
      }
    }

    navigate(DEST[savedRole] ?? '/company', { replace: true });
    } catch (err) {
      console.error('[OAuthCallback error]', err);
      setError('로그인 처리 중 오류가 발생했습니다.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8FAFC',
      fontFamily: "'Inter', 'Noto Sans KR', -apple-system, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em',
          fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic',
          color: '#0F172A', marginBottom: 16,
        }}>
          Purit
        </div>
        {error ? (
          <>
            <div style={{ fontSize: 14, color: '#EF4444', marginBottom: 16 }}>{error}</div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              style={{
                fontSize: 13, color: '#10367D', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              로그인 페이지로 돌아가기
            </button>
          </>
        ) : (
          <div style={{ fontSize: 14, color: '#4B556D' }}>로그인 처리 중...</div>
        )}
      </div>
    </div>
  );
}
