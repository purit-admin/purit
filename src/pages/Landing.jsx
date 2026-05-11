import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import ExpertPanelCloud from '../components/ui/ExpertPanelCloud';
import { Step1Animation, Step2Animation, Step3Animation } from '../components/landing/StepAnimations';

/* ─── 색상 토큰 (Claude 팔레트) ───────── */
const BG      = '#F8FAFC';
const BG2     = '#EDF0F4';
const BG3     = '#DCDCDC';
const PRIMARY = '#10367D';
const TEXT    = '#0F172A';
const TEXT2   = '#475569';
const TEXT3   = '#94A3B8';
const SUCCESS = '#16A34A';
const DANGER  = '#DC2626';

/* ─── 스크롤 페이드인 훅 ─────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.65s ${delay}s cubic-bezier(0.22,1,0.36,1), transform 0.65s ${delay}s cubic-bezier(0.22,1,0.36,1)`;
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
const W = { maxWidth: 1100, margin: '0 auto', padding: '0 32px' };

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

  return (
    <div style={{
      background: BG, color: TEXT,
      fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: 'hidden', lineHeight: 1.6,
    }}>

      {/* ══════════════════════════
          1. 네비게이션
      ══════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div className="landing-nav-inner">
          <span onClick={() => navigate('/')} style={{
            fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em',
            fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic',
            color: TEXT, cursor: 'pointer',
          }}>Purit</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('/login')} style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'none', color: TEXT2,
              fontSize: 14, fontWeight: 500, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = TEXT}
            onMouseLeave={e => e.currentTarget.style.color = TEXT2}
            >로그인</button>

            <button onClick={() => navigate('/login?role=company')} style={{
              padding: '10px 20px', borderRadius: 8,
              background: PRIMARY, color: BG,
              fontSize: 14, fontWeight: 600, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >무료로 시작하기</button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════
          2. 히어로
      ══════════════════════════ */}
      <section className="landing-hero" style={{ background: BG }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }} ref={r1}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: BG3,
            borderRadius: 100, padding: '7px 18px',
            fontSize: 13, color: PRIMARY, marginBottom: 36, fontWeight: 600,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: SUCCESS, display: 'inline-block' }} />
            실시간 검증 진행 중
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 4.5vw, 52px)',
            fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 1.25, color: TEXT,
            marginBottom: 28, wordBreak: 'keep-all',
          }}>
            고객이 '뒤로 가기'를 누르는 이유,<br />
            <span style={{ color: PRIMARY }}>마케터 30명에게 물어보세요.</span>
          </h1>

          <p style={{
            fontSize: 18, color: TEXT2, lineHeight: 1.8,
            maxWidth: 580, margin: '0 auto 44px',
          }}>
            타겟 분야의 마케팅 전문가 패널이 여러분의 마케팅 소재를 직접 평가하고,<br />
            전환율을 높이는 피드백을 48시간 안에 줍니다.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            <button onClick={() => navigate('/login?role=company')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '16px 32px', borderRadius: 12,
              background: PRIMARY, color: BG,
              fontSize: 16, fontWeight: 700, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
              transition: 'all 0.2s', height: 52,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            >
              무료로 시작해보세요 <ArrowRight size={17} />
            </button>
          </div>

          <div style={{ fontSize: 14, color: TEXT3 }}>
            현재 <strong style={{ color: TEXT2 }}>312개</strong> 기업이 사용 중입니다
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          3. 숫자 임팩트
      ══════════════════════════ */}
      <section style={{ background: BG2, borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ ...W }}>
        <div className="landing-grid-4" ref={r2}>
          {[
              { val: '48h',   label: '피드백 수집 완료' },
              { val: '100%',  label: '검증된 응답' },
              { val: '40%',   label: '평균 전환율 개선' },
              { val: '800만 원', label: '평균 절감 광고비' },
            ].map((m, i) => (
              <div key={i} className={i < 3 ? 'stat-divider-right' : ''} style={{
                padding: '48px 32px', textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 'clamp(28px, 3.2vw, 46px)',
                  fontWeight: 800, letterSpacing: '-0.04em',
                  color: PRIMARY, lineHeight: 1, marginBottom: 12,
                }}>{m.val}</div>
                <div style={{ fontSize: 14, color: TEXT3, fontWeight: 500 }}>{m.label}</div>
              </div>
            ))}
        </div>
        </div>
      </section>

      {/* ══════════════════════════
          4. 고통점 공감
      ══════════════════════════ */}
      <section className="landing-section" style={{ background: BG }}>
        <div style={{ ...W }} ref={r3}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700, letterSpacing: '-0.03em', color: TEXT }}>
              혹시 이런 상황이지 않나요?
            </h2>
          </div>
          <div className="landing-grid-3">
            {[
              { icon: '📉', pain: '광고비를 쏟아부었는데 전환율이 왜 이런지 모르겠다' },
              { icon: '😶', pain: '내부에서는 좋다고 했는데 막상 시장 반응이 없다' },
              { icon: '⏳', pain: 'A/B 테스트 할 시간도 예산도 없다' },
            ].map((c, i) => (
              <div key={i} style={{
                background: BG2,
                borderRadius: 16, padding: '24px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1.4 }}>{c.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.6, letterSpacing: '-0.01em' }}>
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
      <section className="landing-section" style={{ background: BG2 }}>
        <div style={{ ...W }} ref={r4}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              display: 'inline-block', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: PRIMARY, background: BG3,
              borderRadius: 6, padding: '5px 12px', marginBottom: 20,
            }}>솔루션</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.04em', color: TEXT }}>
              PURIT이 이렇게 해결해 드립니다
            </h2>
          </div>

          <div className="landing-grid-2">
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
                background: BG, borderRadius: 16, padding: '28px 28px',
                display: 'flex', gap: 20, alignItems: 'flex-start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s', cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: BG3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>{f.icon}</div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: BG3, borderRadius: 6,
                    padding: '3px 10px', fontSize: 11, fontWeight: 700,
                    color: PRIMARY, letterSpacing: '0.06em', marginBottom: 10,
                  }}>{f.tag}</div>

                  <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.4 }}>
                    {f.title}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {f.points.map(p => (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: PRIMARY, opacity: 0.5, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: TEXT2 }}>{p}</span>
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
      <section className="landing-section" style={{ background: BG }}>
        <div style={{ ...W }} ref={r5}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{
              display: 'inline-block', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: PRIMARY, background: BG3,
              borderRadius: 6, padding: '5px 12px', marginBottom: 20,
            }}>작동 방식</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.04em', color: TEXT }}>
              5분 등록, 48시간 안에 결과
            </h2>
          </div>

          <div className="landing-grid-3-steps">
            {[
              { n: '1', Anim: Step1Animation, step: '의뢰 등록', desc: '타겟 페르소나와 검증할 소재를 업로드합니다. 5분이면 충분합니다.', tag: '약 5분' },
              { n: '2', Anim: Step2Animation, step: '전문가 매칭', desc: 'Purit Filter를 통과한 동일 페르소나 전문가가 자동으로 매칭됩니다.', tag: '자동 처리' },
              { n: '3', Anim: Step3Animation, step: '결과 수령', desc: '피드백 결과와 함께 개선 우선순위를 48시간 내에 확인합니다.', tag: '48시간 내' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '0 8px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: PRIMARY, color: BG,
                  fontSize: 17, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 24,
                }}>{s.n}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 10, letterSpacing: '-0.02em' }}>{s.step}</div>
                <div style={{ fontSize: 15, color: TEXT2, lineHeight: 1.75, marginBottom: 16 }}>{s.desc}</div>
                <div style={{ display: 'inline-flex', background: BG3, borderRadius: 100, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 28 }}>{s.tag}</div>
                {/* 애니메이션 목업 프레임 */}
                <div style={{
                  width: '100%', height: 220, borderRadius: 16,
                  border: '1px solid #E2E8F0', overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}>
                  <s.Anim />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════
          6.5 전문가 패널 소개
      ══════════════════════════ */}
      <ExpertPanelCloud />

      {/* ══════════════════════════
          7. 비교 섹션
      ══════════════════════════ */}
      <section className="landing-section" style={{ background: BG2 }}>
        <div style={{ ...W }} ref={r6}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              display: 'inline-block', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: PRIMARY, background: BG3,
              borderRadius: 6, padding: '5px 12px', marginBottom: 20,
            }}>차별화</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.04em', color: TEXT, marginBottom: 12 }}>
              기존 방식과 무엇이 다른가요?
            </h2>
            <p style={{ fontSize: 16, color: TEXT2 }}>수율, 속도, 전문성 — 세 가지 모두 다릅니다.</p>
          </div>

          <div className="landing-grid-3" style={{ alignItems: 'stretch' }}>
            <div style={{ background: BG, borderRadius: 16, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24 }}>일반 설문 서비스</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {['무작위 응답자', '데이터 품질 보장 없음', '수율 1% 미만', '결과까지 2~4주'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <X size={15} color={DANGER} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: TEXT2 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: BG, borderRadius: 16, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24 }}>마케팅 에이전시</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {['내부 팀의 주관적 판단', '비용 수천만 원', '실제 타겟 검증 없음'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <X size={15} color={DANGER} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: TEXT2 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: BG3, borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 20px rgba(37,99,235,0.12)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24 }}>PURIT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {['동일 페르소나 전문가 패널', 'Purit Filter 품질 보장', '수율 100%', '48시간 결과'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Check size={15} color={SUCCESS} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: TEXT, fontWeight: 500 }}>{t}</span>
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
      <section className="landing-section" style={{ background: BG }}>
        <div style={{ ...W }} ref={r7}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              display: 'inline-block', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: PRIMARY, background: BG3,
              borderRadius: 6, padding: '5px 12px', marginBottom: 20,
            }}>고객 후기</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.04em', color: TEXT }}>
              이미 바꿔놓은 기업들의 이야기
            </h2>
          </div>

          <div className="landing-grid-3">
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
                background: BG2,
                borderRadius: 16, padding: '28px 28px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 24,
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.07)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, lineHeight: 1.55, letterSpacing: '-0.02em' }}>
                  "{r.quote}"
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: BG3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: PRIMARY,
                  }}>{r.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{r.name}</div>
                    <div style={{ fontSize: 13, color: TEXT3 }}>{r.role} · {r.company}</div>
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
      <section className="landing-section" style={{ background: '#EDF0F4' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 48px)',
            fontWeight: 800, letterSpacing: '-0.04em',
            color: TEXT, lineHeight: 1.15, marginBottom: 20,
          }}>
            지금 무료로 시작해보세요.
          </h2>
          <p style={{ fontSize: 17, color: TEXT2, lineHeight: 1.75, marginBottom: 44 }}>
            48시간 안에 전환을 막고 있는 원인을 확인하세요.
          </p>
          <button
            onClick={() => navigate('/login?role=company')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '18px 40px', borderRadius: 12,
              background: PRIMARY, color: BG,
              fontSize: 17, fontWeight: 700, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
              transition: 'all 0.2s', height: 56,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
          >
            무료로 시작하기 <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* ══════════════════════════
          푸터
      ══════════════════════════ */}
      <footer style={{ background: '#F8FAFC' }}>
        <div className="landing-footer-inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, flexWrap: 'wrap', gap: 40 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em', color: TEXT, marginBottom: 10 }}>PURIT</div>
              <div style={{ fontSize: 13, color: TEXT3, lineHeight: 1.8, maxWidth: 240 }}>
                광고비 집행 전, 전환 결함을 먼저 잡는<br />고순도 피드백 검증 플랫폼
              </div>
            </div>
            <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
              {[
                { title: '서비스', links: ['서비스 소개', '기업 솔루션', '요금 안내', '문의하기'] },
                { title: '법적 고지', links: ['이용약관', '개인정보처리방침', '운영 정책'] },
              ].map((col) => (
                <div key={col.title}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>{col.title}</div>
                  {col.links.map(link => (
                    <div key={link}
                      style={{ fontSize: 14, color: TEXT2, marginBottom: 12, cursor: 'pointer', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = TEXT}
                      onMouseLeave={e => e.currentTarget.style.color = TEXT2}
                    >{link}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid #E2E8F0`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: TEXT3 }}>© 2026 PURIT. All rights reserved.</div>
            <div style={{ fontSize: 13, color: TEXT3 }}>사업자등록번호 000-00-00000 · 대표 홍길동</div>
          </div>
        </div>
      </footer>

    </div>
  );
}
