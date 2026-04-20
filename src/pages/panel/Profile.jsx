import { useState } from 'react';
import { Card, Btn, Badge } from '../../components/ui';
import { CURRENT_PANEL, getTierColor } from '../../lib/data';

const INDUSTRIES = ['이커머스 마케터', 'B2B SaaS 세일즈', '스타트업 PM', 'B2B 영업', '퍼포먼스 마케터', '브랜드 마케터', 'CRO 전문가', '콘텐츠 마케터', '스타트업 대표', '기타'];
const EXPERTISE = ['랜딩페이지 전환', '카피라이팅', '가격 전략', 'B2B 세일즈 카피', 'UX 설계', '이메일 마케팅', 'SNS 광고', '고객 인터뷰', '데이터 분석'];

export default function PanelProfile() {
  const p = CURRENT_PANEL;
  const [tab, setTab] = useState('profile');
  const [expertise, setExpertise] = useState(['랜딩페이지 전환', '카피라이팅', '가격 전략']);
  const [bankInfo, setBankInfo] = useState({ bank: '카카오뱅크', account: '3333-**-*****78', holder: '김서연' });
  const [notif, setNotif] = useState({ newMission: true, purityResult: true, settlementDone: true });

  const toggleExpertise = (e) => setExpertise(prev =>
    prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 800, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 8, letterSpacing: '0.1em' }}>PANEL · PROFILE</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>내 프로필</h1>
      </div>

      {/* Profile header card */}
      <Card style={{ marginBottom: 24, padding: '24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 800, color: '#0A0A08', flexShrink: 0,
        }}>
          {p.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{p.name}</span>
            <Badge type={getTierColor(p.tier)}>{p.tier}</Badge>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 10 }}>{p.industry} · {p.experience} 경력</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trust Score</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{p.trustScore}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>완료 미션</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{p.completedMissions}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>총 수익</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>₩{(p.totalEarned / 10000).toFixed(0)}만</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[['profile', '기본 정보'], ['expertise', '전문 분야'], ['payment', '정산 계좌'], ['notifications', '알림']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            borderBottom: `2px solid ${tab === v ? 'var(--green)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { label: '이름', value: p.name },
              { label: '이메일', value: p.email, type: 'email' },
              { label: '직군', value: p.industry, type: 'select' },
              { label: '경력', value: p.experience, placeholder: '예: 5년, 7년 이상' },
            ].map(({ label, value, type, placeholder }) => (
              <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                {type === 'select' ? (
                  <select defaultValue={value}>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                ) : (
                  <input type={type || 'text'} defaultValue={value} placeholder={placeholder} />
                )}
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>자기소개 (선택)</span>
              <textarea defaultValue="이커머스 퍼포먼스 마케팅 7년. 랜딩페이지 전환율 최적화 전문. ROAS 3x 이상 개선 프로젝트 다수 경험." rows={3} style={{ resize: 'vertical' }} />
            </label>
            <Btn style={{ alignSelf: 'flex-start' }}>저장</Btn>
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
            선택됨: {expertise.join(', ')}
          </div>
          <Btn>저장</Btn>
        </Card>
      )}

      {/* Payment tab */}
      {tab === 'payment' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>정산 계좌 정보</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>Purity Filter 통과 후 익영업일 자동 입금됩니다.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: '은행', value: bankInfo.bank, key: 'bank' },
              { label: '계좌번호', value: bankInfo.account, key: 'account' },
              { label: '예금주', value: bankInfo.holder, key: 'holder' },
            ].map(({ label, value, key }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                <input defaultValue={value} onChange={e => setBankInfo(b => ({ ...b, [key]: e.target.value }))} />
              </label>
            ))}
            <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              ⚠ 예금주명은 실명으로 입력하세요. 불일치 시 정산이 지연될 수 있습니다.
            </div>
            <Btn style={{ alignSelf: 'flex-start' }}>저장</Btn>
          </div>
        </Card>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>알림 설정</div>
          {[
            { key: 'newMission', label: '신규 미션 매칭', desc: '내 페르소나에 맞는 새 미션이 등록되면 알림' },
            { key: 'purityResult', label: 'Purity 검증 결과', desc: '제출한 피드백의 통과/반려 결과 알림' },
            { key: 'settlementDone', label: '정산 완료', desc: '수익이 계좌에 입금됐을 때 알림' },
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
              </div>
              <div
                onClick={() => setNotif(n => ({ ...n, [key]: !n[key] }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                  background: notif[key] ? 'var(--green)' : 'var(--border-light)',
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
    </div>
  );
}
