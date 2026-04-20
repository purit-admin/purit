import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAVY  = '#0A2540';
const BG    = '#F7F9FB';
const BORDER= '#E8ECF0';
const T1    = '#1A1A1A';
const T2    = '#4A5568';
const T3    = '#94A3B8';

const ROLES = [
  { id: 'company', label: '기업', desc: '전환 소재 검증 의뢰' },
  { id: 'panel',   label: '패널', desc: '미션 참여 & 보상 수령' },
];

const DEST = { company: '/company', panel: '/panel' };

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [role, setRole]         = useState('company');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim())     { setError('이름을 입력해 주세요.'); return; }
    if (!email.trim())    { setError('이메일을 입력해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }

    setLoading(true);
    try {
      const { user } = await signUp({ email, password, name, role });
      const userRole = user?.user_metadata?.role ?? role;
      navigate(DEST[userRole] ?? '/company', { replace: true });
    } catch (err) {
      if (err.message.includes('already registered')) {
        setError('이미 가입된 이메일입니다. 로그인해 주세요.');
      } else {
        setError(err.message);
      }
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
  const focusStyle = (e) => { e.target.style.borderColor = NAVY; e.target.style.boxShadow = `0 0 0 3px rgba(10,37,64,0.08)`; };
  const blurStyle  = (e) => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; };

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif",
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
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.05em', color: NAVY, marginBottom: 6 }}>
            PURITY
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
                border: role === r.id ? `2px solid ${NAVY}` : `1.5px solid ${BORDER}`,
                background: role === r.id ? 'rgba(10,37,64,0.04)' : '#fff',
                textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: role === r.id ? NAVY : T1, marginBottom: 4 }}>
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

          {/* 에러 */}
          {error && (
            <div style={{
              fontSize: 13, color: '#C53030',
              background: '#FFF5F5', border: '1px solid #FED7D7',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
            }}>{error}</div>
          )}

          {/* 가입 버튼 */}
          <button type="submit" disabled={loading} style={{
            marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 10,
            background: loading ? '#94A3B8' : NAVY,
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
          <Link to="/login" style={{ color: NAVY, fontWeight: 700, textDecoration: 'none' }}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
