import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Btn } from './index';
import PaymentModal from './PaymentModal';
import ExitIntentModal from './ExitIntentModal';
import { CAREER_UNLOCK_CREDIT } from '../../lib/honorLevels';

export const CAREER_LEVELS = [
  { key: 'junior', label: '주니어',       sub: '1–3년차',    multiplier: 1.0, proOnly: false },
  { key: 'middle', label: '미들',         sub: '4–7년차',    multiplier: 1.5, proOnly: false },
  { key: 'senior', label: '시니어',       sub: '8년차 이상', multiplier: 2.0, proOnly: true  },
  { key: 'clevel', label: 'C레벨/임원진', sub: '',           multiplier: 3.0, proOnly: true  },
];

export const MAIN_BASE_PAYOUT = 8000;
export const SUB_BASE_PAYOUT  = 4500;

const SLIDER_MIN  = 10;
const SLIDER_MAX  = 30;
const STARTER_MAX = 15;
const FREE_TRIAL_MAX = 10;  // 무료 체험 패널 상한

const CREDIT_BUNDLES = [10, 30, 50, 100];

function getFinalWeight(careerLevels) {
  const active = CAREER_LEVELS.filter(c => careerLevels.includes(c.key));
  if (active.length === 0) return 1.0;
  if (active.length <= 2) return Math.max(...active.map(c => c.multiplier));
  return 1.8;
}

function getMinWeight(careerLevels) {
  const active = CAREER_LEVELS.filter(c => careerLevels.includes(c.key));
  if (active.length === 0) return 1.0;
  return Math.min(...active.map(c => c.multiplier));
}

export function calcCredits(panelCount, careerLevels, missionType = 'sub') {
  const finalWeight  = getFinalWeight(careerLevels);
  const missionFactor = missionType === 'main' ? 1.5 : 1.0;
  return Math.round(panelCount * finalWeight * missionFactor * 100) / 100;
}

function fmtCr(n) {
  return parseFloat((n ?? 0).toFixed(2));
}

function fmtKRW(n) {
  return n.toLocaleString('ko-KR') + '원';
}

export function calcPanelPayout(careerLevels, missionType = 'sub') {
  const finalWeight = getFinalWeight(careerLevels);
  const base = missionType === 'main' ? MAIN_BASE_PAYOUT : SUB_BASE_PAYOUT;
  return Math.round(base * finalWeight);
}

