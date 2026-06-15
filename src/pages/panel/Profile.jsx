import { useEffect, useState } from 'react';
import { Card, Btn, Badge, StatusTabs } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const INDUSTRIES = ['이커머스 마케터', 'B2B SaaS 세일즈', '스타트업 PM', 'B2B 영업', '퍼포먼스 마케터', '브랜드 마케터', 'CRO 전문가', '콘텐츠 마케터', '스타트업 대표', '그로스 마케터', '프로덕트 마케터(PMM)', 'CRM 마케터', 'SNS·소셜 마케터', 'SEO 전문가', 'UX/UI 디자이너', '마케팅 데이터 분석가', '기타'];
const EXPERTISE  = ['랜딩페이지 전환', '카피라이팅', '가격 전략', 'B2B 세일즈 카피', 'UX 설계', '이메일 마케팅', 'SNS 광고', '고객 인터뷰', '데이터 분석'];

const BADGE_CATALOG = [
  { key: '영점_조준',    name: '영점 조준',    tier: 'rookie', hidden: false, desc: 'Purit Filter를 처음으로 통과했습니다.' },
  { key: '유효_타격',    name: '유효 타격',    tier: 'rookie', hidden: false, desc: '기업에게 "도움 됨" 평가를 처음 받았습니다.' },
  { key: '데이터_스캐너', name: '데이터 스캐너', tier: 'rookie', hidden: false, desc: '3가지 이상 의뢰 유형에 모두 참여했습니다.' },
  { key: '제로_데펙트',  name: '제로 데펙트',  tier: 'elite',  hidden: false, desc: '반려 없이 Purit Filter를 연속 10회 통과했습니다.' },
  { key: '크리티컬_샷',  name: '크리티컬 샷',  tier: 'elite',  hidden: false, desc: '30일 이내 "도움 됨"을 10회 이상 받았습니다.' },
  { key: '트렌드_오라클', name: '트렌드 오라클', tier: 'elite',  hidden: false, desc: 'A/B 소재에서 최다 선택 소재를 연속 10회 맞혔습니다.' },
  { key: '절대_영도',    name: '절대 영도',    tier: 'master', hidden: false, desc: '미션 50회 이상 + "도움 됨" 비율 상위 1%.' },
  { key: '픽셀_아키텍트', name: '픽셀 아키텍트', tier: 'master', hidden: false, desc: '이미지 기반 피드백으로 "도움 됨" 30회 이상.' },
  { key: '에이펙스_노드', name: '에이펙스 노드', tier: 'master', hidden: false, desc: '프리미엄 기업 의뢰에서 "도움 됨"을 3회 이상 받았습니다.' },
  { key: '마이크로스코프', name: '마이크로스코프', tier: 'hidden', hidden: true,  desc: '...조건이 숨겨져 있습니다.' },
  { key: '퀵_타겟팅',    name: '퀵 타겟팅',   tier: 'hidden', hidden: true,  desc: '...조건이 숨겨져 있습니다.' },
  { key: '블랙_스완',    name: '블랙 스완',   tier: 'hidden', hidden: true,  desc: '...조건이 숨겨져 있습니다.' },
  // ── v3 추가 뱃지 ──────────────────────────────────────────────────────────
  { key: '첫_발사',     name: '첫 발사',     tier: 'rookie', hidden: false, desc: '첫 번째 피드백을 제출했습니다.' },
  { key: '삼연타',      name: '삼연타',      tier: 'rookie', hidden: false, desc: '30일 이내 Purit Filter를 3회 이상 통과했습니다.' },
  { key: '댓글_장인',   name: '댓글 장인',   tier: 'elite',  hidden: false, desc: '300자 이상 상세한 피드백으로 Purit Filter를 10회 이상 통과했습니다.' },
  { key: '스피드런',    name: '스피드런',    tier: 'elite',  hidden: false, desc: '7일 이내 Purit Filter를 5회 이상 통과했습니다.' },
  { key: '듀얼_코어',   name: '듀얼 코어',   tier: 'elite',  hidden: false, desc: '메인 의뢰와 서브 의뢰 각각 5건 이상 Purit Filter를 통과했습니다.' },
  { key: '센추리',      name: '센추리',      tier: 'master', hidden: false, desc: 'Purit Filter를 누적 100회 이상 통과했습니다.' },
  { key: '인사이트_코어', name: '인사이트 코어', tier: 'master', hidden: false, desc: "기업에게 '도움 됨' 평가를 누적 50회 이상 받았습니다." },
];

