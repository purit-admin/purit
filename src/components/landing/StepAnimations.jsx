import { useState, useEffect } from 'react';

const P  = '#10367D'; // accent navy
const G  = '#16A34A'; // success green
const AM = '#f59e0b'; // amber

/* ── CSS keyframes — prefixed to avoid cross-component collisions ── */
const S1_CSS = `
@keyframes s1_chipPop  {0%{transform:scale(.85);opacity:0}60%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes s1_fadeIn   {from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes s1_blink    {0%,100%{opacity:1}50%{opacity:0}}
@keyframes s1_btnPulse {0%,100%{box-shadow:0 0 0 0 rgba(16,54,125,.5)}50%{box-shadow:0 0 0 8px rgba(16,54,125,0)}}
`;
const S2_CSS = `
@keyframes s2_slideIn    {from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes s2_checkPop   {0%{transform:scale(0);opacity:0}70%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes s2_counterPop {0%{transform:scale(.7);opacity:0}70%{transform:scale(1.05);opacity:1}100%{transform:scale(1);opacity:1}}
`;
const S3_CSS = `
@keyframes s3_fillBar  {from{width:0%}to{width:var(--tw)}}
@keyframes s3_drawR    {from{stroke-dashoffset:239}to{stroke-dashoffset:0}}
@keyframes s3_slideUp  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes s3_fadeIn   {from{opacity:0}to{opacity:1}}
`;

/* ── Phase durations (module-level = stable refs for useEffect) ── */
const D1 = [500, 800, 600, 1500, 600, 600, 1500, 1200]; // 8 phases
const D2 = [300, 500, 500, 500, 500, 500, 600, 800, 1500, 800]; // 10 phases
const D3 = [400, 600, 1200, 900, 800, 2000, 800]; // 7 phases

/* ── Phase state machine — setTimeout chain, self-correcting loop ── */
function usePhases(durations) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let p = 0;
    let timer;
    const tick = () => {
      p = (p + 1) % durations.length;
      setPhase(p);
      timer = setTimeout(tick, durations[p]);
    };
    timer = setTimeout(tick, durations[0]);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return phase;
}

