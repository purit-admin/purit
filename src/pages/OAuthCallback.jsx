import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

export default function OAuthCallback() {
  const [error, setError] = useState(null);
  // useRef로 선언 — React.StrictMode의 이중 useEffect 실행(mount→cleanup→remount)에서도
  // let 변수와 달리 ref는 초기화되지 않아 두 번째 processSession 호출을 올바르게 차단함 (D-91)
  const handledRef = useRef(false);

  useEffect(() => {
    // Google이 취소/에러를 ?error= 파라미터로 전달 — 즉시 /login 복귀 (D-82)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
      localStorage.removeItem('purit_oauth_role');
      window.location.replace('/login');
      return;
    }

    // pendingRole을 useEffect 시작 즉시 읽고 즉시 삭제
    // StrictMode 2차 실행에서 localStorage가 비어있어도 handledRef.current=true가 processSession을 차단하므로 안전
    const ALLOWED_ROLES = ['company', 'panel'];
    const raw = localStorage.getItem('purit_oauth_role');
    const capturedPendingRole = ALLOWED_ROLES.includes(raw) ? raw : null;
    localStorage.removeItem('purit_oauth_role');

    async function processSession(session) {
      if (handledRef.current || !session) return;
      handledRef.current = true;

      try {
        const user = session.user;
        if (!user) {
          // user 없는 세션은 무시하고 다음 이벤트에서 재처리
          handledRef.current = false;
          return;
        }
        const existingRole = user.user_metadata?.role;

        if (existingRole) {
          // 기존 유저 — role 충돌 여부 확인
          if (capturedPendingRole && capturedPendingRole !== existingRole && existingRole !== 'admin') {
            const existingLabel = existingRole === 'panel' ? '패널' : '기업';
            const pendingLabel  = capturedPendingRole === 'panel' ? '패널' : '기업';
            // handledRef 유지(true) — 두 번째 processSession 호출 차단
            // 로그아웃 처리 — 에러 화면에서 /login으로 돌아갔을 때 잘못된 계정으로 자동 로그인 방지
            try { await supabase.auth.signOut(); } catch { /* ignore */ }
            setError(`이 Google 계정은 이미 '${existingLabel}'으로 가입되어 있습니다. '${pendingLabel}'로 가입하려면 다른 Google 계정을 사용해 주세요.`);
            return;
          }
          // 충돌 없음 — 바로 대시보드로 (full reload로 AuthContext 확실히 초기화)
          window.location.replace(DEST[existingRole] ?? '/company');
          return;
        }

        // 신규 OAuth 유저 — pendingRole 없으면 에러 (D-91: ?? 'company' 위험 폴백 제거)
        // pendingRole이 없다는 것은 Login/Signup 정상 흐름을 거치지 않았다는 의미
        if (!capturedPendingRole) {
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          setError('로그인 방식을 확인할 수 없습니다. 로그인 페이지에서 역할을 선택 후 다시 시도해 주세요.');
          return;
        }

        const savedRole = capturedPendingRole;

        const { error: updateErr } = await supabase.auth.updateUser({ data: { role: savedRole } });
        if (updateErr) throw new Error(`역할 설정 실패: ${updateErr.message}`);

        const displayName = user.user_metadata?.full_name
          || user.user_metadata?.name
          || user.email?.split('@')[0]
          || '사용자';

        // SECURITY DEFINER RPC로 레코드 생성 — 클라이언트 직접 INSERT는 RLS 차단 (migration 059/060)
        const { error: profileErr } = await supabase.rpc('create_oauth_user_profile', {
          p_role: savedRole,
          p_display_name: displayName,
        });
        if (profileErr) throw new Error(`프로필 생성 실패: ${profileErr.message}`);

        if (savedRole === 'panel') {
          try { sessionStorage.removeItem('purit_panel_creds'); } catch { /* skip */ }
        }

        // updateUser 후 full reload → AuthContext가 새 role 포함 세션으로 깨끗하게 초기화
        window.location.replace(DEST[savedRole] ?? '/company');
      } catch (err) {
        console.error('[OAuthCallback error]', err);
        // handledRef 유지(true) — 에러 발생 후 두 번째 processSession 호출이 리디렉트하는 것을 방지
        setError('로그인 처리 중 오류가 발생했습니다.');
      }
    }

    // PKCE 코드 교환 완료를 onAuthStateChange로 대기 (getSession보다 신뢰성 높음)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        processSession(session);
      }
    });

    // 이미 세션이 있는 경우(기존 로그인 유저 재인증) 즉시 처리
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) processSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
              onClick={() => window.location.replace('/login')}
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
