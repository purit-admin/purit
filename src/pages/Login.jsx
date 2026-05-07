import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ACCENT = '#10367D';
const BG     = '#F8FAFC';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('이메일을 입력해 주세요.'); return; }
    if (!password)     { setError('비밀번호를 입력해 주세요.'); return; }

    setLoading(true);
    try {
      const { user } = await signIn({ email, password });
      const role = user?.user_metadata?.role;
      navigate(DEST[role] ?? '/company', { replace: true });
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : err.message);
    } finally {
      setLoading(false);
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: T1, marginBottom: 6 }}>
            Purit
          </div>
          <div style={{ fontSize: 15, color: T2 }}>로그인</div>
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
