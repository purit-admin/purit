import ReactDOM from 'react-dom';
import { useState, useRef } from 'react';
import { X, CreditCard, Landmark, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Btn } from './index';
import ExitIntentModal from './ExitIntentModal';
import { rpcErrorKo } from '../../lib/rpcErrors';

const PLAN_LABEL = { free_trial: '무료체험', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
const PLAN_CREDITS = { free_trial: 0, starter: 50, pro: 165, enterprise: 400 };

// 결제 수단 탭
const METHODS = [
  { key: 'card',            label: '카드',    Icon: CreditCard },
  { key: 'virtual_account', label: '가상계좌', Icon: Landmark  },
];

/**
 * PaymentModal — 결제 UI 골격 (Mock 모드)
 *
 * Props:
 *   type       'plan' | 'credits'
 *   plan       type=plan 일 때 'starter' | 'pro'
 *   credits    type=credits 일 때 크레딧 수량 (number)
 *   amountKrw  결제 금액 (원)
 *   companyId  UUID
 *   onSuccess  (newBalance: number | null) => void   — plan 구매 시 null 전달
 *   onClose    () => void
 *
 * PG 연동 포인트:
 *   handlePay() 내 TODO 블록을 토스페이먼츠 SDK 호출로 교체하면 됩니다.
 */
export default function PaymentModal({ type, plan, credits, amountKrw, companyId, billingCycle = 'monthly', onSuccess, onClose }) {
  const [payMethod, setPayMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showExit, setShowExit] = useState(false);
  // 연타 방어: setState는 비동기라 disabled가 반영되기 전 2번째 클릭이 통과 → 결제 RPC 이중 호출.
  // 동기 ref로 즉시 차단 (D-22). 성공 시엔 done 화면 + onSuccess로 모달이 닫혀 재진입 없음 → ref 유지.
  const submittingRef = useRef(false);

  // 이탈 시도: 처리 중·완료 후엔 바로 닫고, 그 외엔 리텐션 모달
  function handleCloseAttempt() {
    if (isProcessing || done) { onClose(); return; }
    setShowExit(true);
  }

  const orderName = type === 'plan'
    ? `${PLAN_LABEL[plan] ?? plan} 플랜`
    : `크레딧 ${credits}cr 충전`;

  async function handlePay() {
    if (payMethod === 'virtual_account') return; // 가상계좌는 PG 연동 후 지원
    if (submittingRef.current) return;           // 연타 방어 — 동기 차단(D-22)
    submittingRef.current = true;
    setIsProcessing(true);
    setError('');

    try {
      // ── TODO: PG 연동 시 이 블록을 토스페이먼츠 SDK 호출로 교체 ──────────────
      // const toss = await loadTossPayments(process.env.VITE_TOSS_CLIENT_KEY);
      // await toss.requestPayment('카드', { amount: amountKrw, orderId: ..., orderName });
      // 성공 시 서버 웹훅 또는 confirmPayment 후 아래 RPC 호출
      // ─────────────────────────────────────────────────────────────────────────

      if (type === 'plan') {
        const { error: rpcErr } = await supabase.rpc('grant_plan_credits', {
          p_company_id:    companyId,
          p_plan:          plan,
          p_amount_krw:    amountKrw,
          p_method:        payMethod,
          p_billing_cycle: billingCycle,
        });
        if (rpcErr) throw rpcErr;
        setDone(true);
        setTimeout(() => { onSuccess(null); }, 1800);

      } else {
        const { data, error: rpcErr } = await supabase.rpc('purchase_credits', {
          p_company_id:  companyId,
          p_credits:     credits,
          p_amount_krw:  amountKrw,
          p_method:      payMethod,
        });
        if (rpcErr) throw rpcErr;
        setDone(true);
        setTimeout(() => { onSuccess(data?.new_balance ?? null); }, 1800);
      }
    } catch (e) {
      submittingRef.current = false;  // 실패 시 롤백 → 재시도 허용
      setError(rpcErrorKo(e, '결제 처리 중 오류가 발생했습니다.'));
    } finally {
      setIsProcessing(false);
    }
  }

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing && !done) handleCloseAttempt(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        padding: '28px 28px 24px',
        position: 'relative',
      }}>

        {/* 닫기 버튼 */}
        {!done && (
          <button
            onClick={handleCloseAttempt}
            disabled={isProcessing}
            style={{
              position: 'absolute', top: 18, right: 18,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* 완료 화면 */}
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              결제 완료
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{orderName}이 적용되었습니다.</div>
          </div>
        ) : (
          <>
            {/* 헤더 */}
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              결제하기
            </div>

            {/* Mock 배너 */}
            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 8, padding: '9px 14px', marginBottom: 20,
              fontSize: 12, color: '#92400e',
            }}>
              🧪 테스트 모드 · 실제 결제 없이 즉시 처리됩니다
            </div>

            {/* 주문 요약 */}
            <div style={{
              background: 'var(--bg-2)', borderRadius: 10,
              padding: '16px 18px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{orderName}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  ₩{amountKrw.toLocaleString()}
                </span>
              </div>
              {type === 'credits' && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  충전 후 {credits}cr 추가 · 결제 즉시 사용 가능
                </div>
              )}
              {type === 'plan' && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {PLAN_CREDITS[plan]}cr 지급 · 기존 잔액에 추가 적립
                </div>
              )}
            </div>

            {/* 결제 수단 탭 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>
                결제 수단
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {METHODS.map(({ key, label, Icon }) => {
                  const active = payMethod === key;
                  const unavailable = key === 'virtual_account';
                  return (
                    <button
                      key={key}
                      onClick={() => !unavailable && setPayMethod(key)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 8,
                        border: active
                          ? '2px solid var(--accent)'
                          : '1.5px solid var(--border)',
                        background: active ? 'var(--accent-dim2)' : '#fff',
                        cursor: unavailable ? 'not-allowed' : 'pointer',
                        opacity: unavailable ? 0.45 : 1,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 5,
                      }}
                    >
                      <Icon size={18} color={active ? 'var(--accent)' : 'var(--text-3)'} />
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                      }}>
                        {label}
                      </span>
                      {unavailable && (
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>연동 후 지원</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                fontSize: 13, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            {/* 결제 버튼 */}
            <Btn
              style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 15 }}
              onClick={handlePay}
              disabled={isProcessing || payMethod === 'virtual_account'}
            >
              {isProcessing ? '처리 중...' : `₩${amountKrw.toLocaleString()} 결제하기`}
            </Btn>

            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 10 }}>
              결제 완료 즉시 크레딧이 적립됩니다
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modal, document.body)}
      {showExit && (
        <ExitIntentModal
          context={type === 'plan' ? 'plan' : 'credit'}
          onStay={() => setShowExit(false)}
          onLeave={() => { setShowExit(false); onClose(); }}
        />
      )}
    </>
  );
}
