import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, Badge, ConfirmModal } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const ROLE_LABELS = { admin: '관리자', member: '멤버', editor: '편집자', viewer: '뷰어' };
const ROLE_PERMS = {
  editor: ['의뢰 등록·수정', '전체 결과 열람'],
  viewer: ['결과 열람만 가능'],
};

export default function AccountSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('team');
  const [members, setMembers] = useState([]);
  const [company, setCompany] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState(null);

  const NOTIF_KEY = 'purit_notif_prefs';
  const [notif, setNotif] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || { feedbackComplete: true, purityAlert: true, weeklyDigest: false, newMission: true }; }
    catch { return { feedbackComplete: true, purityAlert: true, weeklyDigest: false, newMission: true }; }
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: co } = await supabase.from('companies').select('*').eq('user_id', user.id).single();
      setCompany(co);
      if (co) {
        const [membersRes, invRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', co.id).neq('status', 'inactive').order('joined_at'),
          supabase.from('invoices').select('*').eq('company_id', co.id).order('invoice_date', { ascending: false }).limit(6),
        ]);
        if (!membersRes.error) setMembers(membersRes.data);
        if (!invRes.error) setInvoices(invRes.data);
      }
    } catch (err) {
      console.error('[Settings load]', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !company) return;
    setInviting(true);
    const { data, error } = await supabase.from('team_members').insert({
      company_id: company.id,
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
    }).select().single();
    if (!error) {
      setMembers(m => [...m, data]);
      setInviteEmail('');
    }
    setInviting(false);
  }

  async function handleRemove(id) {
    const { error } = await supabase.from('team_members').update({ status: 'inactive' }).eq('id', id);
    if (!error) setMembers(m => m.filter(x => x.id !== id));
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>데이터 로딩 중…</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>SETTINGS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>계정 설정</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['team', '팀 관리'], ['plan', '플랜 & 결제'], ['notifications', '알림 설정']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v)} style={{
            padding: '10px 20px', fontSize: 13,
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeTab === v ? 'var(--text)' : 'var(--text-3)',
            fontWeight: activeTab === v ? 700 : 500,
            borderBottom: `2px solid ${activeTab === v ? 'var(--text)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* TEAM TAB */}
      {activeTab === 'team' && (
        <div>
          <Card style={{ marginBottom: 24, padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>팀원 초대</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>이메일</div>
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div style={{ width: 160 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>권한</div>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="editor">편집자</option>
                  <option value="viewer">뷰어</option>
                </select>
              </div>
              <Btn size="md" onClick={handleInvite} disabled={inviting}>{inviting ? '전송 중…' : '초대 전송'}</Btn>
            </div>
            {inviteRole && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                {ROLE_LABELS[inviteRole]} 권한: {ROLE_PERMS[inviteRole].join(' · ')}
              </div>
            )}
          </Card>

          {members.length === 0 ? (
            <Card><div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>팀원이 없습니다. 위에서 초대하세요.</div></Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {members.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px',
                  borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: 'var(--text)', flexShrink: 0,
                  }}>
                    {(m.name || m.email)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name || '(이름 없음)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.email}</div>
                  </div>
                  <Badge type={m.status === 'invited' ? 'gray' : m.role === 'editor' ? 'blue' : 'gray'}>
                    {m.status === 'invited' ? '초대됨' : ROLE_LABELS[m.role]}
                  </Badge>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>가입 {m.joined_at}</div>
                  {m.role !== 'admin' && (
                    <Btn size="sm" variant="ghost" style={{ color: 'var(--red)', fontSize: 12 }} onClick={() => setConfirmRemoveMemberId(m.id)}>제거</Btn>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* PLAN TAB */}
      {activeTab === 'plan' && (
        <div>
          <Card style={{ marginBottom: 20, padding: '24px', borderColor: 'var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>현재 플랜</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{company?.plan || 'Starter'} 플랜</div>
              </div>
              <Btn size="sm" variant="outline" onClick={() => navigate('/company/plans')}>플랜 변경</Btn>
            </div>
          </Card>
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>결제 내역</div>
            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>결제 내역 없음</div>
            ) : (
              invoices.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < invoices.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginRight: 12 }}>{r.invoice_date}</span>
                    <span>{r.plan} 플랜</span>
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

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>알림 설정</div>
          {[
            { key: 'feedbackComplete', label: '피드백 수집 완료', desc: '의뢰한 패널이 모두 피드백을 제출하면 알림' },
            { key: 'purityAlert', label: 'Purit Filter 탈락 알림', desc: '피드백이 자동 반려되어 패널이 재배정될 때' },
            { key: 'weeklyDigest', label: '주간 요약 이메일', desc: '매주 월요일 오전 9시, 지난 주 인사이트 요약' },
            { key: 'newMission', label: '신규 의뢰 매칭 완료', desc: '패널 매칭이 시작되면 즉시 알림' },
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
              </div>
              <div
                onClick={() => setNotif(n => { const next = { ...n, [key]: !n[key] }; localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); return next; })}
                style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', background: notif[key] ? 'var(--accent)' : 'var(--border-light)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: notif[key] ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {confirmRemoveMemberId && (
        <ConfirmModal
          title="팀원 제거"
          desc="이 팀원을 제거합니까? 즉시 액세스가 취소되며, 다시 초대하려면 이메일을 재발송해야 합니다."
          confirmLabel="제거"
          onConfirm={() => { handleRemove(confirmRemoveMemberId); setConfirmRemoveMemberId(null); }}
          onCancel={() => setConfirmRemoveMemberId(null)}
          danger
        />
      )}
    </div>
  );
}
