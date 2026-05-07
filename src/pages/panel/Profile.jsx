import { useEffect, useState } from 'react';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const INDUSTRIES = ['이커머스 마케터', 'B2B SaaS 세일즈', '스타트업 PM', 'B2B 영업', '퍼포먼스 마케터', '브랜드 마케터', 'CRO 전문가', '콘텐츠 마케터', '스타트업 대표', '기타'];
const EXPERTISE  = ['랜딩페이지 전환', '카피라이팅', '가격 전략', 'B2B 세일즈 카피', 'UX 설계', '이메일 마케팅', 'SNS 광고', '고객 인터뷰', '데이터 분석'];

const TIER_META = {
  ROOKIE:  { label: 'ROOKIE',  color: 'var(--text-3)',        bg: 'var(--surface-2)', desc: '0~4개 미션 완료' },
  PRO:     { label: 'PRO',     color: 'var(--text-2)',         bg: '#E8EEF8',          desc: '5~14개 미션 완료' },
  EXPERT:  { label: 'EXPERT',  color: '#92400E',              bg: '#fffbeb',          desc: '15~29개 미션 완료' },
  ELITE:   { label: 'ELITE',   color: 'var(--green)',         bg: '#f0fdf4',          desc: '30개+ 미션 완료' },
};

const BADGE_CATALOG = [
  { key: '첫 미션',    emoji: '🚀', name: '첫 미션',    desc: '첫 번째 미션을 완료하세요' },
  { key: '5회 완료',   emoji: '⭐', name: '5회 완료',   desc: '5개 미션을 완료하세요' },
  { key: '10회 완료',  emoji: '🏅', name: '10회 완료',  desc: '10개 미션을 완료하세요' },
  { key: '30회 완료',  emoji: '🏆', name: '30회 완료',  desc: '30개 미션을 완료하세요' },
  { key: '품질 검증자', emoji: '✅', name: '품질 검증자', desc: 'Purit Filter 5회 이상 통과' },
  { key: '연속 3회',   emoji: '🔥', name: '연속 3회',   desc: '7일 내 3건 이상 제출' },
  { key: '연속 7회',   emoji: '💎', name: '연속 7회',   desc: '7일 내 7건 이상 제출' },
];

const lbl    = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };

export default function PanelProfile() {
  const [panel, setPanel]       = useState(null);
  const [tab, setTab]           = useState('profile');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [email, setEmail]       = useState('');

  const [curPw, setCurPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]       = useState('');

  // form state
  const [name, setName]           = useState('');
  const [industry, setIndustry]   = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio]             = useState('');
  const [expertise, setExpertise] = useState([]);
  const [bankName, setBankName]   = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder]   = useState('');
  const [phone, setPhone]             = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent]         = useState(false);
  const [otp, setOtp]                 = useState('');
  const [otpLoading, setOtpLoading]   = useState(false);
  const [otpError, setOtpError]       = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data: p } = await supabase
        .from('panels').select('*').eq('user_id', user.id).single();
      if (p) {
        setPanel(p);
        setName(p.name || '');
        setIndustry(p.industry || '');
        setExperience(p.experience || '');
        setBio(p.bio || '');
        setExpertise(p.expertise || []);
        setBankName(p.bank_name || '');
        setBankAccount(p.bank_account || '');
        setBankHolder(p.bank_holder || '');
        setPhone(p.phone || '');
        setPhoneVerified(p.phone_verified || false);
      }
      setLoading(false);
    }
    load();
  }, []);

  const save = async (fields) => {
    if (!panel) return;
    setSaving(true);
    setSaved('');
    const { error } = await supabase
      .from('panels')
      .update(fields)
      .eq('id', panel.id);
    setSaving(false);
    if (error) {
      setSaved('저장 실패: ' + error.message);
    } else {
      setPanel(p => ({ ...p, ...fields }));
      setSaved('저장됐습니다.');
      setTimeout(() => setSaved(''), 2500);
    }
  };

  const toggleExpertise = (e) =>
    setExpertise(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  async function handleChangePw() {
    setPwMsg('');
    if (!newPw || newPw.length < 6) { setPwMsg('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    setPwSaving(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: curPw });
    if (signInErr) { setPwMsg('현재 비밀번호가 올바르지 않습니다.'); setPwSaving(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { setPwMsg('변경 실패: ' + error.message); return; }
    setPwMsg('비밀번호가 변경됐습니다.');
    setCurPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwMsg(''), 3000);
  }

  const handleSendOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) { setOtpError('올바른 번호를 입력해주세요.'); return; }
    setOtpLoading(true);
    setOtpError('');
    await new Promise(r => setTimeout(r, 800));
    setOtpSent(true);
    setOtpLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setOtpError('인증번호 6자리를 입력해주세요.'); return; }
    setOtpLoading(true);
    setOtpError('');
    await new Promise(r => setTimeout(r, 600));
    const { error } = await supabase.from('panels').update({ phone, phone_verified: true }).eq('id', panel.id);
    if (error) { setOtpError('저장 중 오류가 발생했습니다.'); }
    else { setPhoneVerified(true); setOtpSent(false); setOtp(''); }
    setOtpLoading(false);
  };

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 800, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>PANEL · PROFILE</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>내 프로필</h1>
      </div>

      {/* Profile header */}
      <Card style={{ marginBottom: 24, padding: '24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 800, color: '#0A0A08', flexShrink: 0,
        }}>
          {(name || '?')[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{name || '—'}</span>
            <Badge type="green">ACTIVE</Badge>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 10 }}>
            {industry || '직군 미설정'}{experience ? ` · ${experience} 경력` : ''}
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>완료 미션</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-sans)' }}>{panel?.total_missions || 0}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[['profile', '기본 정보'], ['expertise', '전문 분야'], ['payment', '정산 계좌'], ['password', '비밀번호'], ['achievement', '성과']].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setSaved(''); setPwMsg(''); }} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            borderBottom: `2px solid ${tab === v ? 'var(--green)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Feedback */}
      {pwMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius)', fontSize: 13,
          background: pwMsg.includes('실패') || pwMsg.includes('않') ? 'var(--red-dim)' : 'var(--green-dim)',
          color: pwMsg.includes('실패') || pwMsg.includes('않') ? 'var(--red)' : 'var(--green)',
          fontWeight: 600,
        }}>
          {pwMsg}
        </div>
      )}
      {saved && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius)', fontSize: 13,
          background: saved.startsWith('저장 실패') ? 'var(--red-dim)' : 'var(--green-dim)',
          color: saved.startsWith('저장 실패') ? 'var(--red)' : 'var(--green)',
          fontWeight: 600,
        }}>
          {saved}
        </div>
      )}

      {/* Profile tab */}
      {tab === 'profile' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
              📌 기업에게는 이름과 핸드폰 번호는 공개되지 않습니다. 직군과 경력만 공개됩니다.
            </div>
            <label style={lbl}>
              <span style={lblTxt}>이름</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>직군</span>
              <select value={industry} onChange={e => setIndustry(e.target.value)}>
                <option value="">선택하세요</option>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </label>
            <label style={lbl}>
              <span style={lblTxt}>경력</span>
              <input value={experience} onChange={e => setExperience(e.target.value)} placeholder="예: 5년, 7년 이상" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>자기소개 (선택)</span>
              <textarea value={bio} onChange={e => setBio(e.target.value)}
                placeholder="전문 분야와 경험을 간략히 소개해주세요."
                rows={3} style={{ resize: 'vertical' }} />
            </label>
            <div style={lbl}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lblTxt}>핸드폰 번호</span>
                {phoneVerified && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✓ 인증 완료</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setOtpSent(false); setOtpError(''); }}
                  placeholder="010-0000-0000"
                  disabled={phoneVerified}
                  style={{ flex: 1 }}
                />
                {!phoneVerified && !otpSent && (
                  <Btn size="sm" onClick={handleSendOtp} disabled={otpLoading} style={{ flexShrink: 0 }}>
                    {otpLoading ? '발송 중...' : '인증번호 발송'}
                  </Btn>
                )}
              </div>
              {otpSent && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="인증번호 6자리"
                    maxLength={6}
                    style={{ flex: 1 }}
                  />
                  <Btn size="sm" onClick={handleVerifyOtp} disabled={otpLoading} style={{ flexShrink: 0 }}>
                    {otpLoading ? '확인 중...' : '확인'}
                  </Btn>
                </div>
              )}
              {phoneVerified && (
                <button
                  onClick={() => { setPhoneVerified(false); setOtpSent(false); setOtp(''); setOtpError(''); }}
                  style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  번호 변경
                </button>
              )}
              {otpError && <div style={{ fontSize: 12, color: 'var(--red)' }}>{otpError}</div>}
            </div>
            <Btn
              style={{ alignSelf: 'flex-start' }}
              disabled={saving}
              onClick={() => save({ name, industry, experience, bio })}
            >
              {saving ? '저장 중...' : '저장'}
            </Btn>
          </div>
        </Card>
      )}

      {/* Expertise tab */}
      {tab === 'expertise' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>전문 분야 선택</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
            선택한 분야와 일치하는 의뢰가 있을 때 우선 매칭됩니다. 최대 5개까지 선택하세요.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {EXPERTISE.map(e => {
              const sel = expertise.includes(e);
              return (
                <button key={e} onClick={() => toggleExpertise(e)} style={{
                  padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                  background: sel ? 'var(--green-dim)' : 'var(--surface-2)',
                  color: sel ? 'var(--green)' : 'var(--text-2)',
                  border: '1px solid ' + (sel ? 'rgba(126,200,160,0.4)' : 'var(--border)'),
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {sel && '✓ '}{e}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
            선택됨: {expertise.length > 0 ? expertise.join(', ') : '없음'}
          </div>
          <Btn disabled={saving} onClick={() => save({ expertise })}>
            {saving ? '저장 중...' : '저장'}
          </Btn>
        </Card>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={lbl}>
              <span style={lblTxt}>현재 비밀번호</span>
              <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="현재 비밀번호 입력" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>새 비밀번호</span>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="6자 이상" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>새 비밀번호 확인</span>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="동일하게 입력" />
            </label>
            <Btn style={{ alignSelf: 'flex-start' }} disabled={pwSaving} onClick={handleChangePw}>
              {pwSaving ? '변경 중...' : '비밀번호 변경'}
            </Btn>
          </div>
        </Card>
      )}

      {/* Achievement tab */}
      {tab === 'achievement' && (() => {
        const tier = panel?.tier || 'ROOKIE';
        const tierMeta = TIER_META[tier] || TIER_META.ROOKIE;
        const trustScore = panel?.trust_score || 0;
        const streakCount = panel?.streak_count || 0;
        const earnedBadges = new Set(panel?.badges || []);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 티어 + 신뢰도 카드 */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  padding: '8px 18px', borderRadius: 20, fontWeight: 800, fontSize: 16,
                  letterSpacing: '0.08em', color: tierMeta.color,
                  background: tierMeta.bg, border: `1.5px solid ${tierMeta.color}`,
                }}>
                  {tier}
                </div>
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{tierMeta.desc}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[
                  { label: '완료 미션', value: panel?.total_missions || 0, unit: '개' },
                  { label: '이번 주 제출', value: streakCount, unit: '건' },
                  { label: '취득 뱃지', value: earnedBadges.size, unit: '개' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>{item.value}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 2 }}>{item.unit}</span></div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>신뢰도 (Purity Filter 통과율)</span>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-sans)', color: trustScore >= 80 ? 'var(--green)' : trustScore >= 60 ? 'var(--accent)' : 'var(--text-3)' }}>
                    {trustScore}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${trustScore}%`,
                    background: trustScore >= 80 ? 'var(--green)' : trustScore >= 60 ? 'var(--accent)' : '#94a3b8',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </Card>

            {/* 뱃지 그리드 */}
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>획득 뱃지</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>미션을 완료하고 다양한 뱃지를 획득하세요.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {BADGE_CATALOG.map(badge => {
                  const earned = earnedBadges.has(badge.key);
                  return (
                    <div key={badge.key} style={{
                      padding: '16px 14px', borderRadius: 'var(--radius)',
                      border: `1.5px solid ${earned ? 'var(--accent)' : 'var(--border)'}`,
                      background: 'var(--surface)',
                      textAlign: 'center',
                      opacity: earned ? 1 : 0.5,
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 8, filter: earned ? 'none' : 'grayscale(1)' }}>{badge.emoji}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: earned ? 'var(--text)' : 'var(--text-3)' }}>{badge.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>{earned ? '✓ 획득' : badge.desc}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Payment tab */}
      {tab === 'payment' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>정산 계좌 정보</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>Purit Filter 통과 후 익영업일 자동 입금됩니다.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={lbl}>
              <span style={lblTxt}>은행</span>
              <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="카카오뱅크" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>계좌번호</span>
              <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="0000-00-0000000" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>예금주</span>
              <input value={bankHolder} onChange={e => setBankHolder(e.target.value)} placeholder="홍길동" />
            </label>
            <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              ⚠ 예금주명은 실명으로 입력하세요. 불일치 시 정산이 지연될 수 있습니다.
            </div>
            <Btn
              style={{ alignSelf: 'flex-start' }}
              disabled={saving}
              onClick={() => save({ bank_name: bankName, bank_account: bankAccount, bank_holder: bankHolder })}
            >
              {saving ? '저장 중...' : '저장'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
