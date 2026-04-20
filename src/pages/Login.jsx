import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const ROLES = [
  { id: 'company', label: '기업', desc: '제품·서비스 검증' },
  { id: 'panel',   label: '패널', desc: '미션 참여 & 수익' },
  { id: 'admin',   label: '어드민', desc: '플랫폼 운영' },
];

const DEST = { company: '/company', panel: '/panel', admin: '/admin' };

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') || 'company');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = params.get('role');
    if (r && DEST[r]) setRole(r);
  }, [params]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('이메일을 입력해 주세요.'); return; }
    if (!password) { setError('비밀번호를 입력해 주세요.'); return; }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate(DEST[role]);
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Back to landing */}
      <Link to="/" style={{
        position: 'fixed', top: 20, left: 24,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 14, color: 'var(--text-3)',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
      >
        <ArrowLeft size={15} />
        홈으로
      </Link>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px 36px 40px',
        boxShadow: 'var(--shadow-lg)',
        animation: 'fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: 4 }}>
            PURITY
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>로그인</div>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            역할 선택
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: role === r.id ? '1.5px solid var(--text)' : '1px solid var(--border)',
                  background: role === r.id ? 'var(--text)' : 'var(--surface)',
                  color: role === r.id ? '#fff' : 'var(--text-3)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              이메일
            </label>
            <input
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-3)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  padding: 0,
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              fontSize: 13, color: 'var(--red)',
              background: 'var(--red-dim)',
              border: '1px solid rgba(255,59,48,0.2)',
              borderRadius: 8, padding: '9px 12px',
              marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 16,
              width: '100%', padding: '13px 0',
              borderRadius: 10,
              background: loading ? 'var(--text-3)' : 'var(--text)',
              color: '#fff', fontSize: 15, fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center', fontSize: 13, color: 'var(--text-3)',
        }}>
          아직 계정이 없으신가요?{' '}
          <span
            onClick={() => navigate('/login?role=' + role)}
            style={{ color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
          >
            가입하기
          </span>
        </div>
      </div>
    </div>
  );
}
