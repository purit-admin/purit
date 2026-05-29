import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Btn, Card } from '../components/ui';

const ROLE_LABELS = { editor: '편집자', viewer: '뷰어' };
const ROLE_PERMS  = {
  editor: '의뢰 등록·수정 및 전체 결과 열람',
  viewer: '결과 열람만 가능',
};

export default function InviteAccept() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const token     = new URLSearchParams(location.search).get('token');

  // status: 'loading' | 'valid' | 'expired' | 'no_token' | 'accepting' | 'accepted' | 'error'
  const [status,     setStatus]     = useState('loading');
  const [inviteInfo, setInviteInfo] = useState(null); // { email, role, company_name, expires_at }
  const [authUser,   setAuthUser]   = useState(null);
  const [errorMsg,   setErrorMsg]   = useState('');

  useEffect(() => {
    if (!token) { setStatus('no_token'); return; }

    async function init() {
      // 1. 로그인 상태 확인
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user);

      // 2. 토큰 유효성 확인 (peek_team_invite SECURITY DEFINER RPC)
      const { data, error } = await supabase.rpc('peek_team_invite', { p_token: token });

      if (error || !data) {
        setStatus('error');
        setErrorMsg(error?.message || '초대 정보를 불러오지 못했습니다.');
        return;
      }
      if (data.error === 'invalid_or_expired') {
        setStatus('expired');
        return;
      }

      setInviteInfo(data);
      setStatus('valid');
    }

    init();
  }, [token]);

  async function handleAccept() {
    if (!authUser) return;
    setStatus('accepting');

    const { data, error } = await supabase.rpc('accept_team_invite', { p_token: token });

    if (error || data?.error) {
      setStatus('error');
      setErrorMsg(
        data?.error === 'invalid_or_expired'
          ? '초대가 만료되었거나 이미 수락된 링크입니다.'
          : (error?.message || '수락 처리 중 오류가 발생했습니다.')
      );
      return;
    }

    setStatus('accepted');
    setTimeout(() => navigate('/company'), 2500);
  }

  function handleLoginRedirect() {
    // 로그인 후 다시 이 페이지로 돌아오도록 토큰을 보존
    localStorage.setItem('purit_pending_invite', token);
    navigate(`/login`);
  }

  function handleSignupRedirect() {
    localStorage.setItem('purit_pending_invite', token);
    navigate(`/signup?email=${encodeURIComponent(inviteInfo?.email || '')}&role=company`);
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>PURIT</span>
        </div>

        <Card style={{ padding: '36px 32px' }}>
          {/* LOADING */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
              초대 정보를 확인하는 중…
            </div>
          )}

          {/* NO TOKEN */}
          {status === 'no_token' && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>잘못된 초대 링크</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24 }}>
                초대 토큰이 없습니다. 이메일에서 올바른 링크를 클릭해 주세요.
              </p>
              <Btn onClick={() => navigate('/')} variant="outline" style={{ width: '100%' }}>홈으로</Btn>
            </>
          )}

          {/* EXPIRED */}
          {status === 'expired' && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏰</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>초대가 만료되었습니다</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24 }}>
                초대 링크는 발송 후 7일이 지나면 만료됩니다.<br/>
                팀 관리자에게 새 초대 이메일을 요청해 주세요.
              </p>
              <Btn onClick={() => navigate('/')} variant="outline" style={{ width: '100%' }}>홈으로</Btn>
            </>
          )}

          {/* ERROR */}
          {status === 'error' && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>오류가 발생했습니다</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24 }}>{errorMsg}</p>
              <Btn onClick={() => navigate('/')} variant="outline" style={{ width: '100%' }}>홈으로</Btn>
            </>
          )}

          {/* VALID — 초대 정보 표시 */}
          {(status === 'valid' || status === 'accepting') && inviteInfo && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>팀 초대</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text)' }}>{inviteInfo.company_name || '회사'}</strong> 팀에 초대되었습니다.
              </p>

              {/* 역할 카드 */}
              <div style={{
                background: 'var(--bg-2)', borderRadius: 8, padding: '14px 16px', marginBottom: 24,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>부여 역할</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {ROLE_LABELS[inviteInfo.role] || inviteInfo.role}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {ROLE_PERMS[inviteInfo.role] || ''}
                </div>
              </div>

              {/* 로그인 상태에 따라 분기 */}
              {authUser ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
                    <strong style={{ color: 'var(--text)' }}>{authUser.email}</strong> 계정으로 수락합니다.
                  </p>
                  <Btn
                    onClick={handleAccept}
                    disabled={status === 'accepting'}
                    style={{ width: '100%', marginBottom: 10 }}
                  >
                    {status === 'accepting' ? '처리 중…' : '초대 수락하기 →'}
                  </Btn>
                  <Btn variant="ghost" onClick={() => navigate('/')} style={{ width: '100%', fontSize: 13, color: 'var(--text-3)' }}>
                    취소
                  </Btn>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                    수락하려면 로그인하거나 새 계정을 만들어 주세요.
                  </p>
                  <Btn onClick={handleLoginRedirect} style={{ width: '100%', marginBottom: 10 }}>
                    로그인하고 수락하기 →
                  </Btn>
                  <Btn onClick={handleSignupRedirect} variant="outline" style={{ width: '100%' }}>
                    회원가입하고 수락하기
                  </Btn>
                </>
              )}
            </>
          )}

          {/* ACCEPTED */}
          {status === 'accepted' && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>팀 합류 완료!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.6 }}>
                <strong>{inviteInfo?.company_name || '팀'}</strong>에 성공적으로 합류했습니다.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>잠시 후 포털로 이동합니다…</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
