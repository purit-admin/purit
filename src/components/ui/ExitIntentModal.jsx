import ReactDOM from 'react-dom';
import { Btn } from './index';

/**
 * ExitIntentModal — 결제/충전/플랜전환 이탈 시 리텐션(설득) 모달
 *   "마케터 평균 고용 비용·A/B 테스트 비용은 얼마인데, 이래도 안 하시겠어요?"
 *
 * Props:
 *   onStay   () => void   — "계속 진행하기" (이탈 취소, 결제 흐름 유지)
 *   onLeave  () => void   — "그래도 나가기" (실제 닫기)
 *   context  'credit' | 'plan'  — 문구 미세 조정 (기본 'credit')
 *
 * ※ 비교 비용은 시장 평균 추정 placeholder — 운영 수치로 조정 가능
 */
const COMPARE = [
  { label: '마케터 평균 고용 비용', value: '월 약 400만 원', sub: '경력 3~5년차 퍼포먼스 마케터 1인' },
  { label: 'A/B 테스트 외주 비용', value: '건당 약 200만 원', sub: '리서치 에이전시 1회 의뢰 기준' },
  { label: '검증 없이 집행한 광고비', value: '평균 800만 원 낭비', sub: '전환 결함을 모른 채 소진' },
];

export default function ExitIntentModal({ onStay, onLeave, context = 'credit' }) {
  const modal = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onStay(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', padding: '30px 28px 24px',
      }}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>🤔</div>
        <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: 'var(--text)' }}>
          잠깐만요, 정말 나가시겠어요?
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
          {context === 'plan'
            ? '플랜 하나면 매달 검증된 인사이트를 받습니다. 비교해 보세요.'
            : '검증 비용은 생각보다 작습니다. 다른 방법과 비교해 보세요.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {COMPARE.map(c => (
            <div key={c.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{c.sub}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'center', color: 'var(--accent)', marginBottom: 18, lineHeight: 1.6 }}>
          이래도 안 하시려고요? 🙂<br />
          <span style={{ fontWeight: 500, color: 'var(--text-2)', fontSize: 12.5 }}>광고비를 태우기 전에 먼저 검증하세요.</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" size="md" style={{ flex: 1, justifyContent: 'center' }} onClick={onLeave}>그래도 나가기</Btn>
          <Btn size="md" style={{ flex: 1.4, justifyContent: 'center' }} onClick={onStay}>계속 진행하기</Btn>
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(modal, document.body);
}