const PanelTargetStep = forwardRef(function PanelTargetStep({
  plan,
  panelCount,
  onPanelCount,
  careerLevels,
  onCareerLevels,
  missionType = 'sub',
  creditBalance = null,
  companyId = null,
  onCreditBalanceUpdate = null,
  onSaveDraft = null,
  freeTrialAvailable = false,
}, ref) {
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function handleGoToPlans() {
    setShowUpgrade(false);
    setShowCreditModal(false);
    if (onSaveDraft) {
      setShowSaveDraftModal(true);
    } else {
      navigate('/company/plans');
    }
  }

  async function handleSaveAndGo() {
    setIsSaving(true);
    try { await onSaveDraft(); } catch { /* 저장 실패해도 이동 허용 */ }
    setIsSaving(false);
    setShowSaveDraftModal(false);
    navigate('/company/plans');
  }

  function handleGoWithoutSave() {
    setShowSaveDraftModal(false);
    navigate('/company/plans');
  }

  const isFreeTrial  = plan === 'free_trial';
  const isStarter    = !plan || plan === 'starter';
  const isPro        = plan === 'pro';
  const isRestricted = isStarter || isFreeTrial;  // 25,000원 단가·업그레이드 박스 공통
  const credits    = calcCredits(panelCount, careerLevels, missionType);
  const missionFactor = missionType === 'main' ? 1.5 : 1.0;
  const minCredits = Math.round(panelCount * getMinWeight(careerLevels) * missionFactor * 100) / 100;
  const isRange    = fmtCr(minCredits) !== fmtCr(credits);
  // 무료체험 자격 보유 시 등록이 무료이므로 부족 경고 숨김
  const isShort    = freeTrialAvailable ? false : (creditBalance != null && credits > creditBalance);
  // 무료체험 예상 잠금 해제 비용 = 잠긴 패널(전체-2명) × 선택 경력 크레딧(주1·미들2…) 범위
  const ftLockedCount  = Math.max(0, panelCount - 2);
  const ftSelCredits   = (careerLevels.length ? careerLevels : ['junior']).map(k => CAREER_UNLOCK_CREDIT[k] ?? 1);
  const ftMinUnlock    = ftLockedCount * Math.min(...ftSelCredits);
  const ftMaxUnlock    = ftLockedCount * Math.max(...ftSelCredits);

  useImperativeHandle(ref, () => ({ openCreditModal }));

  // 복원된 직급 자동 정리: 스타터는 proOnly 전부 제거 / 무료체험은 C레벨만 제거(시니어 허용)
  useEffect(() => {
    if (isStarter || isFreeTrial) {
      // 스타터·무료체험: proOnly(시니어·C레벨) 제거 → 주니어·미들만
      const hasProLevels = careerLevels.some(k => CAREER_LEVELS.find(c => c.key === k)?.proOnly);
      if (!hasProLevels) return;
      const allowed = careerLevels.filter(k => !CAREER_LEVELS.find(c => c.key === k)?.proOnly);
      onCareerLevels(allowed.length > 0 ? allowed : ['junior']);
    }
  }, [plan, careerLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  const unitPrice = isRestricted ? 25000 : 21600;

  const handleSliderChange = (e) => onPanelCount(Number(e.target.value));
  const handleSliderCommit = () => {
    if (isFreeTrial && panelCount > FREE_TRIAL_MAX) {
      onPanelCount(FREE_TRIAL_MAX);  // 무료체험 최대 10명
    } else if (isStarter && panelCount > STARTER_MAX) {
      onPanelCount(STARTER_MAX);
      setShowUpgrade(true);
    }
  };

  const toggleCareer = (key, proOnly) => {
    if (proOnly && (isStarter || isFreeTrial)) { setShowUpgrade(true); return; }  // 스타터·무료체험: 시니어·C레벨 차단
    const next = careerLevels.includes(key)
      ? careerLevels.filter(k => k !== key)
      : [...careerLevels, key];
    if (next.length === 0) return;
    onCareerLevels(next);
  };

  function openCreditModal() {
    setSelectedBundle(null);
    setShowCreditModal(true);
  }

  if (!plan) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      로딩 중…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── 패널 인원수 슬라이더 ── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>패널 인원수</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
          {freeTrialAvailable
            ? `무료 체험은 패널 ${FREE_TRIAL_MAX}명으로 진행됩니다.`
            : isFreeTrial
            ? `현재 플랜은 최대 ${FREE_TRIAL_MAX}명까지 선택 가능합니다.`
            : isStarter
            ? `스타터 플랜은 최대 ${STARTER_MAX}명까지 선택 가능합니다.`
            : '최대 30명까지 패널을 선택할 수 있습니다.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 32 }}>{SLIDER_MIN}명</span>
          <input
            type="range"
            min={SLIDER_MIN}
            max={isFreeTrial ? FREE_TRIAL_MAX : SLIDER_MAX}
            step={1}
            value={panelCount}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 32, textAlign: 'right' }}>{isFreeTrial ? FREE_TRIAL_MAX : SLIDER_MAX}명</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            {panelCount}
          </span>
          <span style={{ fontSize: 16, color: 'var(--text-2)', marginLeft: 6 }}>명</span>
        </div>

        {isStarter && (
          <div style={{
            padding: '10px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)',
            fontSize: 12, color: 'var(--text-3)', textAlign: 'center',
            border: '1px solid var(--border)',
          }}>
            더 많은 패널이 필요하다면?{' '}
            <button
              onClick={() => setShowUpgrade(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
              Pro로 업그레이드 →
            </button>
          </div>
        )}
      </div>

      {/* ── 경력/직급 선택 ── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>패널 경력/직급</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: isFreeTrial ? 10 : 16, lineHeight: 1.6 }}>
          원하는 경력대를 중복 선택할 수 있습니다. 높은 직급일수록 크레딧 소모가 늘어납니다.
        </p>
        {isFreeTrial && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: 'rgba(16,54,125,0.06)', border: '1px solid var(--accent)',
            fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600,
          }}>
            🎁 무료 체험은 <strong style={{ color: 'var(--accent)' }}>주니어·미들 패널</strong>만 선택할 수 있습니다. (시니어·C레벨은 Pro 플랜)
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {CAREER_LEVELS.map(({ key, label, sub, multiplier, proOnly }) => {
            const isSelected  = careerLevels.includes(key);
            const isProLocked = proOnly && (isStarter || isFreeTrial);
            return (
              <button
                key={key}
                onClick={() => toggleCareer(key, proOnly)}
                style={{
                  padding: '16px 18px', borderRadius: 'var(--radius)', textAlign: 'left',
                  background: 'var(--surface)',
                  border: `2px solid ${isSelected ? 'var(--accent)' : isProLocked ? 'rgba(191,149,63,0.4)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: isSelected ? 'var(--accent)' : 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {label}
                    {isSelected && <span style={{ fontSize: 12 }}>✓</span>}
                  </span>
                  {proOnly && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                      background: 'linear-gradient(90deg, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)',
                      backgroundSize: '200% auto',
                      animation: 'shimmer 2.5s linear infinite',
                      color: '#1D1D1F', letterSpacing: '0.05em', flexShrink: 0,
                    }}>PRO</span>
                  )}
                </div>
                {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{sub}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  크레딧 배수 <strong style={{ color: 'var(--text-2)' }}>{multiplier}×</strong>
                </div>
                {isProLocked && (
                  <div style={{ fontSize: 11, color: '#bf953f', marginTop: 6, fontWeight: 600 }}>
                    ✦ Pro 플랜에서 사용 가능
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 크레딧 계산기 (sticky footer) ── */}
      <div style={{
        position: 'sticky', bottom: 0,
        margin: '8px -32px -32px', padding: '16px 32px',
        background: 'var(--surface)', borderTop: '2px solid var(--accent)',
        zIndex: 10,
      }}>
        {!freeTrialAvailable && creditBalance != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              보유 크레딧
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 20, color: isShort ? '#ef4444' : 'var(--text-1)' }}>
              {creditBalance}
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4, fontWeight: 400 }}>크레딧</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {freeTrialAvailable ? '예상 잠금 해제 비용' : (isRange ? '예상 소모 범위' : '최대 예상 소모')}
          </div>
          <div style={{ textAlign: 'right' }}>
            {freeTrialAvailable ? (
              <>
                {ftMinUnlock !== ftMaxUnlock && (
                  <>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 22, color: 'var(--text-2)' }}>{ftMinUnlock}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--text-3)', margin: '0 4px' }}>~</span>
                  </>
                )}
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, color: 'var(--accent)' }}>{ftMaxUnlock}</span>
              </>
            ) : isRange ? (
              <>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 22, color: 'var(--text-2)' }}>
                  {fmtCr(minCredits)}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--text-3)', margin: '0 4px' }}>~</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 28, color: isShort ? '#ef4444' : 'var(--accent)' }}>
                  {fmtCr(credits)}
                </span>
              </>
            ) : (
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 32, color: isShort ? '#ef4444' : 'var(--accent)' }}>
                {fmtCr(credits)}
              </span>
            )}
            <span style={{ fontSize: 14, color: 'var(--text-2)', marginLeft: 6 }}>크레딧</span>
          </div>
        </div>

        {isShort && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
              ⚠ 크레딧이 {fmtCr(credits - creditBalance)}만큼 부족합니다.
            </div>
            <button
              onClick={openCreditModal}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius)',
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              충전하기 →
            </button>
          </div>
        )}

        {freeTrialAvailable ? (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: 'rgba(16,54,125,0.06)', border: '1px solid var(--accent)', marginTop: 4,
          }}>
            <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.5 }}>🎁</span>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
              무료 체험은 <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>등록 시 차감 없음</strong>.
              결과에서 패널 2명은 무료 공개되고, <strong>잠긴 {ftLockedCount}명</strong>은 위 비용으로 충전·구독 후 해제합니다.
              (최종 비용은 실제 참여 경력에 따라 확정)
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: 'rgba(22,163,74,0.07)',
            border: '1px solid rgba(22,163,74,0.25)',
            marginTop: 4,
          }}>
            <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.5 }}>↩</span>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
              의뢰 등록 시 최대 예상 소모량이 먼저 차감되며,<br />
              <strong style={{ color: '#15803d', fontWeight: 700 }}>
                테스트 완료 후 실제 매칭된 직급 비율에 따라 차액 크레딧은 즉시 환불(Refund)됩니다.
              </strong>
            </p>
          </div>
        )}
      </div>

      {/* ── 크레딧 결제 모달 ── */}
      {showPayment && companyId && selectedBundle && ReactDOM.createPortal(
        <PaymentModal
          type="credits"
          credits={selectedBundle}
          amountKrw={selectedBundle * unitPrice}
          companyId={companyId}
          onSuccess={(newBalance) => {
            setShowPayment(false);
            setShowCreditModal(false);
            if (onCreditBalanceUpdate) onCreditBalanceUpdate(newBalance);
          }}
          onClose={() => setShowPayment(false)}
        />,
        document.body
      )}

      {/* ── 충전 이탈 리텐션 모달 ── */}
      {showExitIntent && (
        <ExitIntentModal
          context="credit"
          onStay={() => setShowExitIntent(false)}
          onLeave={() => { setShowExitIntent(false); setShowCreditModal(false); }}
        />
      )}

      {/* ── 임시저장 확인 모달 ── */}
      {showSaveDraftModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            padding: '32px 28px', maxWidth: 400, width: '90%',
            border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>💾</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>
              작성 중인 내용이 있습니다
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.8 }}>
              플랜 페이지로 이동하기 전에<br />
              작성 중인 의뢰를 임시저장할까요?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Btn
                onClick={handleSaveAndGo}
                disabled={isSaving}
                style={{ justifyContent: 'center' }}
              >
                {isSaving ? '저장 중…' : '임시저장 후 이동 →'}
              </Btn>
              <Btn
                variant="secondary"
                onClick={handleGoWithoutSave}
                disabled={isSaving}
                style={{ justifyContent: 'center' }}
              >
                저장 없이 이동
              </Btn>
              <button
                onClick={() => setShowSaveDraftModal(false)}
                disabled={isSaving}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-3)', padding: '6px 0',
                }}
              >
                계속 작성하기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 업그레이드 팝업 (슬라이더/직급 트리거) ── */}
      {showUpgrade && ReactDOM.createPortal(
        <div
          onClick={() => setShowUpgrade(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              padding: '36px 32px', maxWidth: 420, width: '90%',
              border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 14 }}>⭐</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
              더 정확한 데이터가 필요하신가요?
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.8 }}>
              더 정확한 데이터와 의사결정권자의 피드백이 필요하신가요?<br />
              <strong>Pro 플랜</strong>으로 업그레이드하면 시니어·C레벨 패널과<br />
              최대 30명 슬롯을 사용할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn variant="secondary" size="sm" onClick={() => setShowUpgrade(false)}>나중에</Btn>
              <Btn size="sm" onClick={() => { handleGoToPlans(); }}>
                Pro 플랜 전환하기 →
              </Btn>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 크레딧 충전 / 업그레이드 모달 ── */}
      {showCreditModal && ReactDOM.createPortal(
        <div
          onClick={() => setShowExitIntent(true)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              padding: '32px 28px', maxWidth: isRestricted ? 520 : 440, width: '100%',
              border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {isRestricted ? '크레딧 부족' : '크레딧 충전'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {isRestricted ? '플랜 업그레이드 또는 추가 충전' : '추가 크레딧 충전'}
                </div>
              </div>
              <button
                onClick={() => setShowExitIntent(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1, padding: 4 }}
              >✕</button>
            </div>

            {/* 현재 상태 요약 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              {[
                { label: '보유 크레딧', value: `${creditBalance ?? 0}cr`, color: 'var(--text)' },
                { label: '필요 크레딧', value: `${fmtCr(credits)}cr`, color: 'var(--text)' },
                { label: '부족량', value: `${fmtCr(credits - (creditBalance ?? 0))}cr`, color: '#ef4444' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color }}>{value}</div>
                </div>
              ))}
            </div>

            <>
              <>
                {/* 업그레이드 섹션 — 무료체험: Starter 박스 / 스타터: Pro 박스 */}
                {isRestricted && (
                  <>
                    <div style={{ padding: '18px 20px', borderRadius: 'var(--radius)', border: '1px solid rgba(191,149,63,0.4)', background: 'rgba(191,149,63,0.05)', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                            background: 'linear-gradient(90deg, #bf953f, #fcf6ba, #b38728)',
                            color: '#1D1D1F', letterSpacing: '0.05em', marginRight: 8,
                          }}>{isFreeTrial ? 'STARTER' : 'PRO'}</span>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>플랜으로 업그레이드</span>
                        </div>
                      </div>
                      <ul style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 2, margin: '0 0 14px 0', paddingLeft: 16 }}>
                        {isFreeTrial ? (
                          <>
                            <li>월 50 크레딧 제공</li>
                            <li>최대 15명 패널 슬롯</li>
                            <li>주니어·미들 패널 매칭</li>
                            <li>추가 크레딧 구매 가능 (1cr = 25,000원)</li>
                          </>
                        ) : (
                          <>
                            <li>시니어·C레벨 패널 매칭 오픈</li>
                            <li>최대 30명 패널 슬롯</li>
                            <li>추가 크레딧 14% 할인 (1cr = 21,600원)</li>
                            <li>월 165 크레딧 제공</li>
                          </>
                        )}
                      </ul>
                      <Btn
                        size="sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => { handleGoToPlans(); }}
                      >
                        {isFreeTrial ? 'Starter 플랜 시작하기 →' : 'Pro 플랜 전환하기 →'}
                      </Btn>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>또는 추가 크레딧 충전</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  </>
                )}

                {/* 크레딧 충전 섹션 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>충전량 선택</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
                    1크레딧 = {fmtKRW(unitPrice)}
                    {isPro && <span style={{ marginLeft: 6, color: '#16a34a', fontWeight: 600 }}>· Pro 14% 할인 적용</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
                    {CREDIT_BUNDLES.map(amount => {
                      const isSelected = selectedBundle === amount;
                      const totalPrice = amount * unitPrice;
                      return (
                        <button
                          key={amount}
                          onClick={() => setSelectedBundle(amount)}
                          style={{
                            padding: '12px 8px', borderRadius: 'var(--radius)', textAlign: 'center',
                            border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--accent-dim)' : 'var(--surface)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: 16, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                            {amount}
                            <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 2 }}>cr</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                            {(totalPrice / 10000).toLocaleString('ko-KR')}만원
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedBundle && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-2)' }}>충전 후 잔액</span>
                        <span style={{ fontWeight: 700 }}>{(creditBalance ?? 0) + selectedBundle} 크레딧</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-2)' }}>결제 금액</span>
                        <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 16 }}>
                          {fmtKRW(selectedBundle * unitPrice)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="secondary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowCreditModal(false)}>
                      취소
                    </Btn>
                    <Btn
                      size="sm"
                      style={{ flex: 2, justifyContent: 'center' }}
                      disabled={!selectedBundle || !companyId}
                      onClick={() => { setShowCreditModal(false); setShowPayment(true); }}
                    >
                      {selectedBundle ? `₩${(selectedBundle * unitPrice).toLocaleString()} 결제하기` : '수량을 선택하세요'}
                    </Btn>
                  </div>
                </div>
              </>
            </>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default PanelTargetStep;