const TIER_STYLES = {
  rookie: {
    earned:   { background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' },
    unearned: { background: 'transparent', color: '#CBD5E1', border: '1px dashed #E2E8F0' },
  },
  elite: {
    earned:   { background: '#EEF2FF', color: '#1E40AF', border: '1px solid #BFDBFE' },
    unearned: { background: 'transparent', color: '#CBD5E1', border: '1px dashed #E2E8F0' },
  },
  master: {
    earned:   { background: '#0A0A0A', color: '#F1F5F9', border: '1px solid #3D3D3D' },
    unearned: { background: 'transparent', color: '#CBD5E1', border: '1px dashed #E2E8F0' },
  },
  hidden: {
    earned:   { background: '#0D1B2A', color: '#BAE6FD', border: '1px solid #38BDF8', fontStyle: 'italic' },
    unearned: { background: '#F0F9FF', color: '#7DD3FC', border: '1px solid #BAE6FD' },
  },
};

const TIER_SECTION_LABEL = { rookie: 'ROOKIE', elite: 'ELITE', master: 'MASTER', hidden: 'HIDDEN' };
const TIER_ORDER = ['rookie', 'elite', 'master', 'hidden'];

function BadgeTag({ badge, earned, isSelected, onSelect }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showSetBtn, setShowSetBtn]   = useState(false);
  const styles   = TIER_STYLES[badge.tier];
  const baseStyle = earned ? styles.earned : styles.unearned;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => { setShowSetBtn(earned); }}
      onMouseLeave={() => { setShowTooltip(false); setShowSetBtn(false); }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
        cursor: earned ? 'pointer' : 'default', transition: 'all 0.15s',
        outline: isSelected ? '2px solid #3B82F6' : 'none', outlineOffset: 2,
        ...baseStyle,
      }}
        onClick={() => earned && onSelect(badge.key)}
      >
        {(!earned && badge.hidden) ? '🔒 ???' : badge.name}
        <span
          style={{ fontSize: 11, opacity: 0.6, cursor: 'help', lineHeight: 1 }}
          onMouseEnter={e => { e.stopPropagation(); setShowTooltip(true); }}
          onMouseLeave={() => setShowTooltip(false)}
        >ⓘ</span>
      </div>

      {showTooltip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          marginBottom: 6,
          background: '#0F172A', color: '#fff', fontSize: 12, lineHeight: 1.6,
          padding: '8px 12px', borderRadius: 8,
          width: 'max-content', maxWidth: 260, whiteSpace: 'normal', wordBreak: 'keep-all',
          zIndex: 100, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {(!earned && badge.hidden)
            ? '이 뱃지의 달성 조건은 숨겨져 있습니다'
            : badge.desc}
        </div>
      )}

      {showSetBtn && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%',
          transform: 'translateX(-50%)', marginTop: 4,
          background: isSelected ? '#3B82F6' : '#1E293B',
          color: '#fff', fontSize: 11, fontWeight: 600,
          padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap',
          cursor: 'pointer', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
          onClick={() => onSelect(badge.key)}
        >
          {isSelected ? '✓ 대표 뱃지 해제' : '대표 뱃지로 설정'}
        </div>
      )}
    </div>
  );
}

const lbl    = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };

// 2-4년: 1.0×(gray), 5-7년: 1.5×(navy), 8-14년: 2.0×(amber), 15년+: 3.0×(헤드)
function getYearTier(y) {
  if (y >= 15) return { color: '#92400E', bg: '#FDE68A', mult: '3.0×' };
  if (y >= 8)  return { color: '#D97706', bg: '#FEF3C7', mult: '2.0×' };
  if (y >= 5)  return { color: 'var(--accent)', bg: 'var(--accent-dim)', mult: '1.5×' };
  return { color: 'var(--text-3)', bg: 'var(--bg-3)', mult: '1.0×' };
}

