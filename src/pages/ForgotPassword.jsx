import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ACCENT = '#10367D';
const BG     = '#F8FAFC';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

function toKoreanResetError(err) {
  const code = err?.code ?? '';
  const msg  = err?.message ?? '';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit'))
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  return '메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('이메일을 입력해 주세요.'); return; }
    // 연타 방어 — setLoading(비동기) 반영 전 더블클릭으로 메일 중복 발송되는 것 차단 (D-22)
    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      // 보안상 가입 여부와 무관하게 항상 동일한 완료 화면 노출 (계정 존재 여부 노출 방지)
      setSent(true);
    } catch (err) {
      setError(toKoreanResetError(err));
      submittingRef.current = false;
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
          <div style={{ fontSize: 15, color: T2 }}>비밀번호 찾기</div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(16,54,125,0.08)', color: ACCENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <MailCheck size={26} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T1, marginBottom: 8 }}>
              재설정 링크를 보냈습니다
            </div>
            <div style={{ fontSize: 14, color: T2, lineHeight: 1.6, marginBottom: 24 }}>
              <b style={{ color: T1 }}>{email.trim()}</b> 으로 비밀번호 재설정 메일을 보냈습니다.
              메일의 링크를 눌러 새 비밀번호를 설정해 주세요.
              <br />
              <span style={{ fontSize: 13, color: T3 }}>
                메일이 보이지 않으면 스팸함을 확인해 주세요. (해당 이메일로 가입된 계정이 있는 경우에만 발송됩니다)
              </span>
            </div>
            <Link to="/login" style={{
              display: 'block', width: '100%', padding: '13px 0', borderRadius: 10,
              background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 700,
              textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
            }}>
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 14, color: T2, lineHeight: 1.6, marginBottom: 18 }}>
              가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </div>

            <div style={{ marginBottom: 8 }}>
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
              {loading ? '발송 중...' : '재설정 링크 받기'}
            </button>

            <div style={{
              marginTop: 24, paddingTop: 20,
              borderTop: `1px solid ${BORDER}`,
              textAlign: 'center', fontSize: 14, color: T2,
            }}>
              비밀번호가 기억나셨나요?{' '}
              <Link to="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>
                로그인
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
