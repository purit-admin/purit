import { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Btn } from './index';
import { supabase } from '../../lib/supabase';

// 이탈 사유 — reason_code 는 DB(subscription_cancellations.reason_code)와 1:1
const REASONS = [
  { code: 'price',            label: '가격이 부담돼요' },
  { code: 'missing_features', label: '필요한 기능이 부족해요' },
  { code: 'low_usage',        label: '생각보다 자주 쓰지 않아요' },
  { code: 'competitor',       label: '다른 서비스로 옮기려고 해요' },
  { code: 'temporary',        label: '잠시 쉬어가려고 해요' },
  { code: 'other',            label: '그 외 다른 이유' },
];

function fmtDate(ts) {
  if (!ts) return '현재 결제 주기 종료일';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/**
 * 구독 해지 모달 (기간 말 해지 — cancel-at-period-end)
 * props:
 *   - planLabel: 'Starter' | 'Pro'
 *   - effectiveAt: company.next_billing_at (이용 종료 예정일)
 *   - onCancelled(effectiveAt): 해지 예약 성공 시
 *   - onClose(): 닫기/계속 이용
 */
export default function CancelSubscriptionModal({ planLabel, effectiveAt, onCancelled, onClose }) {
  const [step, setStep] = useState(1);       // 1 리텐션 / 2 사유 / 3 확정 / 4 완료
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const submittingRef = useRef(false);

  async function handleConfirm() {
    if (submittingRef.current) return;        // 연타 가드(D-22)
    submittingRef.current = true;
    setSubmitting(true);
    setErr('');
    try {
      const { data, error } = await supabase.rpc('cancel_my_subscription', {
        p_reason_code: reason,
        p_reason_text: detail.trim() || null,
      });
      if (error) throw error;
      setStep(4);
      onCancelled?.(data?.effective_at ?? effectiveAt);
    } catch (e) {
      setErr('해지 처리 중 오류가 발생했습니다: ' + (e.message || ''));
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const card = {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
    width: 460, maxWidth: '90vw', padding: '28px 28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
  };
  const lossBox = {
    background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px',
    fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '16px 0 20px',
  };

  return ReactDOM.createPortal(
    <div style={overlay} onClick={step === 4 ? undefined : onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* STEP 1 — 리텐션 */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>정말 해지하시겠어요?</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
              해지해도 <strong style={{ color: 'var(--text)' }}>{fmtDate(effectiveAt)}</strong>까지는 {planLabel} 플랜을 그대로 이용할 수 있어요. 그 이후 무료 체험으로 전환됩니다.
            </div>
            <div style={lossBox}>
              해지 시 잃게 되는 것
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>매월 지급되는 구독 크레딧 (구매한 추가 크레딧은 보존)</li>
                <li>시니어·헤드 패널 매칭 등 유료 기능</li>
                <li>광고비를 태우기 전에 검증할 기회</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                계속 이용하기
              </Btn>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: 'center', color: 'var(--text-3)' }} onClick={() => setStep(2)}>
                해지 진행
              </Btn>
            </div>
          </>
        )}

        {/* STEP 2 — 사유 설문 */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>떠나시는 이유를 알려주세요</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>더 나은 서비스를 만드는 데 큰 도움이 됩니다.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {REASONS.map(r => {
                const on = reason === r.code;
                return (
                  <button
                    type="button"
                    key={r.code}
                    onClick={() => setReason(r.code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                      padding: '13px 16px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      background: on ? 'rgba(16,54,125,0.05)' : 'var(--surface)',
                      fontSize: 14, fontWeight: on ? 600 : 500, color: 'var(--text)',
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                      border: `2px solid ${on ? 'var(--accent)' : '#CBD5E1'}`,
                      background: on ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{r.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="조금 더 자세히 알려주시면 감사하겠습니다 (선택)"
              rows={3}
              style={{ width: '100%', resize: 'vertical', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" style={{ justifyContent: 'center' }} onClick={() => setStep(1)}>이전</Btn>
              <Btn variant="primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!reason} onClick={() => setStep(3)}>다음</Btn>
            </div>
          </>
        )}

        {/* STEP 3 — 확정 */}
        {step === 3 && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>해지를 확정할게요</div>
            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', borderRadius: 'var(--radius)',
              padding: '14px 16px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7, marginBottom: 18,
            }}>
              · <strong>{fmtDate(effectiveAt)}</strong>까지 {planLabel} 플랜을 그대로 이용할 수 있어요.<br />
              · 그날 이후 <strong>무료 체험</strong>으로 전환되며, 구독 크레딧은 소멸됩니다(구매 크레딧은 보존).<br />
              · 그 전까지 언제든 <strong>해지를 취소</strong>할 수 있어요.
            </div>
            {err && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(220,38,38,0.08)', color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
                {err}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" style={{ justifyContent: 'center' }} disabled={submitting} onClick={() => setStep(2)}>이전</Btn>
              <Btn variant="primary" style={{ flex: 1, justifyContent: 'center' }} disabled={submitting} onClick={handleConfirm}>
                {submitting ? '처리 중…' : '해지 확정'}
              </Btn>
            </div>
            <button onClick={onClose} disabled={submitting} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}>
              역시 계속 이용할게요
            </button>
          </>
        )}

        {/* STEP 4 — 완료 */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>해지가 예약됐어요</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 22 }}>
              <strong style={{ color: 'var(--text)' }}>{fmtDate(effectiveAt)}</strong>까지 {planLabel} 플랜을 그대로 이용할 수 있어요.<br />
              마음이 바뀌면 그 전에 언제든 해지를 취소할 수 있습니다.
            </div>
            <Btn variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>확인</Btn>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
