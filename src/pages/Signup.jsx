import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ACCENT  = '#10367D';
const BG      = '#F8FAFC';
const BORDER  = '#E2E8F0';
const T1      = '#0F172A';
const T2      = '#475569';
const T3      = '#94A3B8';

const INPUT_STYLE = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: `1px solid ${BORDER}`, fontSize: 15,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const onInputFocus = e => {
  e.target.style.borderColor = ACCENT;
  e.target.style.boxShadow = `0 0 0 3px rgba(16,54,125,0.12)`;
};
const onInputBlur = e => {
  e.target.style.borderColor = BORDER;
  e.target.style.boxShadow = 'none';
};

function toKoreanAuthError(err) {
  const code = err?.code ?? '';
  const msg  = err?.message ?? '';
  if (code === 'user_already_exists'        || msg.includes('already registered') || msg.includes('already been registered')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (code === 'weak_password'              || msg.includes('weak'))              return '비밀번호가 너무 단순합니다. 더 복잡하게 설정해 주세요.';
  if (code === 'invalid_email'              || msg.includes('invalid email'))     return '올바른 이메일 형식을 입력해 주세요.';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit'))        return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  return '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}


const ROLES = [
  { id: 'company', label: '기업',  desc: '전환 소재 검증 의뢰' },
  { id: 'panel',   label: '패널', desc: '미션 참여 & 보상 수령' },
];

const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

const STEP = { CHOOSE: 'choose', EMAIL: 'email' };



function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function LinkedInSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

function PanelChooseStep({ onChoose, busy }) {
  const methods = [
    { id: 'google',   label: 'Google로 가입',    Icon: GoogleIcon,   desc: 'Google 계정으로 간편 가입' },
    { id: 'linkedin', label: 'LinkedIn으로 가입', Icon: LinkedInSVG,  desc: '링크드인 프로필로 경력 인증' },
    { id: 'email',    label: '이메일로 가입',     Icon: EmailIcon,    desc: '이메일·비밀번호로 직접 가입' },
  ];

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 10 }}>가입 방법 선택</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {methods.map(({ id, label, Icon, desc }) => (
          <button key={id} type="button" disabled={busy} onClick={() => onChoose(id)}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 12,
              background: '#fff', border: `1.5px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s',
              textAlign: 'left', opacity: busy ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = BG; e.currentTarget.style.borderColor = '#CBD5E1'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = BORDER; }}
          >
            <Icon />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{label}</div>
              <div style={{ fontSize: 12, color: T3, marginTop: 1 }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmailFields({ name, setName, email, setEmail, password, setPassword, showPw, setShowPw, role }) {
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
          {role === 'company' ? '담당자 이름' : '이름'}
        </label>
        <input type="text" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)}
          style={INPUT_STYLE} onFocus={onInputFocus} onBlur={onInputBlur} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>이메일</label>
        <input type="email" placeholder="hello@example.com" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email" style={INPUT_STYLE} onFocus={onInputFocus} onBlur={onInputBlur} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>
          비밀번호 <span style={{ fontSize: 12, color: T3, fontWeight: 400 }}>(6자 이상)</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="비밀번호 입력"
            value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ ...INPUT_STYLE, paddingRight: 42 }} onFocus={onInputFocus} onBlur={onInputBlur} />
          <button type="button" onClick={() => setShowPw(v => !v)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: T3, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
          }}>
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}

function PanelEmailStep({ name, setName, email, setEmail, password, setPassword, showPw, setShowPw, error, successMsg, loading, busy, onBack, onSubmit }) {
  return (
    <div>
      <button type="button" onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: T3, cursor: 'pointer', fontSize: 13, marginBottom: 18, padding: 0, fontFamily: 'inherit' }}
        onMouseEnter={e => e.currentTarget.style.color = T1}
        onMouseLeave={e => e.currentTarget.style.color = T3}
      >
        <ChevronLeft size={14} /> 뒤로
      </button>

      <div style={{ fontSize: 14, fontWeight: 600, color: T1, marginBottom: 16 }}>이메일로 계속하기</div>

      <form onSubmit={onSubmit}>
        <EmailFields name={name} setName={setName} email={email} setEmail={setEmail}
          password={password} setPassword={setPassword} showPw={showPw} setShowPw={setShowPw} role="panel" />

        {error && (
          <div style={{
            fontSize: 13, color: '#C53030', background: '#FFF5F5',
            border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          }}>{error}</div>
        )}
        {successMsg && (
          <div style={{
            fontSize: 13, color: '#065F46', background: '#ECFDF5',
            border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          }}>{successMsg}</div>
        )}

        <button type="submit" disabled={busy || !!successMsg}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10,
            background: (busy || !!successMsg) ? T3 : ACCENT,
            color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
            cursor: (busy || !!successMsg) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (!busy && !successMsg) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          {loading ? '가입 중...' : '패널로 시작하기'}
        </button>
      </form>
    </div>
  );
}

function CompanyEmailForm({ name, setName, email, setEmail, password, setPassword, showPw, setShowPw, error, successMsg, loading, busy, onSubmit, googleLoading, onGoogle }) {
  return (
    <>
      <form onSubmit={onSubmit}>
        <EmailFields name={name} setName={setName} email={email} setEmail={setEmail}
          password={password} setPassword={setPassword} showPw={showPw} setShowPw={setShowPw} role="company" />

        {error && (
          <div style={{
            fontSize: 13, color: '#C53030', background: '#FFF5F5',
            border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          }}>{error}</div>
        )}
        {successMsg && (
          <div style={{
            fontSize: 13, color: '#065F46', background: '#ECFDF5',
            border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          }}>{successMsg}</div>
        )}

        <button type="submit" disabled={busy || !!successMsg}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10,
            background: (busy || !!successMsg) ? T3 : ACCENT,
            color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
            cursor: (busy || !!successMsg) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (!busy && !successMsg) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          {loading ? '가입 중...' : '기업으로 시작하기'}
        </button>
      </form>

      {/* 구분선 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        <span style={{ fontSize: 12, color: T3 }}>또는</span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>

      {/* Google 가입 */}
      <button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading || busy}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10,
          background: '#fff', border: `1.5px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, color: T1, cursor: (googleLoading || busy) ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background 0.15s',
          opacity: (googleLoading || busy) ? 0.6 : 1,
        }}
        onMouseEnter={e => { if (!googleLoading && !busy) e.currentTarget.style.background = BG; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
      >
        <GoogleIcon />
        {googleLoading ? '연결 중...' : 'Google로 가입'}
      </button>
    </>
  );
}

export default function Signup() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, role: authRole, signUp, signOut, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (user && authRole) navigate(DEST[authRole] ?? '/company', { replace: true });
  }, [user, authRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // bfcache fix
  useEffect(() => {
    const onPageShow = e => { if (e.persisted) window.location.reload(); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const initialRole = useMemo(() => {
    const r = new URLSearchParams(location.search).get('role');
    return ['company', 'panel'].includes(r) ? r : 'company';
  }, [location.search]);

  const [role,     setRole]     = useState(initialRole);

  // Panel multi-step state
  const [panelStep,    setPanelStep]    = useState(STEP.CHOOSE);
  const [panelMethod,  setPanelMethod]  = useState(null);

  // Email form state
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = loading || googleLoading;

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle(role, 'signup');
    } catch (err) {
      setError('Google 로그인 중 오류가 발생했습니다.');
      setGoogleLoading(false);
    }
  };

  // Reset panel state on role change
  useEffect(() => {
    setPanelStep(STEP.CHOOSE);
    setPanelMethod(null);
    setError('');
    setSuccessMsg('');
  }, [role]);

  const handleChooseMethod = method => {
    setError('');
    setPanelMethod(method);
    if (method === 'google') {
      handleGoogle();
    } else {
      setPanelStep(STEP.EMAIL);
    }
  };

  const handleBack = () => {
    setError('');
    setPanelStep(STEP.CHOOSE);
    setPanelMethod(null);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!name.trim())        { setError('이름을 입력해 주세요.'); return; }
    if (!email.trim())       { setError('이메일을 입력해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }

    setLoading(true);
    try {
      await signUp({ email, password, name, role });
      await signOut();
      navigate('/login', { replace: true, state: { message: '가입이 완료되었습니다. 로그인해 주세요.' } });
    } catch (err) {
      setError(toKoreanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const emailFieldProps = { name, setName, email, setEmail, password, setPassword, showPw, setShowPw };
  const formStatusProps = { error, successMsg, loading, busy };

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
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
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em',
            fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic',
            color: T1, marginBottom: 6,
          }}>
            Purit
          </div>
          <div style={{ fontSize: 15, color: T2 }}>회원가입</div>
        </div>

        {/* Role selection */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 10 }}>역할 선택</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ROLES.map(r => (
              <button key={r.id} type="button"
                onClick={() => { setRole(r.id); setError(''); }}
                style={{
                  padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                  border: role === r.id ? `2px solid ${ACCENT}` : `1.5px solid ${BORDER}`,
                  background: role === r.id ? 'rgba(16,54,125,0.06)' : '#fff',
                  textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: role === r.id ? ACCENT : T1 }}>
                  {r.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Company flow */}
        {role === 'company' && (
          <CompanyEmailForm
            {...emailFieldProps}
            {...formStatusProps}
            onSubmit={handleSubmit}
            googleLoading={googleLoading}
            onGoogle={handleGoogle}
          />
        )}

        {/* Panel flow */}
        {role === 'panel' && (
          <>
            {panelStep === STEP.CHOOSE && (
              <PanelChooseStep onChoose={handleChooseMethod} busy={busy} />
            )}

            {panelStep === STEP.EMAIL && (
              <PanelEmailStep
                {...emailFieldProps}
                {...formStatusProps}
                onBack={handleBack}
                onSubmit={handleSubmit}
              />
            )}
          </>
        )}

        {/* Login link */}
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
