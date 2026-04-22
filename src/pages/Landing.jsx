import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, X, AlertCircle } from 'lucide-react';

/* ─── 색상 토큰 ──────────────────────── */
const NAVY   = '#0A2540';
const WHITE  = '#FFFFFF';
const CHALK  = '#1A1A1A';
const MUTED  = '#4A5568';
const FAINT  = '#718096';
const BORDER = '#E8ECF0';
const BG2    = '#F7F9FB';
const BG3    = '#EEF2F7';

/* ─── 스크롤 페이드인 훅 ─────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.72s ${delay}s cubic-bezier(0.22,1,0.36,1), transform 0.72s ${delay}s cubic-bezier(0.22,1,0.36,1)`;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'none'; obs.unobserve(el); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── 공통 레이아웃 ──────────────────── */
const W = { maxWidth: 1140, margin: '0 auto', padding: '0 32px' };

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'inline-block', fontSize: 12, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: NAVY, background: 'rgba(10,37,64,0.07)',
      borderRadius: 6, padding: '5px 12px', marginBottom: 20,
    }}>{children}</div>
  );
}

/* ─── 버튼 ───────────────────────────── */
function BtnPrimary({ children, onClick, size = 'md' }) {
  const pad = size === 'lg' ? '18px 40px' : '14px 28px';
  const fs  = size === 'lg' ? 17 : 15;
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: pad, borderRadius: 10,
      background: NAVY, color: WHITE,
      fontSize: fs, fontWeight: 700, border: 'none',
      cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
      boxShadow: '0 4px 20px rgba(10,37,64,0.28)',
      transition: 'all 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = '#0D3060'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(10,37,64,0.36)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = NAVY; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,37,64,0.28)'; }}
    >{children}</button>
  );
}

function BtnSecondary({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '13px 26px', borderRadius: 10,
      background: WHITE, color: CHALK,
      fontSize: 15, fontWeight: 600,
      border: `1.5px solid ${BORDER}`,
      cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
      transition: 'all 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = BG2; e.currentTarget.style.borderColor = '#CBD5E0'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = WHITE; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = 'none'; }}
    >{children}</button>
  );
}

