import { useState, useEffect } from 'react';
import { Card, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const lbl = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };

export default function CompanyAccount() {
  const [tab, setTab] = useState('profile');
  const [company, setCompany] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setEmail(user.email || '');
      const { data: co } = await supabase.from('companies').select('*').eq('user_id', user.id).single();
      if (co) {
        setCompany(co);
        setName(co.name || '');
        setIndustry(co.industry || '');
        setWebsite(co.website || '');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile() {
    if (!company) return;
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('companies')
      .update({ name, industry, website })
      .eq('id', company.id);
    setSaving(false);
    setMsg(error ? '저장 실패: ' + error.message : '저장됐습니다.');
    if (!error) setCompany(c => ({ ...c, name, industry, website }));
    setTimeout(() => setMsg(''), 3000);
  }

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

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>COMPANY · ACCOUNT</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>내 계정</h1>
      </div>

      {/* 프로필 헤더 */}
      <Card style={{ marginBottom: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2, #7EC8A0))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: '#0A0A08', flexShrink: 0,
        }}>
          {(name || email || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{name || '(이름 없음)'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{email}</div>
        </div>
      </Card>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[['profile', '기업 프로필'], ['password', '비밀번호 변경']].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setMsg(''); setPwMsg(''); }} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            borderBottom: `2px solid ${tab === v ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* 피드백 메시지 */}
      {(msg || pwMsg) && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius)', fontSize: 13,
          background: (msg || pwMsg).includes('실패') || (msg || pwMsg).includes('않') ? 'var(--red-dim)' : 'var(--accent-dim, rgba(126,200,160,0.12))',
          color: (msg || pwMsg).includes('실패') || (msg || pwMsg).includes('않') ? 'var(--red)' : 'var(--accent)',
          fontWeight: 600,
        }}>
          {msg || pwMsg}
        </div>
      )}

      {/* 기업 프로필 탭 */}
      {tab === 'profile' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={lbl}>
              <span style={lblTxt}>기업명</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="(주)회사명" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>이메일 (변경 불가)</span>
              <input value={email} disabled style={{ opacity: 0.5 }} />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>업종</span>
              <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="예: SaaS, 이커머스" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>웹사이트</span>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://company.com" />
            </label>
            <Btn style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={handleSaveProfile}>
              {saving ? '저장 중...' : '변경사항 저장'}
            </Btn>
          </div>
        </Card>
      )}

      {/* 비밀번호 변경 탭 */}
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
    </div>
  );
}