/* ── Shared mock browser top-bar ── */
function MockBar({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', borderBottom: '1px solid #F1F5F9',
      flexShrink: 0,
    }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#E2E8F0' }} />
      ))}
      <div style={{ fontSize: 8.5, color: '#8598AA', marginLeft: 4, letterSpacing: '0.03em' }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STEP 1 — 의뢰 등록 (약 5분)
   NewMission Step 0 폼 미니 목업
══════════════════════════════════════════════════════ */
const TYPING_TARGET = 'PricePilot';

export function Step1Animation() {
  const phase = usePhases(D1);
  const [typedLen, setTypedLen] = useState(0);

  useEffect(() => {
    if (phase !== 3) { setTypedLen(0); return; }
    let len = 0;
    const t = setInterval(() => {
      setTypedLen(++len);
      if (len >= TYPING_TARGET.length) clearInterval(t);
    }, 110);
    return () => clearInterval(t);
  }, [phase]);

  const fading = phase === D1.length - 1;
  const chips = ['SaaS/소프트웨어', '이커머스', '헬스케어'];
  const personaFields = [
    { label: '연령대',  val: '30-45세',     show: phase >= 4, anim: phase === 4 },
    { label: '직군/역할', val: '마케팅 리더', show: phase >= 5, anim: phase === 5 },
  ];

  return (
    <>
      <style>{S1_CSS}</style>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: '#fff',
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.5s ease' : 'none',
      }}>
        <MockBar label="STEP 0 / 4 · 서비스 정보 & 타겟 페르소나" />

        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {/* 산업군 */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#4B556D', marginBottom: 3 }}>산업군</div>
            <div style={{
              display: 'flex', gap: 4, padding: '4px 8px',
              border: `1px solid ${phase >= 1 ? P : '#E2E8F0'}`,
              borderRadius: 7, background: '#FAFBFC', overflow: 'hidden',
              transition: 'border-color 0.3s ease',
            }}>
              {chips.map((chip, i) => (
                <span key={chip} style={{
                  fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
                  background: i === 0 && phase >= 2 ? P : '#E2E8F0',
                  color:      i === 0 && phase >= 2 ? '#fff' : '#4B556D',
                  animation:  i === 0 && phase === 2 ? 's1_chipPop 0.4s ease forwards' : 'none',
                }}>{chip}</span>
              ))}
            </div>
          </div>

          {/* 서비스명 */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#4B556D', marginBottom: 3 }}>검증할 서비스명</div>
            <div style={{
              padding: '5px 9px', borderRadius: 7, border: '1px solid #E2E8F0',
              background: '#FAFBFC', fontSize: 11, color: '#0F172A',
              minHeight: 26, display: 'flex', alignItems: 'center',
            }}>
              {TYPING_TARGET.slice(0, typedLen)}
              {phase >= 3 && typedLen < TYPING_TARGET.length && (
                <span style={{
                  display: 'inline-block', width: 1.5, height: 11,
                  background: P, marginLeft: 1,
                  animation: 's1_blink 0.8s infinite',
                }} />
              )}
            </div>
          </div>

          {/* 페르소나 구분선 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
            <span style={{ fontSize: 8, color: '#8598AA', whiteSpace: 'nowrap' }}>타겟 페르소나</span>
            <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
          </div>

          {/* 연령대 + 직군 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {personaFields.map((f) => (
              <div key={f.label} style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#4B556D', marginBottom: 3 }}>{f.label}</div>
                <div style={{
                  padding: '4px 8px', borderRadius: 7, border: '1px solid #E2E8F0',
                  background: '#FAFBFC', fontSize: 10, color: '#0F172A',
                  minHeight: 24, display: 'flex', alignItems: 'center',
                  opacity: f.show ? 1 : 0,
                  animation: f.anim ? 's1_fadeIn 0.4s ease forwards' : 'none',
                }}>{f.val}</div>
              </div>
            ))}
          </div>

          {/* 다음 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
            <div style={{
              padding: '6px 14px', borderRadius: 7, background: P, color: '#fff',
              fontSize: 11, fontWeight: 700, display: 'inline-block',
              animation: phase === 6 ? 's1_btnPulse 1s ease infinite' : 'none',
            }}>다음 →</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   STEP 2 — 전문가 매칭 (자동 처리)
   Purit Filter 통과 패널 매칭 시각화
══════════════════════════════════════════════════════ */
const PANELS = [
  { init: 'K', job: 'SaaS 마케팅',  level: '시니어', green: true },
  { init: 'L', job: 'B2B 그로스',   level: '미들',   green: false },
  { init: 'P', job: 'CRO 전문가',   level: '시니어', green: true },
  { init: 'C', job: '퍼포먼스',     level: '미들',   green: false },
  { init: 'Y', job: 'SaaS PMM',    level: '시니어', green: true },
];

export function Step2Animation() {
  const phase = usePhases(D2);
  const fading = phase === D2.length - 1;

  return (
    <>
      <style>{S2_CSS}</style>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: '#fff',
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.5s ease' : 'none',
      }}>
        <MockBar label="🔍 패널 자동 매칭 중..." />

        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
          {PANELS.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 7,
              background: '#FAFBFC', border: '1px solid #E2E8F0',
              opacity: phase > i ? 1 : 0,
              animation: phase === i + 1 ? 's2_slideIn 0.35s ease forwards' : 'none',
            }}>
              {/* 이니셜 아바타 */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: '#EEF2F7', color: P,
                fontSize: 9, fontWeight: 700, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{p.init}</div>

              {/* 직군 */}
              <span style={{ fontSize: 9, fontWeight: 600, color: '#4B556D', flex: 1 }}>{p.job}</span>

              {/* 경력 뱃지 */}
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                background: p.green ? 'rgba(22,163,74,.10)' : 'rgba(16,54,125,.08)',
                color: p.green ? G : P,
              }}>{p.level}</span>

              {/* 체크 */}
              <span style={{
                color: G, fontSize: 11, fontWeight: 800, flexShrink: 0, lineHeight: 1,
                display: 'inline-block',
                opacity: phase >= 6 ? 1 : 0,
                animation: phase === 6 ? 's2_checkPop 0.4s ease forwards' : 'none',
              }}>✓</span>
            </div>
          ))}

          {/* 매칭 완료 카운터 */}
          {phase >= 7 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '5px 10px', borderRadius: 20, marginTop: 2,
              background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.22)',
              animation: 's2_counterPop 0.5s ease forwards',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: G }}>
                ✓ 10/10명 Purit Filter 통과
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   STEP 3 — 결과 수령 (48시간 내)
   Results.jsx 미니 대시보드
══════════════════════════════════════════════════════ */
const SCORES = [
  { label: '명확성', score: 4.2, w: '84%', color: G  },
  { label: '관련성', score: 3.8, w: '76%', color: P  },
  { label: '가치',   score: 4.1, w: '82%', color: P  },
  { label: '차별화', score: 3.5, w: '70%', color: AM },
  { label: '신뢰',   score: 3.9, w: '78%', color: P  },
];
const TABS3 = ['명확성', '관련성', '가치', '차별화', '신뢰', '종합'];

