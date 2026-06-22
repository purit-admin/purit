import { useState, useEffect } from 'react';
import { Card, Badge, Btn, SegmentFilter } from '../../components/ui';
import PaymentModal from '../../components/ui/PaymentModal';
import CancelSubscriptionModal from '../../components/ui/CancelSubscriptionModal';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';
import { splitCredits } from '../../lib/credits';

// 티어 랭크 — 하위 플랜 다운그레이드 차단용 (free_trial 0 < starter 1 < pro 2 < enterprise 3)
const TIER_RANK = { free_trial: 0, starter: 1, pro: 2, enterprise: 3 };

// Enterprise 영업 문의 수신 이메일 (별도 백엔드 채널 없음 — mailto로 직접 전송)
const ENTERPRISE_EMAIL = 'purit.admin@gmail.com';

// 결제 종료 예정일 표기 (YYYY.MM.DD)
function fmtBilling(ts) {
  if (!ts) return '결제 주기 종료일';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: '검증을 처음 시작하는 팀',
    price: { monthly: 82, annual: 68 },
    unit: '만 원/월',
    annualNote: '연간 결제 시 월 14만 원 절감',
    credits: { monthly: 50, extraPrice: 25000 },
    panelMin: 10,
    panelMax: 15,
    targeting: '주니어·미들급 (1~7년차)',
    features: [
      '추가 크레딧 구매 가능',
      '24-72시간 내 피드백 수집 보장',
      '마케팅 소재 종합 진단 (랜딩/UI 시안)',
      '소재 A/B 비교 테스트',
      '가격 페이지 수용도 검증',
      '콜드 이메일 타겟팅 검증',
      '5대 지표 진단 리포트',
      'Purit Filter 자동 적용',
      '피드백 결과 대시보드',
      '이메일 고객 지원',
    ],
    notIncluded: ['시니어·헤드 패널 매칭', '퀄리티 보증 (SLA) 및 무상 재매칭'],
    highlight: false,
    cta: '스타터 시작',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: '성장 중인 마케팅·GTM 팀',
    price: { monthly: 238, annual: 198 },
    unit: '만 원/월',
    annualNote: '연간 결제 시 월 40만 원 절감',
    credits: { monthly: 165, extraPrice: 21600 },
    panelMin: 10,
    panelMax: 30,
    targeting: '시니어·헤드 매칭 오픈',
    features: [
      '추가 크레딧 구매 시 14% 할인',
      'Starter 플랜의 모든 기능',
      '12-48시간 내 피드백 수집 보장',
      '시니어·의사결정권자 패널 매칭 오픈',
      '시니어·헤드 패널 최우선 배정',
      '불량 응답 100% 무상 재매칭 (퀄리티 보증)',
      'AI 인사이트 핵심 요약 리포트',
      '전담 온보딩 매니저 지원',
    ],
    notIncluded: ['특정 회사·산업군 핀셋 필터링'],
    highlight: true,
    cta: '프로 시작',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: '대규모·다빈도 테스트 조직',
    price: { monthly: 450, annual: 450 },
    unit: '만 원/월부터',
    annualNote: '연간 계약 전용 (협의)',
    credits: { monthly: 400, extraPrice: null },
    panelMin: 10,
    panelMax: null,
    targeting: '특정 회사·산업군 핀셋 필터링 + 전담 CSM',
    features: [
      'Pro 플랜의 모든 기능',
      '특정 회사·산업군 마이크로 핀셋 필터링',
      '기업 맞춤형 커스텀 질문 템플릿 세팅',
      '엔터프라이즈 전담 CS 매니저 배정',
      '크레딧 커스텀 단가 협의',
      '워크스페이스 팀 멤버 무제한 초대',
      'SLA(서비스 수준 약정) 보장 + 백필 리포트',
    ],
    notIncluded: [],
    highlight: false,
    cta: '영업팀 문의',
  },
];