/* ════════════════════════════════════════
   MAIN
════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate();

  const r1 = useFadeIn(0);
  const r2 = useFadeIn(0);
  const r3 = useFadeIn(0);
  const r4 = useFadeIn(0);
  const r5 = useFadeIn(0);
  const r6 = useFadeIn(0);
  const r7 = useFadeIn(0);
  const r8 = useFadeIn(0);

  return (
    <div style={{
      background: WHITE, color: CHALK,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      overflowX: 'hidden', lineHeight: 1.6,
    }}>

      {/* ══════════════════════════
          1. 네비게이션
      ══════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ ...W, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span onClick={() => navigate('/')} style={{
            fontSize: 20, fontWeight: 800, letterSpacing: '-0.05em', color: NAVY, cursor: 'pointer',
          }}>PURIT</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('/login')} style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'none', color: MUTED,
              fontSize: 14, fontWeight: 500, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = CHALK}
            onMouseLeave={e => e.currentTarget.style.color = MUTED}
            >로그인</button>

            <button onClick={() => navigate('/login?role=company')} style={{
              padding: '9px 20px', borderRadius: 8,
              background: NAVY, color: WHITE,
              fontSize: 14, fontWeight: 700, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >무료로 시작하기</button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════
          2. 히어로
      ══════════════════════════ */}
      <section style={{ padding: '140px 32px 120px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }} ref={r1}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: BG2, border: `1px solid ${BORDER}`,
            borderRadius: 100, padding: '7px 18px',
            fontSize: 13, color: MUTED, marginBottom: 40, fontWeight: 500,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            AI Purit Filter 실시간 가동 중
          </div>

          <h1 style={{
            fontSize: 'clamp(38px, 5.8vw, 68px)',
            fontWeight: 800, letterSpacing: '-0.05em',
            lineHeight: 1.1, color: CHALK,
            marginBottom: 30,
          }}>
            광고비를 집행하기 전,<br /><span style={{ color: NAVY }}>전환 소재부터 검증하십시오.</span>
          </h1>

          <p style={{
            fontSize: 19, color: MUTED, lineHeight: 1.85,
            maxWidth: 620, margin: '0 auto 52px',
          }}>
            상위 5% 현업 전문가 패널이 당신의 마케팅 에셋을 직접 해체하고 분석합니다.<br />
            기업별 검증 목적과 페르소나에 완벽히 정렬된 맞춤형 인사이트를<br />
            48시간 내에 수령하십시오.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <BtnPrimary onClick={() => navigate('/login?role=company')}>
              무료로 시작하기 <ArrowRight size={17} />
            </BtnPrimary>
            <BtnSecondary onClick={() => navigate('/login')}>
              데모 신청
            </BtnSecondary>
          </div>

          <div style={{ fontSize: 14, color: FAINT }}>
            현재 <strong style={{ color: MUTED }}>312개</strong> 기업이 광고비를 아끼고 있습니다
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          3. 숫자 임팩트
      ══════════════════════════ */}
      <section style={{ background: NAVY }}>
        <div style={{ ...W }} ref={r2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { val: '48h',   label: '피드백 수집 완료' },
              { val: '100%',  label: 'Purit Filter 통과 수율' },
              { val: '40%+',  label: '평균 전환율 개선' },
              { val: '₩800만', label: '평균 절감 광고비' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '72px 32px', textAlign: 'center',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}>
                <div style={{
                  fontSize: 'clamp(40px, 5vw, 64px)',
                  fontWeight: 800, letterSpacing: '-0.05em',
                  color: WHITE, lineHeight: 1, marginBottom: 14,
                }}>{m.val}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          4. 고통점 공감
      ══════════════════════════ */}
      <section style={{ padding: '72px 32px', background: BG2, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ ...W }} ref={r3}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: 'clamp(20px, 2.8vw, 30px)', fontWeight: 700, letterSpacing: '-0.03em', color: CHALK }}>
              이런 경험 있으신가요?
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { icon: '📉', pain: '광고비를 쏟아부었는데 전환율이 왜 이런지 모르겠다' },
              { icon: '😶', pain: '내부에서는 좋다고 했는데 막상 시장 반응이 없다' },
              { icon: '⏳', pain: 'A/B 테스트 할 시간도 예산도 없다' },
            ].map((c, i) => (
              <div key={i} style={{
                background: WHITE, border: `1px solid ${BORDER}`,
                borderRadius: 14, padding: '24px 24px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1.4 }}>{c.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: CHALK, lineHeight: 1.6, letterSpacing: '-0.01em' }}>
                  "{c.pain}"
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          5. 솔루션
      ══════════════════════════ */}
      <section style={{ padding: '140px 32px' }}>
        <div style={{ ...W }} ref={r4}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <SectionLabel>솔루션</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.04em', color: CHALK }}>
              PURIT가 해결합니다
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[
              {
                icon: '🔍', tag: '사전 검증', title: '전환 결함을 집행 전에 잡는다',
                points: ['랜딩페이지·카피·가격 페이지 검증', '이탈 요소 사전 식별'],
              },
              {
                icon: '📐', tag: '5차원 진단', title: '어디서 막히는지 정확히 안다',
                points: ['명확성·관련성·가치·차별화·신뢰 분석', '정량 데이터 기반 진단'],
              },
              {
                icon: '⚡', tag: 'AI 리포트', title: '읽자마자 바로 실행 가능하다',
                points: ['우선순위별 개선 액션 자동 생성', '추측 없이 데이터로만'],
              },
              {
                icon: '🎯', tag: 'ICP 리서치', title: '타겟의 언어로 메시지를 맞춘다',
                points: ['고객의 고통점·구매 트리거 파악', '광고 집행 전 메시지 정렬'],
              },
            ].map((f, i) => (
              <div key={i} style={{
                background: BG2, border: `1px solid ${BORDER}`,
                borderRadius: 18, padding: '32px 32px',
                display: 'flex', gap: 24, alignItems: 'flex-start',
                transition: 'all 0.22s', cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = WHITE; e.currentTarget.style.boxShadow = '0 16px 48px rgba(10,37,64,0.09)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#CBD5E0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = BG2; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = BORDER; }}
              >
                {/* 아이콘 */}
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: WHITE, border: `1px solid ${BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>{f.icon}</div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: 'rgba(10,37,64,0.07)', borderRadius: 6,
                    padding: '3px 10px', fontSize: 11, fontWeight: 700,
                    color: NAVY, letterSpacing: '0.06em', marginBottom: 10,
                  }}>{f.tag}</div>

                  <div style={{ fontSize: 18, fontWeight: 800, color: CHALK, letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.35 }}>
                    {f.title}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {f.points.map(p => (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: NAVY, opacity: 0.4, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: MUTED }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          6. 작동 방식
      ══════════════════════════ */}
      <section style={{ background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '140px 32px' }}>
        <div style={{ ...W }} ref={r5}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <SectionLabel>작동 방식</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.04em', color: CHALK }}>
              2분 등록, 48시간 안에 결과
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 27, left: 'calc(16.66% + 20px)', right: 'calc(16.66% + 20px)', height: 1, background: NAVY, opacity: 0.1 }} />
            {[
              { n: '1', step: '1단계 — 의뢰 등록', desc: '타겟 페르소나와 검증할 랜딩페이지 URL을 입력합니다. 2분이면 충분합니다.', tag: '약 2분' },
              { n: '2', step: '2단계 — 전문가 매칭', desc: 'Purit Filter를 통과한 동일 페르소나 전문가가 자동으로 매칭됩니다.', tag: '자동 처리' },
              { n: '3', step: '3단계 — 결과 수령', desc: 'AI 리포트와 함께 우선순위별 개선 액션을 48시간 내에 확인합니다.', tag: '48시간 내' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '0 40px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: NAVY, color: WHITE,
                  fontSize: 18, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 32,
                  boxShadow: '0 4px 16px rgba(10,37,64,0.22)',
                }}>{s.n}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: FAINT, marginBottom: 10, letterSpacing: '0.01em' }}>{s.step}</div>
                <div style={{ fontSize: 16, color: MUTED, lineHeight: 1.8, marginBottom: 20 }}>{s.desc}</div>
                <div style={{ display: 'inline-flex', background: BG3, borderRadius: 100, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: NAVY }}>{s.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          7. 비교 섹션
      ══════════════════════════ */}
      <section style={{ padding: '140px 32px' }}>
        <div style={{ ...W }} ref={r6}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <SectionLabel>차별화</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.04em', color: CHALK, marginBottom: 14 }}>
              기존 방식과 무엇이 다른가요?
            </h2>
            <p style={{ fontSize: 17, color: MUTED }}>수율, 속도, 전문성 — 세 가지 모두에서 차원이 다릅니다.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'stretch' }}>
            {/* 일반 설문 서비스 */}
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '36px 32px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: FAINT, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>일반 설문 서비스</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
                {['무작위 응답자', '데이터 품질 보장 없음', '수율 1% 미만', '결과까지 2~4주'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <X size={15} color="#EF4444" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: MUTED }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 마케팅 에이전시 */}
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '36px 32px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: FAINT, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>마케팅 에이전시</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
                {['내부 팀의 주관적 판단', '비용 수천만 원', '실제 타겟 검증 없음'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <X size={15} color="#EF4444" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: MUTED }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PURIT */}
            <div style={{ background: NAVY, border: `1px solid ${NAVY}`, borderRadius: 20, padding: '36px 32px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>PURIT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
                {['동일 페르소나 전문가 패널', 'Purit Filter 품질 보장', '수율 100%', '48시간 결과'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Check size={15} color="#22C55E" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          8. 후기 섹션
      ══════════════════════════ */}
      <section style={{ background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '140px 32px' }}>
        <div style={{ ...W }} ref={r7}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel>고객 후기</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.04em', color: CHALK }}>
              광고비를 아낀 기업들의 이야기
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              {
                quote: '헤드라인 하나 바꿨더니 전환율이 2배 됐어요',
                name: '김OO', role: '마케팅팀장', company: '커머스 브랜드',
              },
              {
                quote: 'A/B 테스트 대신 PURIT으로 먼저 검증하니 시간과 비용이 절반으로 줄었습니다',
                name: '이OO', role: '그로스', company: '스타트업',
              },
              {
                quote: '타겟 고객의 언어를 그대로 카피에 넣었더니 CTR이 3배 올랐습니다',
                name: '박OO', role: '퍼포먼스 마케터', company: 'D2C 브랜드',
              },
            ].map((r, i) => (
              <div key={i} style={{
                background: WHITE, border: `1px solid ${BORDER}`,
                borderRadius: 20, padding: '36px 32px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28,
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 40px rgba(10,37,64,0.09)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: CHALK, lineHeight: 1.5, letterSpacing: '-0.02em' }}>
                  "{r.quote}"
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: BG3, border: `1px solid ${BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: NAVY,
                  }}>{r.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: CHALK }}>{r.name}</div>
                    <div style={{ fontSize: 13, color: FAINT }}>{r.role} · {r.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          9. 하단 CTA
      ══════════════════════════ */}
      <section style={{ background: NAVY, padding: '140px 32px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }} ref={r7}>
          <h2 style={{
            fontSize: 'clamp(30px, 5vw, 56px)',
            fontWeight: 800, letterSpacing: '-0.05em',
            color: WHITE, lineHeight: 1.1, marginBottom: 22,
          }}>
            더 이상 감에 의존하여<br />광고비를 낭비하지 마십시오.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.52)', lineHeight: 1.8, marginBottom: 52 }}>
            지금 바로 시작하고, 48시간 안에 전환을 막고 있는 결함을 확인하세요.
          </p>
          <button
            onClick={() => navigate('/login?role=company')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '18px 40px', borderRadius: 12,
              background: WHITE, color: NAVY,
              fontSize: 17, fontWeight: 800, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.02em',
              boxShadow: '0 4px 24px rgba(255,255,255,0.14)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(255,255,255,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,255,255,0.14)'; }}
          >
            지금 전환율 개선 시작하기 <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* ══════════════════════════
          푸터
      ══════════════════════════ */}
      <footer style={{ background: '#060D1A', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ ...W, padding: '60px 32px 48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48, flexWrap: 'wrap', gap: 40 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.05em', color: WHITE, marginBottom: 10 }}>PURIT</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', lineHeight: 1.85, maxWidth: 260 }}>
                광고비 집행 전, 전환 결함을 먼저 잡는<br />고순도 피드백 인텔리전스 플랫폼
              </div>
            </div>
            <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
              {[
                { title: '서비스', links: ['서비스 소개', '기업 솔루션', '요금 안내', '문의하기'] },
                { title: '법적 고지', links: ['이용약관', '개인정보처리방침', '운영 정책'] },
              ].map((col) => (
                <div key={col.title}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18 }}>{col.title}</div>
                  {col.links.map(link => (
                    <div key={link}
                      style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)', marginBottom: 12, cursor: 'pointer', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = WHITE}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.42)'}
                    >{link}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© 2026 PURIT. All rights reserved.</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>사업자등록번호 000-00-00000 · 대표 홍길동</div>
          </div>
        </div>
      </footer>

      {/* 모바일 반응형 */}
      <style>{`
        @media (max-width: 900px) {
          .purit-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .purit-grid-3 { grid-template-columns: 1fr !important; }
          .purit-grid-2 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .purit-grid-4 { grid-template-columns: 1fr 1fr !important; }
          section { padding-top: 80px !important; padding-bottom: 80px !important; padding-left: 20px !important; padding-right: 20px !important; }
          footer > div { padding-left: 20px !important; padding-right: 20px !important; }
        }
      `}</style>
    </div>
  );
}