function ExperienceBar({ value, onChange }) {
  const match = (value || '').match(/(\d+)/);
  const selected = match ? parseInt(match[1], 10) : 0;
  const tier = selected > 0 ? getYearTier(selected) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(y => {
          const t = getYearTier(y);
          const active = y <= selected;
          return (
            <button
              key={y}
              type="button"
              onClick={() => onChange(`${y}년`)}
              style={{
                flex: 1, height: 30, borderRadius: 5, border: 'none',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                transition: 'all 0.15s',
                background: active ? t.color : 'var(--bg-3)',
                color: active ? '#fff' : 'var(--text-3)',
              }}
            >{y}</button>
          );
        })}
      </div>
      {tier ? (
        <div style={{ marginTop: 8, fontSize: 12, color: tier.color, fontWeight: 600 }}>
          {selected}년차 · 미션비 {tier.mult} 배율 적용
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
          경력을 선택하면 미션비 배율이 적용됩니다
        </div>
      )}
    </div>
  );
}

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
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [phone, setPhone]             = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent]         = useState(false);
  const [otp, setOtp]                 = useState('');
  const [otpLoading, setOtpLoading]   = useState(false);
  const [otpError, setOtpError]       = useState('');

  const [notifPrefs, setNotifPrefs] = useState({});

  const [orig, setOrig]           = useState(null);
  const [dirtyWarn, setDirtyWarn] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  useEffect(() => {
    async function load() {
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
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
        setSelectedBadge(p.selected_badge || null);
        setNotifPrefs(p.notif_prefs || {});
        setOrig({
          name: p.name || '', industry: p.industry || '',
          experience: p.experience || '', bio: p.bio || '',
          expertise: p.expertise || [],
          bankName: p.bank_name || '', bankAccount: p.bank_account || '', bankHolder: p.bank_holder || '',
        });
      }
      setLoading(false);
      } catch (err) {
        console.error('[PanelProfile load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  const save = async (fields) => {
    if (!panel) return;
    setSaved('');
    if ('name' in fields && fields.name.trim()) {
      const { data: taken } = await supabase.rpc('check_panel_name_taken', {
        p_name: fields.name.trim(),
        p_exclude_id: panel.id,
      });
      if (taken) {
        setSaved('이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.');
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from('panels')
      .update(fields)
      .eq('id', panel.id);
    setSaving(false);
    if (error) {
      setSaved('저장 실패: ' + error.message);
    } else {
      setPanel(p => ({ ...p, ...fields }));
      if ('name' in fields) setOrig(o => ({ ...o, name, industry, experience, bio, expertise: [...expertise] }));
      if ('bank_name' in fields) setOrig(o => ({ ...o, bankName, bankAccount, bankHolder }));
      setDirtyWarn(false);
      setPendingTab(null);
      setSaved('저장됐습니다.');
      setTimeout(() => setSaved(''), 2500);
    }
  };

  const toggleExpertise = (e) =>
    setExpertise(prev =>
      prev.includes(e) ? prev.filter(x => x !== e) : prev.length >= 5 ? prev : [...prev, e]
    );

  const isDirty = orig ? (() => {
    if (tab === 'profile') return name !== orig.name || industry !== orig.industry || experience !== orig.experience || bio !== orig.bio || JSON.stringify([...expertise].sort()) !== JSON.stringify([...orig.expertise].sort());
    if (tab === 'payment') return bankName !== orig.bankName || bankAccount !== orig.bankAccount || bankHolder !== orig.bankHolder;
    return false;
  })() : false;

  const handleTabClick = (v) => {
    if (isDirty && v !== tab) {
      setDirtyWarn(true);
      setPendingTab(v);
      return;
    }
    setTab(v);
    setSaved('');
    setPwMsg('');
    setDirtyWarn(false);
    setPendingTab(null);
  };

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
            {(() => {
              const earnedSet = new Set(panel?.badges || []);
              const meta = selectedBadge && earnedSet.has(selectedBadge)
                ? BADGE_CATALOG.find(b => b.key === selectedBadge)
                : null;
              if (meta) {
                const s = TIER_STYLES[meta.tier].earned;
                return (
                  <span style={{ ...s, padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                    {meta.name}
                  </span>
                );
              }
              return null;
            })()}
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
      <StatusTabs
        value={tab}
        onChange={handleTabClick}
        tabs={[
          { key: 'profile', label: '기본 정보' }, { key: 'achievement', label: '성과' },
          { key: 'payment', label: '정산 계좌' }, { key: 'password', label: '비밀번호' },
          { key: 'notifications', label: '알림 설정' },
        ]}
        style={{ marginBottom: 24 }}
      />

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
        (saved.startsWith('저장 실패') || saved.startsWith('이미 사용')) ? (
          <div style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius)', fontSize: 13,
            background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontWeight: 600,
          }}>
            {saved}
          </div>
        ) : (
          <div style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
            padding: '12px 20px', borderRadius: 10, fontSize: 14,
            background: '#0F172A', color: '#fff', fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✓ {saved}
          </div>
        )
      )}
      {dirtyWarn && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)',
          background: '#FFFBEB', border: '1px solid #F59E0B',
          fontSize: 13, color: '#92400E',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span>⚠ 저장하지 않은 변경사항이 있습니다.</span>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => { setDirtyWarn(false); setPendingTab(null); }}
              style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >계속 편집</button>
            <button
              onClick={() => {
                if (tab === 'profile') { setName(orig.name); setIndustry(orig.industry); setExperience(orig.experience); setBio(orig.bio); setExpertise([...orig.expertise]); }
                else if (tab === 'payment') { setBankName(orig.bankName); setBankAccount(orig.bankAccount); setBankHolder(orig.bankHolder); }
                setTab(pendingTab); setPendingTab(null); setDirtyWarn(false); setSaved(''); setPwMsg('');
              }}
              style={{ fontSize: 12, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
            >저장하지 않고 이동 →</button>
          </div>
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
            <div style={lbl}>
              <span style={lblTxt}>전문 분야 <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>(최대 5개)</span></span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EXPERTISE.map(e => {
                  const sel = expertise.includes(e);
                  return (
                    <button key={e} type="button" onClick={() => toggleExpertise(e)} style={{
                      padding: '7px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
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
            </div>
            <div style={lbl}>
              <span style={lblTxt}>경력</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    {(panel?.experience_years ?? 0) >= 15
                      ? '헤드'
                      : (panel?.experience_years != null
                          ? `${panel.experience_years}년차`
                          : (experience || '미입력'))}
                  </span>
                  {panel?.experience_confirmed_at
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>✓ 확정됨</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>어드민 확정 대기</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  경력은 가입 시 제출한 자격득실 확인서를 바탕으로 어드민이 확정하는 항목으로, 직접 변경할 수 없습니다. 변경이 필요하면 버그/불편 신고에서 문의해 주세요.
                </div>
              </div>
            </div>
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
              onClick={() => save({ name, industry, bio, expertise })}
            >
              {saving ? '저장 중...' : '저장'}
            </Btn>
          </div>
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
        const trustScore  = panel?.trust_score || 0;
        const streakCount = panel?.streak_count || 0;
        const earnedSet   = new Set(panel?.badges || []);
        const earnedCount = BADGE_CATALOG.filter(b => earnedSet.has(b.key)).length;

        const handleSelectBadge = async (key) => {
          if (!panel) return;
          const prev = selectedBadge;
          const newVal = selectedBadge === key ? null : key;
          setSelectedBadge(newVal);
          const { error } = await supabase.from('panels').update({ selected_badge: newVal }).eq('id', panel.id);
          if (error) setSelectedBadge(prev);
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 요약 카드 */}
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[
                  { label: '완료 미션',  value: panel?.total_missions || 0, unit: '개' },
                  { label: '이번 주 제출', value: streakCount,              unit: '건' },
                  { label: '취득 뱃지',  value: earnedCount,                unit: '개' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>{item.value}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 2 }}>{item.unit}</span></div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>신뢰도 (Purity Filter 통과율)</span>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-sans)', color: trustScore >= 80 ? 'var(--green)' : trustScore >= 60 ? 'var(--accent)' : 'var(--text-3)' }}>{trustScore}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${trustScore}%`, background: trustScore >= 80 ? 'var(--green)' : trustScore >= 60 ? 'var(--accent)' : '#94a3b8', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            </Card>

            {/* 뱃지 목록 */}
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>뱃지 컬렉션</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>획득한 뱃지를 클릭해 대표 뱃지로 설정하세요. 닉네임 옆에 표시됩니다.</div>

              {TIER_ORDER.map(tier => {
                const tierBadges = BADGE_CATALOG.filter(b => b.tier === tier);
                return (
                  <div key={tier} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 10 }}>
                      {TIER_SECTION_LABEL[tier]}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {tierBadges.map(badge => (
                        <BadgeTag
                          key={badge.key}
                          badge={badge}
                          earned={earnedSet.has(badge.key)}
                          isSelected={selectedBadge === badge.key}
                          onSelect={handleSelectBadge}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })()}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>알림 설정</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>알림을 끄면 해당 유형의 앱 알림이 발송되지 않습니다.</div>
          {[
            { key: 'feedbackApproved', label: '피드백 승인', desc: '제출한 피드백이 Purit Filter를 통과해 승인됐을 때' },
            { key: 'feedbackRejected', label: '피드백 반려', desc: '제출한 피드백이 기준 미달로 반려됐을 때 (재작성 안내 포함)' },
            { key: 'deadlineWarning', label: '마감 임박 알림', desc: '제출 또는 재제출 마감 1시간 전 사전 안내' },
          ].map(({ key, label, desc }) => {
            const on = notifPrefs[key] !== false;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
                </div>
                <div
                  onClick={async () => {
                    if (!panel) return;
                    const next = { ...notifPrefs, [key]: !on };
                    setNotifPrefs(next);
                    const { error } = await supabase.from('panels').update({ notif_prefs: next }).eq('id', panel.id);
                    if (error) { console.error('[notif pref]', error.message); setNotifPrefs(notifPrefs); }
                  }}
                  style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', background: on ? 'var(--accent)' : 'var(--border-light)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

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
