import { useState } from 'react';
import ReactDOM from 'react-dom';
import { Btn } from './index';
import PaymentModal from './PaymentModal';
import ExitIntentModal from './ExitIntentModal';

/**
 * ChargeOptionsModal — 잠금 해제용 "플랜 구독 또는 크레딧 충전" 선택 모달
 *   크레딧 단건 충전뿐 아니라 Starter/Pro 플랜 구독 선택지도 함께 제공.
 *   결제 성공 시 onSuccess(newBalance) — 호출측에서 언락 진행.
 *
 * Props: needed(필요 크레딧), currentBalance, companyId, onSuccess(newBalance|null), onClose
 */
const PLANS = [
  { id: 'starter', name: 'Starter', credits: 50,  priceKrw: 820000,  desc: '월 50 크레딧 · 최대 15명 · 주니어·미들' },
  { id: 'pro',     name: 'Pro',     credits: 165, priceKrw: 2380000, desc: '월 165 크레딧 · 시니어·C레벨 · 추가 충전 14% 할인' },
];
const BUNDLES = [10, 30, 50, 100];
const UNIT = 25000; // 1cr (정가)

export default function ChargeOptionsModal({ needed = 0, currentBalance = 0, companyId, onSuccess, onClose }) {
  const suggested = BUNDLES.find(b => b >= Math.max(0, needed - currentBalance)) || 100;
  const [bundle, setBundle] = useState(suggested);
  const [payTarget, setPayTarget] = useState(null); // { type, plan?, credits?, amountKrw }
  const [showExit, setShowExit] = useState(false);

  // 결제 단계 — PaymentModal 위임 (PaymentModal 자체에 이탈 리텐션 내장)
  if (payTarget) {
    return (
      <PaymentModal
        {...payTarget}
        companyId={companyId}
        onSuccess={(nb) => onSuccess(nb)}
        onClose={() => setPayTarget(null)}  /* 뒤로 — 선택 화면 복귀 */
      />
    );
  }

  const modal = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setShowExit(true); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 480, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', padding: '28px 26px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>전체 잠금 해제</div>
          <button onClick={() => setShowExit(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          잠금 해제에 <strong style={{ color: 'var(--accent)' }}>{needed}크레딧</strong>이 필요합니다. (보유 {currentBalance}cr) 플랜을 구독하거나 크레딧을 충전하세요.
        </div>

        {/* 플랜 구독 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>플랜 구독 — 매달 크레딧 제공</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {PLANS.map(p => (
            <button key={p.id} onClick={() => setPayTarget({ type: 'plan', plan: p.id, amountKrw: p.priceKrw })}
              style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{p.name} 구독</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>월 {p.credits}cr · ₩{p.priceKrw.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* 크레딧만 충전 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>또는 크레딧만 충전</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {BUNDLES.map(b => {
            const on = bundle === b;
            return (
              <button key={b} onClick={() => setBundle(b)} style={{ padding: '12px 8px', borderRadius: 'var(--radius)', textAlign: 'center', border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-dim, rgba(16,54,125,0.08))' : 'var(--surface)', cursor: 'pointer' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: on ? 'var(--accent)' : 'var(--text)' }}>{b}<span style={{ fontSize: 10, fontWeight: 500, marginLeft: 2 }}>cr</span></div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{((b * UNIT) / 10000).toLocaleString('ko-KR')}만원</div>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowExit(true)}>닫기</Btn>
          <Btn size="sm" style={{ flex: 2, justifyContent: 'center' }} disabled={!bundle} onClick={() => setPayTarget({ type: 'credits', credits: bundle, amountKrw: bundle * UNIT })}>
            {bundle ? `₩${(bundle * UNIT).toLocaleString()} 충전하기` : '수량 선택'}
          </Btn>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modal, document.body)}
      {showExit && (
        <ExitIntentModal context="credit" onStay={() => setShowExit(false)} onLeave={() => { setShowExit(false); onClose(); }} />
      )}
    </>
  );
}