export default function PricingPage() {
  const [billing, setBilling] = useState('annual');
  const [company, setCompany] = useState(null);
  const [teamRole, setTeamRole] = useState(null);
  const [changing, setChanging] = useState('');
  const [msg, setMsg] = useState('');
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [contactDone, setContactDone] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null); // { type, plan?, credits?, amountKrw }
  const [creditBalance, setCreditBalance] = useState(null);
  const [creditAddon, setCreditAddon] = useState(0);
  const [addonBundle, setAddonBundle] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { company: co, teamRole: tr } = await resolveCompany(user.id);
        if (co) { setCompany(co); setCreditBalance(co.credit_balance ?? 0); setCreditAddon(co.addon_credits ?? 0); }
        setTeamRole(tr);
      } catch (err) {
        console.error('[Pricing load]', err);
      }
    }
    load();
  }, []);

  function handleSelectPlan(planId) {
    if (teamRole !== null) { setMsg('플랜 변경은 계정 오너만 가능합니다.'); return; }
    if (planId === 'enterprise') { setShowEnterpriseModal(true); return; }
    if (!company) return;
    // 다운그레이드 차단 — 상위 플랜 사용 중 하위 플랜으로 변경 불가
    if (TIER_RANK[planId] < (TIER_RANK[currentPlan] ?? 0)) {
      setMsg('하위 플랜으로는 변경할 수 없습니다.');
      setTimeout(() => setMsg(''), 3500);
      return;
    }
    const planObj = PLANS.find(p => p.id === planId);
    const price = billing === 'annual' ? planObj.price.annual : planObj.price.monthly;
    setChanging(planId);
    setPaymentTarget({ type: 'plan', plan: planId, amountKrw: price * 10000, billingCycle: billing === 'annual' ? 'annual' : 'monthly' });
  }

  function handlePaymentSuccess(newBalance) {
    if (paymentTarget?.type === 'plan') {
      const planCredits = { starter: 50, pro: 165, enterprise: 400 };
      const credits = planCredits[paymentTarget.plan] ?? 0;
      // 누적 지급 — 기존 잔액에 새 플랜 크레딧을 더함(덮어쓰기 아님, 서버 grant_plan_credits와 일치)
      setCompany(c => ({ ...c, plan: paymentTarget.plan, credit_balance: (c?.credit_balance || 0) + credits }));
      setCreditBalance(prev => (prev || 0) + credits);
      setMsg('플랜이 변경됐습니다. 크레딧이 추가 지급됐습니다.');
    } else {
      if (newBalance != null) {
        setCreditBalance(newBalance);
        // 구매 충전분은 addon 트래커에도 누적 (서버 purchase_credits와 일치)
        const added = paymentTarget?.credits || 0;
        setCreditAddon(prev => (prev || 0) + added);
        setCompany(c => ({ ...c, credit_balance: newBalance, addon_credits: (c?.addon_credits || 0) + added }));
      }
      setMsg(`크레딧이 충전됐습니다. 잔여 ${newBalance}cr`);
    }
    setChanging('');
    setAddonBundle(null);
    setPaymentTarget(null);
    setTimeout(() => setMsg(''), 3500);
  }

  // Enterprise 문의는 별도 백엔드 수신 채널이 없어 메일 클라이언트로 직접 전송 (mailto)
  function handleContactSubmit() {
    const subject = encodeURIComponent('[Purit] Enterprise 플랜 도입 문의');
    const body = encodeURIComponent(contactMsg.trim() || '팀 규모, 월 광고비, 원하는 기능 등을 알려주세요.');
    window.location.href = `mailto:${ENTERPRISE_EMAIL}?subject=${subject}&body=${body}`;
    setContactDone(true);
  }

  // 구독 해지 예약 철회
  async function handleResume() {
    if (resuming) return;
    setResuming(true);
    try {
      const { error } = await supabase.rpc('resume_my_subscription');
      if (error) throw error;
      setCompany(c => ({ ...c, subscription_cancel_at_period_end: false, subscription_canceled_at: null }));
      setMsg('구독 해지가 취소됐습니다. 계속 이용해주셔서 감사합니다.');
    } catch (e) {
      setMsg('처리 실패: ' + (e.message || ''));
    } finally {
      setResuming(false);
      setTimeout(() => setMsg(''), 3500);
    }
  }

  const currentPlan = company?.plan?.toLowerCase() || '';

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1100, animation: 'fadeUp 0.5s ease both' }}>
      {msg && (
        <div style={{
          marginBottom: 20, padding: '12px 20px', borderRadius: 'var(--radius)', fontSize: 13,
          background: msg.includes('실패') ? 'var(--red-dim)' : 'var(--accent-dim, rgba(126,200,160,0.12))',
          color: msg.includes('실패') ? 'var(--red)' : 'var(--accent)',
          fontWeight: 600, textAlign: 'center',
        }}>{msg}</div>
      )}
      {currentPlan === 'free_trial' && (
        <div style={{
          marginBottom: 24, padding: '14px 20px', borderRadius: 'var(--radius)',
          background: 'rgba(16,54,125,0.06)', border: '1px solid var(--accent)',
          fontSize: 14, color: 'var(--text)', textAlign: 'center', fontWeight: 600,
        }}>
          🎁 현재 <strong style={{ color: 'var(--accent)' }}>무료 체험</strong> 중입니다 — Starter 플랜으로 시작하면 매월 크레딧으로 더 많은 의뢰와 전체 결과를 받아볼 수 있습니다.
        </div>
      )}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>광고비 낭비 전에 투자하세요</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 520, margin: '0 auto 24px' }}>
          크레딧 기반 구독 — 필요한 만큼 테스트하고, 패널 등급과 규모로 인사이트 깊이를 조절하세요.
        </p>
        <SegmentFilter
          value={billing}
          onChange={setBilling}
          tabs={[{ key: 'annual', label: '연간 결제 (절감)' }, { key: 'monthly', label: '월간 결제 (무약정)' }]}
          style={{ justifyContent: 'center', marginBottom: 0 }}
        />
      </div>

      {/* Plans */}
      <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        {PLANS.map(plan => (
          <Card key={plan.id} style={{
            padding: '28px 24px',
            borderColor: currentPlan === plan.id ? 'var(--accent)' : plan.highlight ? 'var(--accent)' : 'var(--border)',
            position: 'relative',
            background: plan.highlight ? 'linear-gradient(160deg, var(--surface), var(--bg-3))' : 'var(--surface)',
          }}>
            {currentPlan === plan.id && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--green, #7EC8A0)', color: '#0A0A08', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)', padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                현재 플랜
              </div>
            )}
            {plan.highlight && currentPlan !== plan.id && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)', padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                가장 인기
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{plan.tagline}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>{plan.name}</div>
              <div>
                <span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-sans)', color: plan.highlight ? 'var(--accent)' : 'var(--text)' }}>
                  {billing === 'annual' ? plan.price.annual : plan.price.monthly}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 4 }}>{plan.unit}</span>
              </div>
              {plan.id === 'enterprise' ? (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>연간 계약 전용 · 협의 가능</div>
              ) : billing === 'annual' ? (
                <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                  연간 결제 시 {Math.round((plan.price.monthly - plan.price.annual) / plan.price.monthly * 100)}% 절감
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>무약정 · 언제든 해지 가능</div>
              )}
            </div>

            {/* 핵심 스펙 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>월 크레딧</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
                  {plan.id === 'enterprise' ? '400+' : plan.credits.monthly}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>회당 패널</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                  {plan.panelMin}~{plan.panelMax ? plan.panelMax : '∞'}명
                </div>
              </div>
            </div>
            {/* 타겟팅 등급 */}
            <div style={{ marginBottom: 16, padding: '9px 12px', background: plan.highlight ? 'rgba(126,200,160,0.08)' : 'var(--surface)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${plan.highlight ? 'var(--accent)' : plan.id === 'enterprise' ? 'var(--text-3)' : 'var(--border)'}` }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>타겟팅 권한</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.4 }}>{plan.targeting}</div>
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

            {(() => {
              const isDowngrade = plan.id !== 'enterprise' && TIER_RANK[plan.id] < (TIER_RANK[currentPlan] ?? 0);
              return (
                <Btn
                  variant={currentPlan === plan.id ? 'secondary' : plan.highlight ? 'primary' : 'secondary'}
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={currentPlan === plan.id || isDowngrade || !!changing || teamRole !== null}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {currentPlan === plan.id ? '사용 중'
                    : isDowngrade ? '더 낮은 플랜 (변경 불가)'
                    : changing === plan.id ? '변경 중...' : plan.cta}
                </Btn>
              );
            })()}
          </Card>
        ))}
      </div>

      {/* Add-ons */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>추가 옵션</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* 추가 크레딧 충전 — 번들 선택 UI */}
        {(() => {
          const unitPrice = currentPlan === 'pro' ? 21600 : 25000;
          const discountLabel = currentPlan === 'pro' ? '14% 할인 적용' : null;
          const BUNDLES = [10, 30, 50, 100];
          return (
            <div style={{ padding: '20px 20px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>추가 크레딧 충전</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    1크레딧 = {unitPrice.toLocaleString()}원
                    {discountLabel && <span style={{ marginLeft: 6, color: '#22c55e', fontWeight: 600 }}>{discountLabel}</span>}
                  </div>
                </div>
                {creditBalance != null && (() => {
                  const s = splitCredits(creditBalance, creditAddon);
                  return (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                      잔여 <strong style={{ color: 'var(--text)' }}>{creditBalance}cr</strong>
                      <div style={{ fontSize: 11, marginTop: 2 }}>월간 {s.monthly}cr · 추가 {s.addon}cr</div>
                    </div>
                  );
                })()}
              </div>
              <div className="grid-2col-480" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                {BUNDLES.map(amount => {
                  const isSelected = addonBundle === amount;
                  return (
                    <button
                      key={amount}
                      onClick={() => setAddonBundle(isSelected ? null : amount)}
                      style={{
                        padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                        border: isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                        background: isSelected ? 'var(--accent-dim2)' : '#fff',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 15, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                        {amount}cr
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {((amount * unitPrice) / 10000).toLocaleString('ko-KR')}만원
                      </span>
                    </button>
                  );
                })}
              </div>
              <Btn
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={!addonBundle || teamRole !== null || !company}
                onClick={() => setPaymentTarget({
                  type: 'credits',
                  credits: addonBundle,
                  amountKrw: addonBundle * unitPrice,
                })}
              >
                {addonBundle ? `${addonBundle}cr 충전하기 (₩${(addonBundle * unitPrice).toLocaleString()})` : '크레딧 수량을 선택하세요'}
              </Btn>
            </div>
          );
        })()}
      </div>

      {/* Enterprise 문의 모달 */}
      {showEnterpriseModal && (
        <div onClick={() => { setShowEnterpriseModal(false); setContactDone(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: 36, maxWidth: 480, width: '100%', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Enterprise 플랜</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>영업팀 문의</div>
              </div>
              <button onClick={() => { setShowEnterpriseModal(false); setContactDone(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            {contactDone ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>메일 작성 창을 열었습니다</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  내용을 확인 후 <b>전송</b>해 주세요. 메일 앱이 열리지 않으면<br />
                  아래 주소로 직접 보내주시면 됩니다: <b>{ENTERPRISE_EMAIL}</b>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20, padding: '16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10 }}>Enterprise 도입 문의는 이메일로 받고 있습니다:</div>
                  <a href={`mailto:${ENTERPRISE_EMAIL}`} style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}>{ENTERPRISE_EMAIL}</a>
                </div>
                <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>문의 내용을 남겨주세요</div>
                <textarea
                  value={contactMsg}
                  onChange={e => setContactMsg(e.target.value)}
                  placeholder="팀 규모, 월 광고비, 원하는 기능 등을 알려주시면 맞춤 견적을 드립니다."
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', marginBottom: 16, boxSizing: 'border-box' }}
                />
                <Btn variant="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!contactMsg.trim()} onClick={handleContactSubmit}>
                  메일로 문의 보내기
                </Btn>
              </>
            )}
          </div>
        </div>
      )}

      {/* 결제 모달 */}
      {paymentTarget && company && (
        <PaymentModal
          type={paymentTarget.type}
          plan={paymentTarget.plan}
          credits={paymentTarget.credits}
          amountKrw={paymentTarget.amountKrw}
          companyId={company.id}
          billingCycle={paymentTarget.billingCycle || 'monthly'}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setPaymentTarget(null); setChanging(''); }}
        />
      )}

      {/* 구독 관리 — 해지 / 해지 예약 철회 (유료 플랜 오너 전용) */}
      {teamRole === null && (currentPlan === 'starter' || currentPlan === 'pro') && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          {company?.subscription_cancel_at_period_end ? (
            <div style={{
              display: 'inline-block', maxWidth: 560, padding: '14px 20px', borderRadius: 'var(--radius)',
              background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7,
            }}>
              구독이 <strong>{fmtBilling(company?.next_billing_at)}</strong>에 해지될 예정입니다 — 그때까지 모든 기능을 이용할 수 있어요.
              <div style={{ marginTop: 10 }}>
                <Btn variant="primary" size="sm" disabled={resuming} onClick={handleResume}>
                  {resuming ? '처리 중…' : '구독 유지하기'}
                </Btn>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCancel(true)} style={{
              background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            }}>
              구독 해지
            </button>
          )}
        </div>
      )}

      {/* 해지 모달 */}
      {showCancel && (
        <CancelSubscriptionModal
          planLabel={currentPlan === 'pro' ? 'Pro' : 'Starter'}
          effectiveAt={company?.next_billing_at}
          onCancelled={() => setCompany(c => ({ ...c, subscription_cancel_at_period_end: true }))}
          onClose={() => setShowCancel(false)}
        />
      )}

      {/* FAQ */}
      <div style={{ marginTop: 48, padding: '28px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>자주 묻는 질문</div>
        {[
          ['크레딧이란 무엇인가요?', '크레딧은 패널 피드백 1건 단위로 차감되는 통화입니다. 패널 직급에 따라 가중치가 다르게 적용되며(주니어 1×, 미들 1.5×, 시니어 2×, 헤드 3×), 실제 매칭된 직급 비율에 따라 소모량이 달라집니다. 월간(구독) 크레딧은 매월 결제일에 플랜 기본값으로 리셋되어 다음 달로 이월되지 않지만, 추가 구매(충전)한 크레딧은 리셋과 무관하게 보존됩니다. 의뢰 시 월간 크레딧이 먼저 차감되며, 부족할 경우 추가 크레딧 사용 여부를 확인받습니다.'],
          ['플랜을 업그레이드하면 기존 크레딧은 어떻게 되나요?', '사라지지 않고 누적됩니다. 예를 들어 Starter 잔여 크레딧이 있는 상태에서 Pro로 전환하면 기존 잔여분에 Pro 크레딧(165cr)이 더해지고, 결제 시점 기준으로 월 갱신 주기가 새로 시작됩니다. 단, 상위 플랜 사용 중에는 하위 플랜으로 다운그레이드할 수 없습니다.'],
          ['의뢰 종류마다 크레딧 소모량이 다른가요?', '네, 의뢰 종류에 따라 배수가 다르게 적용됩니다. 마케팅 소재 종합 진단(메인 의뢰)은 1.5배, 소재 비교·가격 검증·이메일 검증(서브 의뢰)은 1.0배입니다. 예를 들어 주니어 패널 10명 기준으로 메인 의뢰는 15크레딧, 서브 의뢰는 10크레딧이 최대 소모됩니다.'],
          ['추가 크레딧 가격이 어떻게 되나요?', 'Starter 플랜은 추가 충전 시 1크레딧당 25,000원(정가)이 적용됩니다. Pro 플랜은 14% 할인된 1크레딧당 21,600원에 충전할 수 있습니다.'],
          ['결과는 얼마 만에 나오나요?', '패널 매칭 후 평균 24~48시간 내에 피드백이 취합됩니다. Enterprise는 전담 CSM이 일정을 조율합니다.'],
        ].map(([q, a], i, arr) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{q}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
