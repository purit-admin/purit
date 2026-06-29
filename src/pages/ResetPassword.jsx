import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const ACCENT = '#10367D';
const BG     = '#F8FAFC';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword, signOut } = useAuth();

  // 'checking' = recovery 세션 확인 중 / 'ready' = 입력 가능 / 'invalid' = 유효하지 않은 링크
  const [status, setStatus]   = useState('checking');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  // 메일 링크로 진입 시 supabase-js가 URL 토큰을 자동 파싱해 recovery 세션을 설정한다.
  // PASSWORD_RECOVERY 이벤트 또는 기존 세션 존재 시 입력을 허용하고, 일정 시간 내 미감지 시 무효 링크로 처리.
  useEffect(() => {
    let resolved = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        resolved = true;
        setStatus('ready');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { resolved = true; setStatus('ready'); }
    });

    const timer = setTimeout(() => {
      if (!resolved) setStatus('invalid');
    }, 4000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    try {
      await updatePassword(password);
      // 보안상 비밀번호 변경 후 recovery 세션을 종료하고 새 비밀번호로 재로그인 유도
      // signOut은 best-effort — 실패해도 비번은 이미 변경됐으므로 로그인 이동을 막지 않음
      try { await signOut(); } catch { /* 로그아웃 실패 무시 */ }
      navigate('/login', {
        replace: true,
        state: { message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.' },
      });
    } catch (err) {
      const msg = err?.message ?? '';
      if (msg.includes('should be different') || msg.includes('New password'))
        setError('기존 비밀번호와 다른 비밀번호를 입력해 주세요.');
      else if (msg.includes('session') || msg.includes('Auth session'))
        setError('재설정 세션이 만료되었습니다. 비밀번호 찾기를 다시 요청해 주세요.');
      else
        setError('비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <Link to="/login" style={{
        position: 'fixed', top: 24, left: 28,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 14, color: T3, textDecoration: 'none', transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = T1}
      onMouseLeave={e => e.currentTarget.style.color = T3}
      >
        <ArrowLeft size={15} /> 로그인으로
      </Link>

      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff', border: `1px solid ${BORDER}`,
        borderRadius: 20, padding: '40px 36px 44px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: T1, marginBottom: 6 }}>
            Purit
          </div>
          <div style={{ fontSize: 15, color: T2 }}>새 비밀번호 설정</div>
        </div>

        {status === 'checking' && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 14, color: T2 }}>
            링크를 확인하는 중입니다...
          </div>
        )}

        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#FFF5F5', color: '#C53030',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <ShieldAlert size={26} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T1, marginBottom: 8 }}>
              유효하지 않거나 만료된 링크입니다
            </div>
            <div style={{ fontSize: 14, color: T2, lineHeight: 1.6, marginBottom: 24 }}>
              재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 요청해 주세요.
            </div>
            <Link to="/forgot-password" style={{
              display: 'block', width: '100%', padding: '13px 0', borderRadius: 10,
              background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 700,
              textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
            }}>
              비밀번호 찾기 다시 하기
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit}>
            {/* 새 비밀번호 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
                새 비밀번호
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="6자 이상 입력"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{
                    width: '100%', padding: '12px 42px 12px 14px', borderRadius: 10,
                    border: `1px solid ${BORDER}`, fontSize: 15,
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px rgba(16,54,125,0.12)`; }}
                  onBlur={e =>  { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: T3, cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center',
                }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
                새 비밀번호 확인
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="비밀번호 다시 입력"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: `1px solid ${BORDER}`, fontSize: 15,
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px rgba(16,54,125,0.12)`; }}
                onBlur={e =>  { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div style={{
                fontSize: 13, color: '#C53030',
                background: '#FFF5F5', border: '1px solid #FED7D7',
                borderRadius: 8, padding: '10px 14px', marginTop: 14,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 10,
              background: loading ? T3 : ACCENT,
              color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
