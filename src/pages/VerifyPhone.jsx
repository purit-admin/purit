import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// 가입 후 휴대폰 인증 게이트 (Mock OTP)
// Google(OAuth) 가입자 등 가입 폼에서 휴대폰을 받지 못한 사용자가 첫 진입 시 거치는 화면.
// 이미 DB에 phone_verified=true면 metadata만 동기화하고 통과. (예: 이전에 프로필에서 인증한 패널)
const ACCENT = '#10367D';
const BG     = '#F8FAFC';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

const INPUT_STYLE = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: `1px solid ${BORDER}`, fontSize: 15,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

export default function VerifyPhone() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const table = role === 'company' ? 'companies' : 'panels';
  const home  = role === 'company' ? '/company' : '/panel';

  const [checking, setChecking]   = useState(true);
  const [phone, setPhone]         = useState('');
  const [otpSent, setOtpSent]     = useState(false);
  const [otp, setOtp]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const sendingRef   = useRef(false); // 연타 가드 (동기) — setState 비동기 한계 보완 (D-22)
  const verifyingRef = useRef(false);

  // 마운트 시 DB 상태 확인 — 이미 인증돼 있으면 metadata 동기화 후 통과
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      const { data } = await supabase.from(table).select('phone, phone_verified').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (data?.phone_verified) {
        await supabase.auth.updateUser({ data: { phone_verified: true } });
        navigate(home, { replace: true });
        return;
      }
      if (data?.phone) setPhone(data.phone);
      setChecking(false);
    })();
    return () => { active = false; };
  }, [user, table, home, navigate]);

  const sendOtp = async () => {
    if (sendingRef.current) return;
    if (phone.replace(/\D/g, '').length < 10) { setError('올바른 휴대폰 번호를 입력해 주세요.'); return; }
    sendingRef.current = true;
    setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // Mock 발송
    setOtpSent(true); setLoading(false);
    sendingRef.current = false;
  };

  const verify = async () => {
    if (verifyingRef.current) return;
    if (otp.length !== 6) { setError('인증번호 6자리를 입력해 주세요.'); return; }
    verifyingRef.current = true;
    setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 600)); // Mock 검증 (6자리면 통과)
    // 본인 행(panels/companies/team_members)에만 저장하는 SECURITY DEFINER RPC — 팀원(오너 행 없음)도 커버
    const { data, error: rpcErr } = await supabase.rpc('save_my_phone', { p_phone: phone });
    if (rpcErr || data === false) {
      setError('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setLoading(false); verifyingRef.current = false; return;
    }
    await supabase.auth.updateUser({ data: { phone_verified: true, phone } });
    navigate(home, { replace: true }); // 성공 시 언마운트 → ref 리셋 불필요
  };

  if (checking) return null;

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff',
        border: `1px solid ${BORDER}`, borderRadius: 20, padding: '40px 36px 44px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: T1, marginBottom: 6 }}>
            Purit
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 6 }}>휴대폰 인증</div>
          <div style={{ fontSize: 13, color: T2, lineHeight: 1.6 }}>
            서비스 이용 전 휴대폰 인증이 필요합니다.<br />마감·승인 등 중요한 알림을 받기 위해 사용됩니다.
          </div>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, color: T2, display: 'block', marginBottom: 7 }}>휴대폰 번호</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: otpSent ? 12 : 0 }}>
          <input
            type="tel" placeholder="010-1234-5678" value={phone}
            onChange={e => { setPhone(e.target.value); setOtpSent(false); setOtp(''); setError(''); }}
            disabled={otpSent}
            style={{ ...INPUT_STYLE, flex: 1, opacity: otpSent ? 0.6 : 1 }}
          />
          {!otpSent && (
            <button type="button" onClick={sendOtp} disabled={loading}
              style={{ flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none', background: loading ? T3 : ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? '발송 중...' : '인증번호 받기'}
            </button>
          )}
        </div>

        {otpSent && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
              style={{ ...INPUT_STYLE, flex: 1 }}
            />
            <button type="button" onClick={verify} disabled={loading}
              style={{ flexShrink: 0, padding: '0 20px', borderRadius: 10, border: 'none', background: loading ? T3 : ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? '확인 중...' : '확인'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: '#C53030', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: 12, color: T3, marginTop: 18, textAlign: 'center', lineHeight: 1.5 }}>
          🧪 테스트 모드 · 인증번호는 6자리 아무 숫자나 입력하면 통과됩니다.
        </div>
      </div>
    </div>
  );
}
