import { useState } from 'react';
import { Card, Btn, Badge } from '../../components/ui';

const TEAM_MEMBERS = [
  { id: 'm1', name: '홍길동', email: 'gd.hong@urbanfit.kr', role: 'admin', joinedAt: '2024-02-01', status: 'active' },
  { id: 'm2', name: '이마케팅', email: 'mk.lee@urbanfit.kr', role: 'member', joinedAt: '2024-05-10', status: 'active' },
  { id: 'm3', name: '김인턴', email: 'intern@urbanfit.kr', role: 'viewer', joinedAt: '2025-07-01', status: 'active' },
];

const ROLE_LABELS = { admin: '관리자', member: '멤버', viewer: '뷰어만' };
const ROLE_PERMS = {
  admin: ['의뢰 등록·수정·삭제', '팀원 관리', '결제·플랜 변경', '전체 결과 열람'],
  member: ['의뢰 등록·수정', '전체 결과 열람'],
  viewer: ['결과 열람만 가능'],
};

export default function AccountSettings() {
  const [activeTab, setActiveTab] = useState('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [notif, setNotif] = useState({
    feedbackComplete: true,
    purityAlert: true,
    weeklyDigest: false,
    newMission: true,
  });

  return (
    <div style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>SETTINGS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>계정 설정</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['team', '팀 관리'], ['plan', '플랜 & 결제'], ['notifications', '알림 설정'], ['profile', '기업 프로필']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeTab === v ? 'var(--text)' : 'var(--text-3)',
            borderBottom: `2px solid ${activeTab === v ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* TEAM TAB */}
      {activeTab === 'team' && (
        <div>
          {/* Invite */}
          <Card style={{ marginBottom: 24, padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>팀원 초대</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>이메일</div>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
              </div>
              <div style={{ width: 160 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>권한</div>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="admin">관리자</option>
                  <option value="member">멤버</option>
                  <option value="viewer">뷰어만</option>
                </select>
              </div>
              <Btn size="md" onClick={() => { setInviteEmail(''); }}>초대 전송</Btn>
            </div>
            {inviteRole && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                {ROLE_LABELS[inviteRole]} 권한: {ROLE_PERMS[inviteRole].join(' · ')}
              </div>
            )}
          </Card>

          {/* Member list */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {TEAM_MEMBERS.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px',
                borderBottom: i < TEAM_MEMBERS.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {m.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.email}</div>
                </div>
                <Badge type={m.role === 'admin' ? 'gold' : m.role === 'member' ? 'blue' : 'gray'}>{ROLE_LABELS[m.role]}</Badge>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>가입 {m.joinedAt}</div>
                {m.role !== 'admin' && (
                  <Btn size="sm" variant="ghost" style={{ color: 'var(--red)', fontSize: 12 }}>제거</Btn>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* PLAN TAB */}
      {activeTab === 'plan' && (
        <div>
          <Card style={{ marginBottom: 20, padding: '24px', borderColor: 'var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>현재 플랜</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Pro 플랜</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>월 ₩1,980,000 · 연간 결제 · 2026년 2월 28일 갱신</div>
              </div>
              <Btn size="sm" variant="outline">플랜 변경</Btn>
            </div>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: '이번 달 의뢰', value: '2 / 20회' },
                { label: '팀원', value: '3 / 5명' },
                { label: '남은 기간', value: '226일' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>결제 내역</div>
            {[
              { date: '2025-07-01', desc: 'Pro 플랜 (7월)', amount: '₩1,980,000', status: '완료' },
              { date: '2025-06-01', desc: 'Pro 플랜 (6월)', amount: '₩1,980,000', status: '완료' },
              { date: '2025-05-01', desc: 'Pro 플랜 (5월)', amount: '₩1,980,000', status: '완료' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginRight: 12 }}>{r.date}</span>
                  <span>{r.desc}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.amount}</span>
                  <Badge type="green">{r.status}</Badge>
                  <Btn size="sm" variant="ghost" style={{ fontSize: 11 }}>영수증</Btn>
                </div>
              </div>
            ))}
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
              {/* Toggle */}
              <div
                onClick={() => setNotif(n => ({ ...n, [key]: !n[key] }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                  background: notif[key] ? 'var(--accent)' : 'var(--border-light)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: notif[key] ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>기업 프로필</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { label: '회사명', value: '어반핏 코리아', type: 'text' },
              { label: '업종', value: '패션/커머스', type: 'text' },
              { label: '대표 이메일', value: 'contact@urbanfit.kr', type: 'email' },
              { label: '웹사이트', value: 'https://urbanfit.kr', type: 'url' },
            ].map(({ label, value, type }) => (
              <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                <input type={type} defaultValue={value} />
              </label>
            ))}
            <div style={{ marginTop: 8 }}>
              <Btn>변경사항 저장</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
