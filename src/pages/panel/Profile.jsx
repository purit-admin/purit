import { useEffect, useState } from 'react';
import { Card, Btn, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const INDUSTRIES = ['이커머스 마케터', 'B2B SaaS 세일즈', '스타트업 PM', 'B2B 영업', '퍼포먼스 마케터', '브랜드 마케터', 'CRO 전문가', '콘텐츠 마케터', '스타트업 대표', '기타'];
const EXPERTISE  = ['랜딩페이지 전환', '카피라이팅', '가격 전략', 'B2B 세일즈 카피', 'UX 설계', '이메일 마케팅', 'SNS 광고', '고객 인터뷰', '데이터 분석'];

const lbl    = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };

export default function PanelProfile() {
  const [panel, setPanel]       = useState(null);
  const [tab, setTab]           = useState('profile');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState('');
  const [loading, setLoading]   = useState(true);

  // form state
  const [name, setName]           = useState('');
  const [industry, setIndustry]   = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio]             = useState('');
  const [expertise, setExpertise] = useState([]);
  const [bankName, setBankName]   = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder]   = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 800, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>PANEL · PROFILE</div>
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
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>완료 미션</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{panel?.total_missions || 0}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[['profile', '기본 정보'], ['expertise', '전문 분야'], ['payment', '정산 계좌']].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setSaved(''); }} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            borderBottom: `2px solid ${tab === v ? 'var(--green)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Feedback */}
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

      {/* Payment tab */}
      {tab === 'payment' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>정산 계좌 정보</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>Purity Filter 통과 후 익영업일 자동 입금됩니다.</div>
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
            <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
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
