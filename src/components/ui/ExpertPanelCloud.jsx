import { useEffect, useRef } from 'react';

/* ─── 전문가 경력 텍스트 20개 ─────────────────────────────── */
const EXPERTS = [
  '연쇄 창업 5회 엑시트 달성한 CEO 겸 마케팅 총괄',
  '연 매출 1,000억 B2B SaaS 기업 전임 CMO',
  '실리콘밸리 유니콘 스타트업 아시아 시장 진출 전략 리드',
  '누적 투자 유치액 500억 스타트업 초기 그로스 해커',
  '정부 지원 사업 선정률 100% 달성, 기획 및 제안서 전문 컨설턴트',
  '단일 캠페인 ROAS 5,875% 달성 퍼포먼스 마케팅 리드',
  '연간 매체 집행 예산 300억 핸들링, 미디어 바잉 전문가',
  '앱 설치(UAC) 단가 60% 절감, 모바일 퍼포먼스 스페셜리스트',
  '퍼널 병목 분석으로 최종 결제 전환율 3.5배 개선한 데이터 아키텍트',
  '이탈률(Bounce Rate) 80% 페이지를 20%로 낮춘 CRO 장인',
  '클릭률(CTR) 15% 터트린 광고 소재 기획자',
  '고객의 지갑을 여는 상세페이지 텍스트 전문 B2B 카피라이터',
  'A/B 테스트 500회 이상 진행한 랜딩페이지 최적화 전문가',
  '5천만 뷰 달성 숏폼 콘텐츠 바이럴 기획자',
  '광고 피로도를 낮추고 후킹 포인트를 짚어내는 크리에이티브 디렉터',
  '재구매율 70%를 만든 이커머스 CRM 자동화 설계자',
  '휴면 고객 복귀율 40% 달성, 이메일 마케팅 스페셜리스트',
  '객단가(AOV) 2배 상승시킨 크로스셀링 캠페인 매니저',
  '구독 해지 방어(Churn-rate) 전담 고객 경험(CX) 리드',
  '앱 푸시 오픈율 상위 1% 노하우 보유 CRM 마케터',
];

/* ─── 타이밍 상수 ──────────────────────────────────────────
   T_CYCLE = 20s, STAGGER = 1s (20개 × 1s = 20s 균등 분할)
   항상 정확히 4개 동시 노출: 20 × 4000ms / 20000ms = 4.0
──────────────────────────────────────────────────────────── */
const T_CYCLE   = 20000; // ms — 한 태그의 전체 주기
const T_IN      = 1000;  // ms — 블러 해제 + 페이드인
const T_HOLD    = 1800;  // ms — 완전히 선명한 구간
const T_OUT     = 1200;  // ms — 페이드아웃
const T_VISIBLE = T_IN + T_HOLD + T_OUT; // 4000ms
const STAGGER   = T_CYCLE / EXPERTS.length; // 1000ms

/* ─── 이징 함수 ────────────────────────────────────────── */
const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

/* ─── 격자 + 결정론적 지터로 위치 사전 계산 ──────────────
   4열 × 5행. Math.sin/cos 기반 jitter → 매 렌더 동일
──────────────────────────────────────────────────────────── */
const POSITIONS = EXPERTS.map((_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const jx  = (Math.sin(i * 7.3) * 0.5 + 0.5) * 14 - 7; // ±7%
  const jy  = (Math.cos(i * 4.1) * 0.5 + 0.5) * 12 - 6; // ±6%
  return {
    x: (col / 4) * 80 + 10 + jx, // 10%~90%
    y: (row / 5) * 76 + 12 + jy, // 12%~88%
  };
});

/* ─── 태그 공통 인라인 스타일 (애니메이션 속성 제외) ────── */
const TAG_BASE = {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 100,
  padding: '7px 16px',
  fontWeight: 500,
  color: '#475569',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  cursor: 'default',
  userSelect: 'none',
  letterSpacing: '-0.01em',
  lineHeight: 1.5,
  opacity: 0, // rAF가 직접 덮어씀
};

