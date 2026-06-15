import { useState, useEffect } from 'react';
import { Card, Btn, StatusTabs } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const lbl = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };

export default function AdminAccount() {
  const [tab, setTab] = useState('profile');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setEmail(user.email || '');
        setName(user.user_metadata?.name || '');
        setLoading(false);
      } catch (err) {
        console.error('[AdminAccount load]', err);
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveName() {
    setSaving(true);
    setMsg('');
    const { error } = await supabase.auth.updateUser({ data: { name } });
    setSaving(false);
    setMsg(error ? '저장 실패: ' + error.message : '저장됐습니다.');
    setTimeout(() => setMsg(''), 3000);
  }

  async function handleChangePw() {
    setPwMsg('');
    if (!newPw || newPw.length < 6) { setPwMsg('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    setPwSaving(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: curPw });
      if (signInErr) { setPwMsg('현재 비밀번호가 올바르지 않습니다.'); setPwSaving(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { setPwMsg('변경 실패: ' + error.message); setPwSaving(false); return; }
      setPwMsg('비밀번호가 변경됐습니다.');
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwMsg(''), 3000);
    } catch (err) {
      console.error('[AdminAccount handleChangePw]', err);
      setPwMsg('오류가 발생했습니다. 다시 시도해주세요.');
    }
    setPwSaving(false);
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>ADMIN · ACCOUNT</div>
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
          {(name || email || 'A')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{name || '(이름 없음)'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{email}</div>
        </div>
      </Card>

      {/* 탭 */}
      <StatusTabs
        value={tab}
        onChange={(v) => { setTab(v); setMsg(''); setPwMsg(''); }}
        tabs={[{ key: 'profile', label: '관리자 정보' }, { key: 'password', label: '비밀번호 변경' }]}
        style={{ marginBottom: 24 }}
      />

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

      {/* 관리자 정보 탭 */}
      {tab === 'profile' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={lbl}>
              <span style={lblTxt}>이름</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="관리자 이름" />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>이메일 (변경 불가)</span>
              <input value={email} disabled style={{ opacity: 0.5 }} />
            </label>
            <Btn style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={handleSaveName}>
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
