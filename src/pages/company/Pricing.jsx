import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: '처음 시작하는 팀을 위한',
    price: { monthly: 79, annual: 63 },
    unit: '만 원/월',
    annualNote: '연간 결제 시 20% 할인',
    tests: '연 6회',
    panels: '최대 8명',
    features: [
      '랜딩페이지 전환 검증',
      '5차원 진단 리포트',
      'Purit Filter 자동 적용',
      '피드백 결과 대시보드',
      '이메일 지원',
    ],
    notIncluded: ['소재 비교 테스트', 'ICP Pulse 구독', 'AI 인사이트 리포트', '가격 페이지 검증'],
    highlight: false,
    cta: '무료 체험 시작',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: '성장 중인 마케팅 팀을 위한',
    price: { monthly: 198, annual: 158 },
    unit: '만 원/월',
    annualNote: '연간 결제 시 20% 할인',
    tests: '연 20회',
    panels: '최대 15명',
    features: [
      'Starter 모든 기능',
      '소재 비교 테스트 (A/B)',
      '콜드 이메일 검증',
      '가격 페이지 전용 검증',
      'AI 인사이트 리포트',
      'ICP 리서치',
      '브랜드 추적 (분기)',
      '전담 온보딩 지원',
    ],
    notIncluded: ['ICP Pulse 구독 (추가 옵션)'],
    highlight: true,
    cta: '데모 신청',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: '대규모 광고 집행 팀을 위한',
    price: null,
    unit: '별도 협의',
    annualNote: null,
    tests: '무제한',
    panels: '최대 30명',
    features: [
      'Pro 모든 기능',
      'ICP Pulse 분기 구독 포함',
      '팀 멤버 무제한',
      'Slack 연동 결과 알림',
      '전담 CS 매니저',
      '커스텀 질문 템플릿 제작',
      'SLA 보장',
      '데이터 리포트 백필 제공',
    ],
    notIncluded: [],
    highlight: false,
    cta: '영업팀 문의',
  },
];

const ADD_ONS = [
  { name: 'ICP Pulse 분기 구독', desc: '분기마다 ICP 고통점·트리거·채널 변화 자동 수집 (30명 패널)', price: '월 89만 원' },
  { name: '건당 단발 의뢰', desc: '구독 없이 1회만 검증. 패널 8-20명 선택 가능', price: '50~200만 원/건' },
  { name: 'AI 리포트 업그레이드', desc: '기본 자동 리포트 → CRO 전문가 검토 추가', price: '건당 +30만 원' },
];

export default function PricingPage() {
  const [billing, setBilling] = useState('annual');
  const [company, setCompany] = useState(null);
  const [changing, setChanging] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: co } = await supabase.from('companies').select('id, plan').eq('user_id', user.id).single();
      if (co) setCompany(co);
    }
    load();
  }, []);

  async function handleSelectPlan(planId) {
    if (!company) return;
    setChanging(planId);
    setMsg('');
    const { error } = await supabase.from('companies').update({ plan: planId }).eq('id', company.id);
    if (!error) {
      setCompany(c => ({ ...c, plan: planId }));
      setMsg(planId === 'enterprise' ? '영업팀에 문의 요청이 접수됐습니다.' : '플랜이 변경됐습니다.');
    } else {
      setMsg('변경 실패: ' + error.message);
    }
    setChanging('');
    setTimeout(() => setMsg(''), 3000);
  }

  const currentPlan = company?.plan?.toLowerCase() || '';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      {msg && (
        <div style={{
          marginBottom: 20, padding: '12px 20px', borderRadius: 'var(--radius)', fontSize: 13,
          background: msg.includes('실패') ? 'var(--red-dim)' : 'var(--accent-dim, rgba(126,200,160,0.12))',
          color: msg.includes('실패') ? 'var(--red)' : 'var(--accent)',
          fontWeight: 600, textAlign: 'center',
        }}>{msg}</div>
      )}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>광고비 낭비 전에 투자하세요</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 480, margin: '0 auto 24px' }}>
          1,000만 원짜리 광고 집행 전, 100만 원으로 전환 결함을 먼저 잡는 팀이 이깁니다.
        </p>
        <div style={{ display: 'inline-flex', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, gap: 4 }}>
          {[['annual', '연간 결제 (20% 할인)'], ['monthly', '월간 결제']].map(([v, l]) => (
            <button key={v} onClick={() => setBilling(v)} style={{
              padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
              background: billing === v ? 'var(--bg)' : 'transparent',
              color: billing === v ? 'var(--text)' : 'var(--text-3)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        {PLANS.map(plan => (
          <Card key={plan.id} style={{
            padding: '28px 24px',
            borderColor: currentPlan === plan.id ? 'var(--accent)' : plan.highlight ? 'var(--accent)' : 'var(--border)',
            position: 'relative',
            background: plan.highlight ? 'linear-gradient(160deg, var(--surface), var(--bg-3))' : 'var(--surface)',
          }}>
            {currentPlan === plan.id && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--green, #7EC8A0)', color: '#0A0A08', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                현재 플랜
              </div>
            )}
            {plan.highlight && currentPlan !== plan.id && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#0A0A08', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                가장 인기
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{plan.tagline}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>{plan.name}</div>
              {plan.price ? (
                <div>
                  <span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-mono)', color: plan.highlight ? 'var(--accent)' : 'var(--text)' }}>
                    {billing === 'annual' ? plan.price.annual : plan.price.monthly}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 4 }}>{plan.unit}</span>
                  {billing === 'annual' && plan.annualNote && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{plan.annualNote}</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-3)' }}>별도 협의</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>검증 횟수</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{plan.tests}</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>패널 규모</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{plan.panels}</div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: 'var(--text-2)', borderBottom: i < plan.features.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
              {plan.notIncluded.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: 'var(--text-3)', textDecoration: 'line-through' }}>
                  <span style={{ flexShrink: 0 }}>–</span>{f}
                </div>
              ))}
            </div>

            <Btn
              variant={currentPlan === plan.id ? 'secondary' : plan.highlight ? 'primary' : 'secondary'}
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={currentPlan === plan.id || changing === plan.id}
              onClick={() => handleSelectPlan(plan.id)}
            >
              {currentPlan === plan.id ? '사용 중' : changing === plan.id ? '변경 중...' : plan.cta}
            </Btn>
          </Card>
        ))}
      </div>

      {/* Add-ons */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>추가 옵션</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ADD_ONS.map(a => (
          <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>{a.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{a.desc}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>{a.price}</div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 48, padding: '28px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>자주 묻는 질문</div>
        {[
          ['첫 의뢰 결과가 기대에 못 미치면?', '결과 불만족 시 재검증 1회를 무료로 제공합니다. 패널 매칭 오류가 있었을 경우 환불 처리됩니다.'],
          ['팀 계정을 공유할 수 있나요?', 'Pro 이상에서 팀 멤버 최대 5명까지 동일 대시보드를 공유할 수 있습니다.'],
          ['패널은 어떻게 검증되나요?', '직군·경력·구매 경험 기반의 서류 심사와 Purit Filter 통과 기록으로 관리됩니다. Trust Score 60 이하 패널은 자동 제외됩니다.'],
          ['결과는 얼마 만에 나오나요?', '패널 매칭 후 평균 24-48시간 내에 피드백이 취합됩니다.'],
        ].map(([q, a], i) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{q}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
