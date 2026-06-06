import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, Badge, ConfirmModal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';

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
  const [user, setUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState(null);
  const [roleChangeError, setRoleChangeError] = useState('');

  const [notifPrefs, setNotifPrefs] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const { company: co, teamRole: tr } = await resolveCompany(user.id);
      setCompany(co);
      setIsOwner(tr === null);
      if (co) {
        setNotifPrefs(co.notif_prefs || {});
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
    if (!isOwner) return; // 오너만 팀원 초대 가능
    if (!inviteEmail.trim() || !company) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. DB INSERT (토큰 포함)
    const { data, error } = await supabase.from('team_members').insert({
      company_id: company.id,
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
      invite_token: inviteToken,
      invite_expires_at: expiresAt,
    }).select().single();

    if (error) {
      setInviteError('초대 실패: ' + error.message);
      setInviting(false);
      return;
    }

    // 2. 이메일 발송 Edge Function 호출
    const inviteUrl = `${window.location.origin}/invite?token=${inviteToken}`;
    const inviterName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || '관리자';

    const { error: fnError } = await supabase.functions.invoke('send-invite-email', {
      body: {
        to: inviteEmail.trim(),
        companyName: company.name || '회사',
        inviterName,
        role: inviteRole,
        inviteUrl,
      },
    });

    setMembers(m => [...m, data]);
    setInviteEmail('');

    if (fnError) {
      // 이메일 발송 실패해도 DB 레코드는 유지 — 링크를 직접 공유할 수 있도록 안내
      setInviteSuccess(`초대 링크가 생성됐습니다. 아래 링크를 직접 공유하세요. (7일 후 만료)\n${inviteUrl}`);
    } else {
      setInviteSuccess(`${inviteEmail.trim()}으로 초대 이메일을 발송했습니다. (7일 후 만료)`);
    }

    setInviting(false);
  }

  async function handleRemove(id) {
    const { error } = await supabase.from('team_members').update({ status: 'inactive' }).eq('id', id);
    if (error) throw new Error('팀원 제거 실패: ' + error.message);
    setMembers(m => m.filter(x => x.id !== id));
    setRemoveError('');
  }

  async function handleChangeRole(id, newRole) {
    const prevMembers = members;
    setMembers(m => m.map(x => x.id === id ? { ...x, role: newRole } : x));
    const { error } = await supabase.from('team_members').update({ role: newRole }).eq('id', id);
    if (error) {
      setMembers(prevMembers);
      setRoleChangeError('역할 변경 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setTimeout(() => setRoleChangeError(''), 3000);
    }
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
          {!isOwner && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(16,54,125,0.06)', color: 'var(--text-2)', fontSize: 13 }}>
              팀원은 팀 구성원 목록을 볼 수 있지만, 초대·제거는 오너만 가능합니다.
            </div>
          )}
          {isOwner && <Card style={{ marginBottom: 24, padding: '22px 24px' }}>
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
              {isOwner && <Btn size="md" onClick={handleInvite} disabled={inviting}>{inviting ? '전송 중…' : '초대 전송'}</Btn>}
            </div>
            {inviteSuccess && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(16,185,129,0.08)', color: '#059669', fontSize: 13, fontWeight: 600 }}>
                ✓ {inviteSuccess}
              </div>
            )}
            {inviteError && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 13, fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {inviteError}
              </div>
            )}
            {inviteRole && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                {ROLE_LABELS[inviteRole]} 권한: {ROLE_PERMS[inviteRole].join(' · ')}
              </div>
            )}
          </Card>}

          {removeError && (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 13, fontWeight: 600 }}>
              {removeError}
            </div>
          )}
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
                  {/* 활성 팀원이고 오너라면 역할 드롭다운, 그 외엔 뱃지 */}
                  {isOwner && m.status === 'active' && m.role !== 'admin' ? (
                    <select
                      value={m.role}
                      onChange={e => handleChangeRole(m.id, e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <option value="editor">편집자</option>
                      <option value="viewer">뷰어</option>
                    </select>
                  ) : (
                    <Badge type={m.status === 'invited' ? 'gray' : m.role === 'editor' ? 'blue' : 'gray'}>
                      {m.status === 'invited' ? '초대됨' : ROLE_LABELS[m.role]}
                    </Badge>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {m.status === 'invited' ? '초대 발송됨' : `가입 ${m.joined_at ? new Date(m.joined_at).toLocaleDateString('ko-KR') : '-'}`}
                  </div>
                  {isOwner && m.role !== 'admin' && (
                    <Btn size="sm" variant="ghost" style={{ color: 'var(--red)', fontSize: 12 }} onClick={() => setConfirmRemoveMemberId(m.id)}>제거</Btn>
                  )}
                </div>
              ))}
            </Card>
          )}
          {roleChangeError && (
            <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.08)', color: 'var(--red,#ef4444)', fontSize: 13, fontWeight: 500 }}>
              {roleChangeError}
            </div>
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
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>알림 설정</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>알림을 끄면 해당 유형의 앱 알림이 발송되지 않습니다.</div>
          {[
            { key: 'missionComplete',    label: '의뢰 완료 결과 공개',        desc: '어드민이 의뢰 완료 처리 후 피드백 결과를 열람할 수 있게 됐을 때' },
            { key: 'missionStatusChange', label: '의뢰 취소 · 재개 · 재진행', desc: '진행 중인 의뢰의 상태가 어드민에 의해 변경됐을 때' },
            { key: 'earlyComplete',      label: '조기 종료 피드백 결과 공개', desc: '조기 종료된 의뢰의 피드백 검토가 완료돼 결과를 열람할 수 있게 됐을 때' },
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
                    if (!company) return;
                    const next = { ...notifPrefs, [key]: !on };
                    setNotifPrefs(next);
                    const { error } = await supabase.from('companies').update({ notif_prefs: next }).eq('id', company.id);
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

      {confirmRemoveMemberId && (
        <ConfirmModal
          title="팀원 제거"
          desc="이 팀원을 제거합니까? 즉시 액세스가 취소되며, 다시 초대하려면 이메일을 재발송해야 합니다."
          confirmLabel="제거"
          errorMsg={removeError}
          onConfirm={async () => { try { await handleRemove(confirmRemoveMemberId); setRemoveError(''); setConfirmRemoveMemberId(null); } catch (err) { setRemoveError(err.message); } }}
          onCancel={() => { setRemoveError(''); setConfirmRemoveMemberId(null); }}
          danger
        />
      )}
    </div>
  );
}
