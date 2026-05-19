import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ACCENT = '#10367D';
const BG     = '#F8FAFC';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

const ROLES = [
  { id: 'company', label: '기업', desc: '소재 검증 의뢰' },
  { id: 'panel',   label: '패널', desc: '미션 참여 & 보상' },
];

function toKoreanAuthError(err) {
  const code = err?.code ?? '';
  const msg  = err?.message ?? '';
  if (code === 'invalid_credentials'       || msg.includes('Invalid login credentials'))  return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (code === 'email_not_confirmed'       || msg.includes('Email not confirmed'))        return '이메일 인증을 완료한 후 로그인해 주세요.';
  if (code === 'user_not_found'            || msg.includes('User not found'))             return '가입되지 않은 이메일입니다.';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit'))               return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  return '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.440 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signIn, signInWithGoogle } = useAuth();

  const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

  // 이미 로그인된 사용자는 대시보드로 즉시 리디렉트
  useEffect(() => {
    if (user && role) navigate(DEST[role] ?? '/company', { replace: true });
  }, [user, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialRole = useMemo(() => {
    const r = new URLSearchParams(location.search).get('role');
    return ['company', 'panel'].includes(r) ? r : 'company';
  }, [location.search]);

  const [role, setRole]       = useState(initialRole);
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('이메일을 입력해 주세요.'); return; }
    if (!password)     { setError('비밀번호를 입력해 주세요.'); return; }

    setLoading(true);
    try {
      const { user } = await signIn({ email, password });
      const userRole = user?.user_metadata?.role;
      navigate(DEST[userRole] ?? '/company', { replace: true });
    } catch (err) {
      setError(toKoreanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle(role);
    } catch (err) {
      setError(toKoreanAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <Link to="/" style={{
        position: 'fixed', top: 24, left: 28,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 14, color: T3, textDecoration: 'none', transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = T1}
      onMouseLeave={e => e.currentTarget.style.color = T3}
      >
        <ArrowLeft size={15} /> 홈으로
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
          <div style={{ fontSize: 15, color: T2 }}>로그인</div>
        </div>

        {/* 역할 선택 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 10 }}>역할 선택</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ROLES.map(r => (
              <button key={r.id} type="button" onClick={() => setRole(r.id)} style={{
                padding: '12px', borderRadius: 12, cursor: 'pointer',
                border: role === r.id ? `2px solid ${ACCENT}` : `1.5px solid ${BORDER}`,
                background: role === r.id ? 'rgba(16,54,125,0.06)' : '#fff',
                textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: role === r.id ? ACCENT : T1, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: T3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Google 로그인 */}
        <button type="button" onClick={handleGoogle} disabled={googleLoading} style={{
          width: '100%', padding: '12px 0', borderRadius: 10,
          background: '#fff', border: `1.5px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, color: T1, cursor: googleLoading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s',
          opacity: googleLoading ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!googleLoading) e.currentTarget.style.background = BG; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          <GoogleIcon />
          {googleLoading ? '연결 중...' : 'Google로 로그인'}
        </button>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ fontSize: 12, color: T3, whiteSpace: 'nowrap' }}>또는 이메일로 로그인</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        <form onSubmit={handleSubmit}>
          {/* 이메일 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
              이메일
            </label>
            <input
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${BORDER}`, fontSize: 15,
                fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px rgba(16,54,125,0.12)`; }}
              onBlur={e =>  { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '12px 42px 12px 14px', borderRadius: 10,
                  border: `1px solid ${BORDER}`, fontSize: 15,
                  fontFamily: 'inherit', outline: 'none',
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

          {/* 에러 */}
          {error && (
            <div style={{
              fontSize: 13, color: '#C53030',
              background: '#FFF5F5', border: '1px solid #FED7D7',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
            }}>{error}</div>
          )}

          {/* 로그인 버튼 */}
          <button type="submit" disabled={loading || googleLoading} style={{
            marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 10,
            background: (loading || googleLoading) ? T3 : ACCENT,
            color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
            cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (!loading && !googleLoading) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: `1px solid ${BORDER}`,
          textAlign: 'center', fontSize: 14, color: T2,
        }}>
          계정이 없으신가요?{' '}
          <Link to="/signup" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