/* ═══════════════════════════════════════════════════════════
   ExpertPanelCloud
   단일 requestAnimationFrame 루프가 모든 태그를 구동.
   React state 업데이트 없이 DOM을 직접 조작 → 60fps, 드리프트 없음.
════════════════════════════════════════════════════════════ */
export default function ExpertPanelCloud() {
  const tagRefs      = useRef(EXPERTS.map(() => null));
  const frameRef     = useRef(null);
  const startRef     = useRef(null);

  // 호버 일시정지: 각 태그별 누적 정지 시간(ms)
  const hoverStartRef = useRef(EXPERTS.map(() => null)); // 현재 hover 시작 시각
  const pausedMsRef   = useRef(EXPERTS.map(() => 0));    // 누적 정지 시간

  useEffect(() => {
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;

      EXPERTS.forEach((_, i) => {
        const el = tagRefs.current[i];
        if (!el) return;

        // 이 태그의 실효 경과 시간 (호버 정지 시간 제외)
        const activeHover = hoverStartRef.current[i] !== null
          ? now - hoverStartRef.current[i]
          : 0;
        const paused = pausedMsRef.current[i] + activeHover;
        const raw    = elapsed - i * STAGGER - paused;

        // 주기 내 현재 위치 (0 ~ T_CYCLE-1 ms)
        const phase  = ((raw % T_CYCLE) + T_CYCLE) % T_CYCLE;

        let opacity, blurPx;

        if (phase < T_IN) {
          // 페이드인: 블러 걷히며 선명해짐
          const t   = phase / T_IN;
          opacity   = easeInOut(t);
          blurPx    = 8 * Math.pow(1 - t, 2); // 빠르게 걷힘
        } else if (phase < T_IN + T_HOLD) {
          // 완전 노출
          opacity = 1;
          blurPx  = 0;
        } else if (phase < T_VISIBLE) {
          // 페이드아웃: 흐려지며 사라짐
          const t   = (phase - T_IN - T_HOLD) / T_OUT;
          opacity   = 1 - easeInOut(t);
          blurPx    = 5 * t;
        } else {
          // 비노출 구간
          opacity = 0;
          blurPx  = 8;
        }

        el.style.opacity = opacity.toFixed(3);
        el.style.filter  = blurPx < 0.1 ? 'none' : `blur(${blurPx.toFixed(1)}px)`;
      });

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const W = { maxWidth: 1100, margin: '0 auto', padding: '0 32px' };

  return (
    <section className="landing-section" style={{ background: '#EDF0F4' }}>
      <div style={W}>

        {/* 섹션 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 12, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#10367D', background: '#DCDCDC',
            borderRadius: 6, padding: '5px 12px', marginBottom: 20,
          }}>
            패널 전문성
          </div>
          <h2 style={{
            fontSize: 'clamp(26px, 3.5vw, 40px)',
            fontWeight: 800, letterSpacing: '-0.04em',
            color: '#0F172A', marginBottom: 12,
          }}>
            어떤 전문가들이 검증하나요?
          </h2>
          <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7 }}>
            명함과 링크드인을 통해 100% 검증된 패널입니다.
          </p>
        </div>

        {/* 플로팅 태그 박스 */}
        <div className="expert-cloud-box" style={{
          position: 'relative',
          height: 300,
        background: '#F8FAFC',
        borderRadius: 24,
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        {/* 4면 edge-fade 마스크 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: [
            'linear-gradient(to bottom, #F8FAFC 0%, transparent 10%, transparent 90%, #F8FAFC 100%)',
            'linear-gradient(to right,  #F8FAFC 0%, transparent 6%,  transparent 94%, #F8FAFC 100%)',
          ].join(', '),
        }} />

        {/* 태그 레이어 */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {EXPERTS.map((text, i) => (
            <div
              key={i}
              ref={el => { tagRefs.current[i] = el; }}
              className="expert-tag"
              onMouseEnter={() => {
                hoverStartRef.current[i] = performance.now();
              }}
              onMouseLeave={() => {
                if (hoverStartRef.current[i] !== null) {
                  pausedMsRef.current[i] += performance.now() - hoverStartRef.current[i];
                  hoverStartRef.current[i] = null;
                }
              }}
              style={{
                ...TAG_BASE,
                left: `${POSITIONS[i].x}%`,
                top:  `${POSITIONS[i].y}%`,
              }}
            >
              {text}
            </div>
          ))}
        </div>
        </div>

      </div>
    </section>
  );
}
