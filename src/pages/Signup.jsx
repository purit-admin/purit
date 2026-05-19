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

function toKoreanAuthError(err) {
  const code = err?.code ?? '';
  const msg  = err?.message ?? '';
  if (code === 'user_already_exists'   || msg.includes('already registered') || msg.includes('already been registered')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (code === 'weak_password'         || msg.includes('weak'))              return '비밀번호가 너무 단순합니다. 더 복잡하게 설정해 주세요.';
  if (code === 'invalid_email'         || msg.includes('invalid email'))     return '올바른 이메일 형식을 입력해 주세요.';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit'))  return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  return '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

const ROLES = [
  { id: 'company', label: '기업', desc: '전환 소재 검증 의뢰' },
  { id: 'panel',   label: '패널', desc: '미션 참여 & 보상 수령' },
];

const DEST = { company: '/company', panel: '/panel' };

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signUp } = useAuth();

  const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

  // 이미 로그인된 사용자는 대시보드로 즉시 리디렉트
  useEffect(() => {
    if (user && role) navigate(DEST[role] ?? '/company', { replace: true });
  }, [user, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialRole = useMemo(() => {
    const r = new URLSearchParams(location.search).get('role');
    return ['company', 'panel'].includes(r) ? r : 'company';
  }, [location.search]);

  const [role, setRole]         = useState(initialRole);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim())     { setError('이름을 입력해 주세요.'); return; }
    if (!email.trim())    { setError('이메일을 입력해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }

    setLoading(true);
    try {
      const { user, session } = await signUp({ email, password, name, role });
      if (!session) {
        // 이메일 인증 활성화 환경 — 세션 없음, 인증 이메일 발송됨
        setSuccessMsg('인증 이메일이 발송되었습니다. 이메일을 확인 후 로그인해 주세요.');
        return;
      }
      const userRole = user?.user_metadata?.role ?? role;
      navigate(DEST[userRole] ?? '/company', { replace: true });
    } catch (err) {
      setError(toKoreanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: `1px solid ${BORDER}`, fontSize: 15,
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
  const focusStyle = (e) => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px rgba(16,54,125,0.12)`; };
  const blurStyle  = (e) => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; };

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
        width: '100%', maxWidth: 440,
        background: '#fff', border: `1px solid ${BORDER}`,
        borderRadius: 20, padding: '40px 36px 44px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: T1, marginBottom: 6 }}>
            Purit
          </div>
          <div style={{ fontSize: 15, color: T2 }}>회원가입</div>
        </div>

        {/* 역할 선택 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 10 }}>역할 선택</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ROLES.map(r => (
              <button key={r.id} type="button" onClick={() => setRole(r.id)} style={{
                padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                border: role === r.id ? `2px solid ${ACCENT}` : `1.5px solid ${BORDER}`,
                background: role === r.id ? 'rgba(16,54,125,0.06)' : '#fff',
                textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: role === r.id ? ACCENT : T1, marginBottom: 4 }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 12, color: T3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 이름 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
              {role === 'company' ? '담당자 이름' : '이름'}
            </label>
            <input
              type="text" placeholder="홍길동"
              value={name} onChange={e => setName(e.target.value)}
              style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}
            />
          </div>

          {/* 이메일 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
              이메일
            </label>
            <input
              type="email" placeholder="hello@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
              비밀번호 <span style={{ fontSize: 12, color: T3, fontWeight: 400 }}>(6자 이상)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="비밀번호 입력"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: 42 }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: T3, cursor: 'pointer',
                padding: 0, display: 'flex', alignItems: 'center',
              }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 성공 메시지 (이메일 인증 대기) */}
          {successMsg && (
            <div style={{
              fontSize: 13, color: '#065F46',
              background: '#ECFDF5', border: '1px solid #6EE7B7',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
            }}>{successMsg}</div>
          )}

          {/* 에러 */}
          {error && (
            <div style={{
              fontSize: 13, color: '#C53030',
              background: '#FFF5F5', border: '1px solid #FED7D7',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
            }}>{error}</div>
          )}

          {/* 가입 버튼 */}
          <button type="submit" disabled={loading || !!successMsg} style={{
            marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 10,
            background: loading ? T3 : ACCENT,
            color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {loading ? '가입 중...' : `${role === 'company' ? '기업' : '패널'}으로 시작하기`}
          </button>
        </form>

        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: `1px solid ${BORDER}`,
          textAlign: 'center', fontSize: 14, color: T2,
        }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
