import { useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Btn } from './index';

export const CAREER_LEVELS = [
  { key: 'junior', label: '주니어',       sub: '1–3년차',    multiplier: 1.0, proOnly: false },
  { key: 'middle', label: '미들',         sub: '4–7년차',    multiplier: 1.5, proOnly: false },
  { key: 'senior', label: '시니어',       sub: '8년차 이상', multiplier: 2.0, proOnly: true  },
  { key: 'clevel', label: 'C레벨/임원진', sub: '',           multiplier: 3.0, proOnly: true  },
];

// 패널 정산금 기준단가 (주니어 1.0× 기준)
// 메인: 주니어 8,000 / 미들 12,000 / 시니어 16,000 / C레벨 24,000
// 서브: 주니어 4,500 / 미들 6,750 / 시니어 9,000 / C레벨 13,500
export const MAIN_BASE_PAYOUT = 8000;
export const SUB_BASE_PAYOUT  = 4500;

const SLIDER_MIN  = 10;
const SLIDER_MAX  = 30;
const STARTER_MAX = 15;

function getFinalWeight(careerLevels) {
  const active = CAREER_LEVELS.filter(c => careerLevels.includes(c.key));
  if (active.length === 0) return 1.0;
  if (active.length <= 2) return Math.max(...active.map(c => c.multiplier));
  return 1.8; // 3~4개 혼합 상한
}

// missionType: 'main'(1.5×) | 'sub'(1.0×)
export function calcCredits(panelCount, careerLevels, missionType = 'sub') {
  const finalWeight  = getFinalWeight(careerLevels);
  const missionFactor = missionType === 'main' ? 1.5 : 1.0;
  return Math.round(panelCount * finalWeight * missionFactor * 100) / 100;
}

function fmtCr(n) {
  return parseFloat((n ?? 0).toFixed(2));
}

// 패널 1인당 예상 정산금 (reward_amount DB 저장용)
export function calcPanelPayout(careerLevels, missionType = 'sub') {
  const finalWeight = getFinalWeight(careerLevels);
  const base = missionType === 'main' ? MAIN_BASE_PAYOUT : SUB_BASE_PAYOUT;
  return Math.round(base * finalWeight);
}

export default function PanelTargetStep({ plan, panelCount, onPanelCount, careerLevels, onCareerLevels, missionType = 'sub', creditBalance = null }) {
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isStarter = !plan || plan === 'starter';
  const credits   = calcCredits(panelCount, careerLevels, missionType);

  const handleSliderChange = (e) => onPanelCount(Number(e.target.value));
  const handleSliderCommit = () => {
    if (isStarter && panelCount > STARTER_MAX) {
      onPanelCount(STARTER_MAX);
      setShowUpgrade(true);
    }
  };

  const toggleCareer = (key, proOnly) => {
    if (proOnly && isStarter) { setShowUpgrade(true); return; }
    const next = careerLevels.includes(key)
      ? careerLevels.filter(k => k !== key)
      : [...careerLevels, key];
    if (next.length === 0) return;
    onCareerLevels(next);
  };

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
          {isStarter
            ? `스타터 플랜은 최대 ${STARTER_MAX}명까지 선택 가능합니다.`
            : '최대 30명까지 패널을 선택할 수 있습니다.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 32 }}>{SLIDER_MIN}명</span>
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={panelCount}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 32, textAlign: 'right' }}>{SLIDER_MAX}명</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
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
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
              Pro로 업그레이드 →
            </button>
          </div>
        )}
      </div>

      {/* ── 경력/직급 선택 ── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>패널 경력/직급</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          원하는 경력대를 중복 선택할 수 있습니다. 높은 직급일수록 크레딧 소모가 늘어납니다.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {CAREER_LEVELS.map(({ key, label, sub, multiplier, proOnly }) => {
            const isSelected  = careerLevels.includes(key);
            const isProLocked = proOnly && isStarter;
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
        {creditBalance != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              보유 크레딧
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color: credits > creditBalance ? '#ef4444' : 'var(--text-1)' }}>
              {creditBalance}
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4, fontWeight: 400 }}>크레딧</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            최대 예상 소모
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 32, color: (creditBalance != null && credits > creditBalance) ? '#ef4444' : 'var(--accent)' }}>
              {fmtCr(credits)}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-2)', marginLeft: 6 }}>크레딧</span>
          </div>
        </div>
        {creditBalance != null && credits > creditBalance && (
          <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginBottom: 6 }}>
            ⚠ 크레딧이 부족합니다. 요금제 페이지에서 플랜을 선택하거나 크레딧을 충전하세요.
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
          실제 매칭된 패널의 직급 비율에 따라 소모량은 줄어들 수 있으며, 사용되지 않은 차액 크레딧은 테스트 완료 후 즉시 환불(Refund)됩니다.
        </div>
      </div>

      {/* ── 업그레이드 팝업 ── */}
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
              <Btn size="sm" onClick={() => { setShowUpgrade(false); navigate('/company/plans'); }}>
                Pro 플랜 전환하기 →
              </Btn>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