// SVG 좌표 (center 80,80 / maxR 52)
// 외곽 오각형 (5.0 기준)
const OUTER_PTS = '80,28 129.5,63.9 110.6,122.1 49.4,122.1 30.5,63.9';
// 실제 점수 폴리곤 (명4.2 관3.8 가4.1 차3.5 신3.9)
const SCORE_PTS = '80,36.3 117.6,67.8 105.1,114.5 58.6,109.5 41.4,67.5';
// 축 선 (중심 → 외곽 꼭짓점)
const AXES = [[80,80,80,28],[80,80,129.5,63.9],[80,80,110.6,122.1],[80,80,49.4,122.1],[80,80,30.5,63.9]];
// 라벨 위치
const RADAR_LABELS = [
  { x: 80,   y: 16,  anchor: 'middle', text: '명확성' },
  { x: 139,  y: 60,  anchor: 'start',  text: '관련성' },
  { x: 116,  y: 136, anchor: 'start',  text: '가치'   },
  { x: 44,   y: 136, anchor: 'end',    text: '차별화' },
  { x: 21,   y: 60,  anchor: 'end',    text: '신뢰'   },
];

export function Step3Animation() {
  const phase = usePhases(D3);
  const fading = phase === D3.length - 1;

  return (
    <>
      <style>{S3_CSS}</style>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: '#fff', position: 'relative',
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.5s ease' : 'none',
      }}>
        <MockBar label="피드백 결과 대시보드" />

        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minHeight: 0 }}>
          {/* 차원 탭 */}
          <div style={{
            display: 'flex', gap: 3, flexWrap: 'nowrap', overflow: 'hidden',
            opacity: phase >= 1 ? 1 : 0,
            animation: phase === 1 ? 's3_fadeIn 0.4s ease forwards' : 'none',
          }}>
            {TABS3.map((t, i) => (
              <div key={t} style={{
                padding: '3px 7px', borderRadius: 5, fontSize: 8.5, fontWeight: 700,
                background: i === 0 ? P : '#E2E8F0',
                color:      i === 0 ? '#fff' : '#4B556D',
                whiteSpace: 'nowrap',
              }}>{t}</div>
            ))}
          </div>

          {/* 레이더 + 스코어 바 */}
          <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, alignItems: 'center' }}>
            {/* SVG 레이더 차트 */}
            <div style={{ width: 108, flexShrink: 0 }}>
              <svg viewBox="0 0 160 160" width="108" height="108" overflow="visible">
                {/* 외곽 */}
                <polygon points={OUTER_PTS} fill="none" stroke="#E2E8F0" strokeWidth="1.2" />
                {/* 중간 그리드 */}
                <polygon points="80,54 104.8,71.95 95.3,101.05 64.7,101.05 55.2,71.95"
                  fill="none" stroke="#F1F5F9" strokeWidth="1" />
                {/* 축선 */}
                {AXES.map(([x1,y1,x2,y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E2E8F0" strokeWidth="1" />
                ))}
                {/* 점수 폴리곤 */}
                <polygon
                  key={phase < 2 ? 'r' : 'a'}
                  points={SCORE_PTS}
                  fill={P + '1A'}
                  stroke={P}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeDasharray="239"
                  strokeDashoffset={phase < 2 ? 239 : undefined}
                  style={{ animation: phase >= 2 ? 's3_drawR 1.1s ease forwards' : 'none' }}
                />
                {/* 라벨 */}
                {RADAR_LABELS.map((l) => (
                  <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor}
                    fontSize="9" fill="#4B556D" fontWeight="600">{l.text}</text>
                ))}
              </svg>
            </div>

            {/* 스코어 바 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SCORES.map((s) => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#4B556D' }}>{s.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: s.color }}>{s.score}</span>
                  </div>
                  <div style={{ height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: s.color, borderRadius: 3,
                      '--tw': s.w,
                      width: phase < 3 ? '0%' : null,
                      animation: phase >= 3 ? 's3_fillBar 0.9s ease forwards' : 'none',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 패널 피드백 코멘트 카드 — 하단 슬라이드업 */}
        {phase >= 4 && (
          <div style={{
            position: 'absolute', bottom: 8, left: 10, right: 10,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 9,
            padding: '6px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
            animation: 's3_slideUp 0.5s ease forwards',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ fontSize: 8.5, color: '#8598AA' }}>패널 #3</span>
              <span style={{
                fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 6,
                background: 'rgba(16,54,125,.07)', color: '#4B556D',
              }}>SaaS 마케팅</span>
              <span style={{
                fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 6,
                background: 'rgba(22,163,74,.08)', color: G,
              }}>시니어</span>
            </div>
            <div style={{ fontSize: 9.5, color: '#0F172A', lineHeight: 1.55 }}>
              "헤드라인이 너무 기술적입니다. 고객 문제보다 기능을 앞세우고 있어요."
            </div>
          </div>
        )}
      </div>
    </>
  );
}
