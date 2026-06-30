import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, Badge, StatusTabs } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';

const lbl = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };

// 알림 설정 — 대분류(category) > 소분류(item) 구조
const NOTIF_CATEGORIES = [
  {
    title: '결과 공개 알림',
    desc: '피드백 결과를 열람할 수 있게 됐을 때 받는 알림입니다.',
    items: [
      { key: 'missionComplete', label: '의뢰 완료 결과 공개',        desc: '어드민이 의뢰 완료 처리 후 피드백 결과를 열람할 수 있게 됐을 때' },
      { key: 'earlyComplete',   label: '조기 종료 피드백 결과 공개', desc: '조기 종료된 의뢰의 피드백 검토가 완료돼 결과를 열람할 수 있게 됐을 때' },
    ],
  },
  {
    title: '의뢰 진행 알림',
    desc: '진행 중인 의뢰의 상태가 바뀔 때 받는 알림입니다.',
    items: [
      { key: 'missionStatusChange', label: '의뢰 취소 · 재개 · 재진행', desc: '진행 중인 의뢰의 상태가 어드민에 의해 변경됐을 때' },
    ],
  },
];

export default function CompanyAccount() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [company, setCompany] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [notifPrefs, setNotifPrefs] = useState({});
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamRole, setTeamRole] = useState(null); // null=오너, 'editor'|'viewer'=팀원
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [orig, setOrig] = useState(null);
  const [dirtyWarn, setDirtyWarn] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [isOAuth, setIsOAuth] = useState(false); // 소셜 로그인(google 등) 계정 — 비밀번호 없음 → 비번 탭 숨김
  const [notifError, setNotifError] = useState(''); // 알림 토글 저장 실패 안내 (무음 롤백 방지)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setEmail(user.email || '');
        // 화이트리스트 판별 — 알려진 OAuth provider만 true, 이메일·레거시(미설정)는 false(탭 유지, 안전한 기본값)
        setIsOAuth(['google', 'linkedin_oidc'].includes(user.app_metadata?.provider));
        const { company: co, teamRole: tr } = await resolveCompany(user.id);
        setTeamRole(tr);
        if (co) {
          setCompany(co);
          setName(co.name || '');
          setContactName(co.contact_name || '');
          setIndustry(co.industry || '');
          setWebsite(co.website || '');
          setOrig({ name: co.name || '', contactName: co.contact_name || '', industry: co.industry || '', website: co.website || '' });
          setNotifPrefs(co.notif_prefs || {});
          const { data: invRes } = await supabase
            .from('invoices').select('*').eq('company_id', co.id)
            .order('invoice_date', { ascending: false });
          if (invRes) setInvoices(invRes);
        }
      } catch (err) {
        console.error('[Account load]', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveProfile() {
    if (!company) return;
    if (teamRole !== null) return; // 팀원은 기업 프로필 수정 불가
    setMsg('');
    if (name.trim()) {
      const { data: taken, error: chkErr } = await supabase.rpc('check_company_name_taken', {
        p_name: name.trim(),
        p_exclude_id: company.id,
      });
      if (chkErr) {
        setMsg('이름 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      if (taken) {
        setMsg('이미 사용 중인 기업명입니다. 다른 이름을 입력해주세요.');
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from('companies')
      .update({ name, contact_name: contactName, industry, website })
      .eq('id', company.id);
    setSaving(false);
    setMsg(error ? '저장 실패: ' + error.message : '저장됐습니다.');
    if (!error) {
      setCompany(c => ({ ...c, name, contact_name: contactName, industry, website }));
      setOrig({ name, contactName, industry, website });
    }
    setTimeout(() => setMsg(''), 3000);
  }

  const isDirty = orig && tab === 'profile'
    ? (name !== orig.name || contactName !== orig.contactName || industry !== orig.industry || website !== orig.website)
    : false;

  const handleTabClick = (v) => {
    if (isDirty && v !== tab) {
      setDirtyWarn(true);
      setPendingTab(v);
      return;
    }
    setTab(v);
    setMsg('');
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

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중...</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 720, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>COMPANY · ACCOUNT</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>내 계정 & 설정</h1>
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
      <StatusTabs
        value={tab}
        onChange={handleTabClick}
        tabs={[{ key: 'profile', label: '기업 프로필' }, ...(isOAuth ? [] : [{ key: 'password', label: '비밀번호 변경' }]), { key: 'plan', label: '플랜 & 결제' }, { key: 'notifications', label: '알림 설정' }]}
        style={{ marginBottom: 24 }}
      />

      {/* 미저장 경고 */}
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
                setName(orig.name); setContactName(orig.contactName); setIndustry(orig.industry); setWebsite(orig.website);
                setTab(pendingTab); setPendingTab(null); setDirtyWarn(false); setMsg(''); setPwMsg('');
              }}
              style={{ fontSize: 12, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
            >저장하지 않고 이동 →</button>
          </div>
        </div>
      )}

      {/* 피드백 메시지 */}
      {(msg || pwMsg) && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius)', fontSize: 13,
          background: (msg || pwMsg).includes('실패') || (msg || pwMsg).includes('않') || (msg || pwMsg).includes('이미') ? 'var(--red-dim)' : 'var(--accent-dim, rgba(126,200,160,0.12))',
          color: (msg || pwMsg).includes('실패') || (msg || pwMsg).includes('않') || (msg || pwMsg).includes('이미') ? 'var(--red)' : 'var(--accent)',
          fontWeight: 600,
        }}>
          {msg || pwMsg}
        </div>
      )}

      {/* 기업 프로필 탭 */}
      {tab === 'profile' && (
        <Card>
          {teamRole !== null && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(16,54,125,0.06)', color: 'var(--text-2)', fontSize: 13 }}>
              🔒 기업 프로필 수정은 계정 오너만 가능합니다. (현재: {teamRole === 'editor' ? '편집자' : '뷰어'})
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={lbl}>
              <span style={lblTxt}>기업명</span>
              <input value={name} onChange={e => teamRole === null && setName(e.target.value)} placeholder="(주)회사명" disabled={teamRole !== null} style={teamRole !== null ? { opacity: 0.6 } : {}} />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>담당자 이름</span>
              <input value={contactName} onChange={e => teamRole === null && setContactName(e.target.value)} placeholder="홍길동" disabled={teamRole !== null} style={teamRole !== null ? { opacity: 0.6 } : {}} />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>이메일 (변경 불가)</span>
              <input value={email} disabled style={{ opacity: 0.5 }} />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>업종</span>
              <input value={industry} onChange={e => teamRole === null && setIndustry(e.target.value)} placeholder="예: SaaS, 이커머스" disabled={teamRole !== null} style={teamRole !== null ? { opacity: 0.6 } : {}} />
            </label>
            <label style={lbl}>
              <span style={lblTxt}>웹사이트</span>
              <input value={website} onChange={e => teamRole === null && setWebsite(e.target.value)} placeholder="https://company.com" disabled={teamRole !== null} style={teamRole !== null ? { opacity: 0.6 } : {}} />
            </label>
            {teamRole === null && (
              <Btn style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={handleSaveProfile}>
                {saving ? '저장 중...' : '변경사항 저장'}
              </Btn>
            )}
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

      {/* 플랜 & 결제 탭 */}
      {tab === 'plan' && (
        <div>
          <Card style={{ marginBottom: 20, padding: '24px', borderColor: 'var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>현재 플랜</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{(company?.plan === 'free_trial' ? '무료체험' : company?.plan) || 'Starter'} 플랜</div>
              </div>
              <Btn size="sm" variant="outline" onClick={() => navigate('/company/plans')}>플랜 변경</Btn>
            </div>
          </Card>
          {company?.subscription_cancel_at_period_end && (
            <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 'var(--radius)', background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>
              구독이 <strong>{company?.next_billing_at ? new Date(company.next_billing_at).toLocaleDateString('ko-KR') : '결제 주기 종료일'}</strong>에 해지될 예정입니다. 그때까지 모든 기능을 이용할 수 있어요.{' '}
              <span onClick={() => navigate('/company/plans')} style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>구독 관리 →</span>
            </div>
          )}
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>결제 내역</div>
            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>결제 내역 없음</div>
            ) : (
              invoices.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < invoices.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginRight: 12 }}>{r.invoice_date}</span>
                    {r.payment_type === 'credits'
                      ? <span>크레딧 <strong>{r.credits_amount}cr</strong> 충전</span>
                      : <span>{r.plan} 플랜</span>
                    }
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700 }}>₩{Number(r.amount).toLocaleString()}</span>
                    <Badge type={r.status === 'paid' ? 'green' : 'red'}>{r.status === 'paid' ? '완료' : '미수금'}</Badge>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {/* 알림 설정 탭 — 대분류 > 소분류 */}
      {tab === 'notifications' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>알림 설정</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>알림을 끄면 해당 유형의 앱 알림이 발송되지 않습니다.</div>
          {notifError && <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginBottom: 16 }}>{notifError}</div>}
          {NOTIF_CATEGORIES.map((cat, ci) => (
            <div key={cat.title} style={{ marginBottom: ci < NOTIF_CATEGORIES.length - 1 ? 28 : 0 }}>
              {/* 대분류 헤더 */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{cat.title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{cat.desc}</span>
              </div>
              {/* 소분류 토글 목록 */}
              <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--accent-dim)' }}>
                {cat.items.map(({ key, label, desc }, ii) => {
                  const on = notifPrefs[key] !== false;
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: ii < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
                      </div>
                      <div
                        onClick={async () => {
                          if (!company) return;
                          const next = { ...notifPrefs, [key]: !on };
                          setNotifPrefs(next);
                          const { error } = await supabase.from('companies').update({ notif_prefs: next }).eq('id', company.id);
                          if (error) { console.error('[notif pref]', error.message); setNotifPrefs(notifPrefs); setNotifError('알림 설정 저장에 실패했습니다. 다시 시도해주세요.'); }
                          else setNotifError('');
                        }}
                        style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', background: on ? 'var(--accent)' : 'var(--border-light)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                      >
                        <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
