import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Step1Animation, Step2Animation, Step3Animation } from '../components/landing/StepAnimations';
import { useAuth } from '../context/AuthContext';
import './landing.css';

/* ════════════════════════════════════════════════════════════
   Purit 랜딩 — design_handoff_purit_landing 디자인 이식
   ※ "작동 방식(5분 등록, 48시간 안에 결과)" 섹션만 기존 코드 그대로 유지
     (요청: 새 파일의 "신청부터 결과까지, 3단계" 대신 후자 유지)
════════════════════════════════════════════════════════════ */

const DASH_PATH = { company: '/company', panel: '/panel', admin: '/admin' };

/* ─── "작동 방식" 섹션 전용 색상 상수 (기존 코드 유지분) ─── */
const BG      = '#F8FAFC';
const BG3     = '#DCDCDC';
const PRIMARY = '#10367D';
const TEXT    = '#0F172A';
const TEXT2   = '#475569';

/* ─── 기존 "작동 방식" 섹션 스크롤 페이드인 훅 (유지) ─── */
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

/* ─── 레이더 차트 (purit.js buildRadar 포팅) ─── */
const RADAR_DIMS = [
  { label: '명확성', value: 4.2 },
  { label: '관련성', value: 3.8 },
  { label: '가치',   value: 4.1 },
  { label: '차별화', value: 3.5 },
  { label: '신뢰',   value: 3.9 },
];
function Radar({ large = false }) {
  const cx = 100, cy = 100, R = large ? 64 : 72, max = 5, n = RADAR_DIMS.length;
  const pt = (i, r) => {
    const a = (-90 + i * (360 / n)) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ringPts = (frac) =>
    RADAR_DIMS.map((_, i) => pt(i, R * frac).map(v => v.toFixed(1)).join(',')).join(' ');
  const dataPts = RADAR_DIMS.map((d, j) => pt(j, R * (d.value / max)));
  return (
    <svg viewBox="0 0 200 200">
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <polygon key={frac} points={ringPts(frac)} fill="none" stroke="rgba(16,54,125,0.12)" strokeWidth="1" />
      ))}
      {RADAR_DIMS.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="rgba(16,54,125,0.12)" strokeWidth="1" />;
      })}
      <polygon
        points={dataPts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}
        fill="rgba(16,54,125,0.16)" stroke="#10367D" strokeWidth="2" strokeLinejoin="round"
      />
      {dataPts.map((q, i) => (
        <circle key={i} cx={q[0].toFixed(1)} cy={q[1].toFixed(1)} r="3" fill="#10367D" />
      ))}
      {large && RADAR_DIMS.map((d, l) => {
        const lp = pt(l, R + 18);
        return (
          <text
            key={l} x={lp[0].toFixed(1)} y={lp[1].toFixed(1)}
            textAnchor={lp[0] > cx + 5 ? 'start' : (lp[0] < cx - 5 ? 'end' : 'middle')}
            dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#475569"
            fontFamily="'Pretendard', sans-serif"
          >{d.label}</text>
        );
      })}
    </svg>
  );
}

/* ─── 숫자 카운트업 (purit.js runCounter 포팅) ─── */
function Counter({ to }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = String(to); return; }
    let started = false;
    const run = () => {
      if (started) return; started = true;
      const dur = 1400; let start = null;
      const step = (ts) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(step); else el.textContent = String(to);
      };
      requestAnimationFrame(step);
    };
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); obs.disconnect(); } }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);
  return <b ref={ref}>0</b>;
}

/* ─── 전문가 클라우드 (purit.js expert cloud 포팅) ─── */
const CREDS = [
  { t: '10년차 광고 마케터', c: '' },
  { t: '온라인 쇼핑몰 마케터', c: 't-green' },
  { t: '가격 전략 담당자', c: '' },
  { t: '대기업 브랜드 담당자', c: 't-amber' },
  { t: '핀테크 마케터', c: '' },
  { t: '정기구독 서비스 마케터', c: 't-green' },
  { t: '7년차 콘텐츠 기획자', c: '' },
  { t: '자체 브랜드 마케팅 책임자', c: 't-amber' },
  { t: '구매 단계 개선 전문가', c: 't-green' },
  { t: '스타트업 마케팅 총괄', c: '' },
  { t: '광고 문구 카피라이터', c: '' },
  { t: '단골 만들기 마케터', c: 't-green' },
  { t: '광고 디자인 책임자', c: 't-amber' },
  { t: '11년차 온라인 마케터', c: '' },
  { t: '소프트웨어 영업 담당자', c: '' },
  { t: '서비스 성장 기획자', c: 't-green' },
  { t: '브랜드 전략 전문가', c: 't-amber' },
  { t: '이메일 마케팅 전문가', c: '' },
  { t: '8년차 광고 운영자', c: 't-green' },
  { t: '쇼핑 데이터 분석가', c: '' },
];
const CLOUD_POS = CREDS.map((_, i) => {
  const cols = 5, rows = 4;
  const col = i % cols, row = Math.floor(i / cols);
  const jx = Math.sin(i * 12.9898) * 5.0;
  const jy = Math.cos(i * 4.1414) * 6.0;
  return { x: 9 + col * (82 / (cols - 1)) + jx, y: 16 + row * (68 / (rows - 1)) + jy };
});
function ExpertCloud() {
  const tagsRef = useRef([]);
  useEffect(() => {
    const nodes = tagsRef.current.filter(Boolean);
    if (!nodes.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      nodes.forEach((tag, i) => {
        if (i % 5 < 4) { tag.style.opacity = i % 5 === 0 ? '1' : '0.85'; tag.style.transform = 'translate(-50%,-50%) scale(1)'; }
      });
      return;
    }
    const N = nodes.length;
    const T_CYCLE = 20000, STAGGER = T_CYCLE / N, T_IN = 1000, T_HOLD = 1800, T_OUT = 1200;
    const paused = {}, pauseStart = {};
    const enter = [], leave = [];
    nodes.forEach((tag, i) => {
      paused[i] = 0;
      enter[i] = () => { pauseStart[i] = performance.now(); };
      leave[i] = () => { if (pauseStart[i]) { paused[i] += performance.now() - pauseStart[i]; pauseStart[i] = 0; } };
      tag.addEventListener('mouseenter', enter[i]);
      tag.addEventListener('mouseleave', leave[i]);
    });
    const t0 = performance.now();
    let raf;
    const loop = (now) => {
      for (let k = 0; k < N; k++) {
        const pausedMs = paused[k] + (pauseStart[k] ? now - pauseStart[k] : 0);
        const phase = (((now - t0 - k * STAGGER - pausedMs) % T_CYCLE) + T_CYCLE) % T_CYCLE;
        let op = 0, sc = 0.8, dy = 10;
        if (phase < T_IN) {
          const p1 = phase / T_IN; op = p1; sc = 0.8 + 0.2 * p1; dy = 10 * (1 - p1);
        } else if (phase < T_IN + T_HOLD) {
          op = 1; sc = 1; dy = 0;
        } else if (phase < T_IN + T_HOLD + T_OUT) {
          const p2 = (phase - T_IN - T_HOLD) / T_OUT; op = 1 - p2; sc = 1 - 0.06 * p2; dy = -8 * p2;
        }
        nodes[k].style.opacity = op.toFixed(3);
        nodes[k].style.transform = `translate(-50%,calc(-50% + ${dy.toFixed(1)}px)) scale(${sc.toFixed(3)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      nodes.forEach((tag, i) => {
        tag.removeEventListener('mouseenter', enter[i]);
        tag.removeEventListener('mouseleave', leave[i]);
      });
    };
  }, []);
  return (
    <div className="cloud reveal" id="cloud" aria-hidden="true">
      {CREDS.map((cred, i) => (
        <div
          key={i}
          ref={(el) => { tagsRef.current[i] = el; }}
          className={`expert-tag ${cred.c}`}
          style={{ left: `${CLOUD_POS[i].x}%`, top: `${CLOUD_POS[i].y}%`, transform: 'translate(-50%,-50%) scale(.8)', opacity: 0 }}
        >
          <span className="et-dot" />{cred.t}
        </div>
      ))}
    </div>
  );
}

/* ─── 브랜드 마름모 로고 ─── */
function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 2.5 28.5 16 16 29.5 3.5 16 16 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 9 23 16 16 23 9 16 16 9Z" fill="currentColor" />
      </svg>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const dashPath = DASH_PATH[role] ?? '/company';

  const rootRef = useRef(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const r5 = useFadeIn(0); // "작동 방식" 섹션 (유지분)

  /* nav scrolled state */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* scroll reveal */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
    }, { threshold: 0.18 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* 앵커 스무스 스크롤 */
  const goTo = (id) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const startFree = () => navigate(user ? dashPath : '/signup?role=company');

  return (
    <div className="purit-landing" ref={rootRef}>

      {/* ============ NAV ============ */}
      <header className={`nav${navScrolled ? ' scrolled' : ''}`} id="nav">
        <div className="nav-inner">
          <span className="brand" onClick={() => navigate('/')}>
            <BrandMark />
            <span className="brand-name">Purit</span>
          </span>
          <nav className="nav-links" aria-label="주요 메뉴">
            <a onClick={() => goTo('how')}>이용 방법</a>
            <a onClick={() => goTo('filter')}>Purit Filter</a>
            <a onClick={() => goTo('panel')}>참여 전문가</a>
            <a onClick={() => goTo('pricing')}>요금</a>
          </nav>
          <div className="nav-cta">
            {user ? (
              <button className="btn btn-primary" onClick={() => navigate(dashPath)}>대시보드</button>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => navigate('/login')}>로그인</button>
                <button className="btn btn-primary" onClick={startFree}>무료로 시작하기</button>
              </>
            )}
          </div>
          <button
            className="nav-burger" aria-label="메뉴 열기" aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
        <div className="mobile-menu" hidden={!mobileOpen}>
          <a onClick={() => goTo('how')}>이용 방법</a>
          <a onClick={() => goTo('filter')}>사람이 직접</a>
          <a onClick={() => goTo('panel')}>참여 전문가</a>
          <a onClick={() => goTo('pricing')}>요금</a>
          <a className="btn btn-primary btn-block" onClick={startFree}>무료로 시작하기</a>
        </div>
      </header>

      <main id="top">

        {/* ============ HERO ============ */}
        <section className="hero">
          <div className="hero-grid container">
            <div className="hero-copy">
              <span className="eyebrow reveal">AI 말고, 사람이 평가해요</span>
              <h1 className="hero-title reveal">고객의 뒤로가기,<br />
                <em className="accent">진짜 전문가</em>가<br />
                <span className="nowrap">짚어줍니다</span></h1>
              <p className="hero-sub reveal">현직 마케팅 전문가들이 당신의 광고·페이지를 직접 보고,<br />
                전환을 막는 한 줄까지 진짜 사람이 짚어드립니다.</p>
              <div className="hero-actions reveal">
                <button className="btn btn-primary btn-lg" onClick={startFree}>
                  {user ? '대시보드로 이동' : '무료로 시작하기'}
                </button>
                <a className="btn btn-line btn-lg" onClick={() => goTo('how')}>이용 방법 보기</a>
              </div>
              <p className="hero-foot reveal">신용카드 없이 시작
                <span className="sep">·</span>48시간 안에 결과
                <span className="sep">·</span>100% 사람이 직접</p>
            </div>

            {/* LIVE PRODUCT MOCKUP */}
            <div className="hero-visual reveal">
              <div className="result-card">
                <div className="rc-head">
                  <div>
                    <span className="rc-tag mono">페이지 평가</span>
                    <h3 className="rc-title">PricePilot</h3>
                  </div>
                  <span className="rc-pass"><span className="dot-check" />전문가 10명 평가</span>
                </div>
                <div className="rc-body">
                  <div className="rc-radar">
                    <div className="radar-host"><Radar /></div>
                    <span className="rc-overall"><strong>3.9</strong><small>/ 5.0</small></span>
                  </div>
                  <div className="rc-bars">
                    <div className="bar-row"><span>명확성</span><div className="bar"><i style={{ '--w': '84%' }} /></div><b>4.2</b></div>
                    <div className="bar-row"><span>관련성</span><div className="bar"><i style={{ '--w': '76%' }} /></div><b>3.8</b></div>
                    <div className="bar-row"><span>가치</span><div className="bar"><i style={{ '--w': '82%' }} /></div><b>4.1</b></div>
                    <div className="bar-row"><span>차별화</span><div className="bar"><i style={{ '--w': '70%' }} /></div><b>3.5</b></div>
                    <div className="bar-row"><span>신뢰</span><div className="bar"><i style={{ '--w': '78%' }} /></div><b>3.9</b></div>
                  </div>
                </div>
                <div className="rc-comment">
                  <div className="rc-avatar mono">전문</div>
                  <div>
                    <p className="rc-q">"첫 화면 메시지는 힘있는데, 구매 버튼 근처에 믿음을 주는 요소가 없어서 고객이 망설일 것 같아요."</p>
                    <span className="rc-meta mono">10년차 마케팅 전문가</span>
                  </div>
                </div>
              </div>
              <div className="float-chip chip-1">
                <span className="dot-check" /> 사람이 직접 본 평가
              </div>
            </div>
          </div>
        </section>

        {/* ============ NUMBERS ============ */}
        <section className="numbers">
          <div className="container num-grid">
            <div className="num reveal">
              <span className="num-val"><Counter to={40} /><i>%</i></span>
              <p>평균 전환율 개선</p>
            </div>
            <div className="num reveal">
              <span className="num-val"><Counter to={100} /><i>%</i></span>
              <p>사람이 직접 평가</p>
            </div>
            <div className="num reveal">
              <span className="num-val"><Counter to={48} /><i>시간</i></span>
              <p>평균 결과 도착 시간</p>
            </div>
            <div className="num reveal">
              <span className="num-val"><Counter to={800} /><i>만원</i></span>
              <p>평균 광고비 절감</p>
            </div>
          </div>
        </section>

        {/* ============ PROBLEM ============ */}
        <section className="problem container" id="problem">
          <div className="sec-head reveal">
            <span className="eyebrow">왜 Purit인가</span>
            <h2 className="sec-title">"이 광고, 괜찮은 걸까?"<br />그 고민, 사람이 풀어줍니다.</h2>
            <p className="sec-lead">감과 AI로 정하기엔, 진짜 사람의 목소리가 빠져 있죠.</p>
          </div>
          <div className="prob-grid">
            <div className="prob-card reveal">
              <span className="prob-x">×</span>
              <h3>우리 회사 내 의견</h3>
              <p>이미 편견이 생겼어요. 모두 좋다고 했는데, 실제 결과는 좋지 않아요.</p>
            </div>
            <div className="prob-card reveal">
              <span className="prob-x">×</span>
              <h3>무작위 설문</h3>
              <p>우리 고객도 전문가도 아닌 답변.<br />알맹이가 없어요.</p>
            </div>
            <div className="prob-card reveal">
              <span className="prob-x">×</span>
              <h3>직접 비교 테스트</h3>
              <p>방문자도, 몇 주의 시간도 필요해요.<br />그동안 고객은 계속 떠나고요.</p>
            </div>
            <div className="prob-card prob-card--win reveal">
              <span className="dot-check big" />
              <h3>Purit</h3>
              <p>우리 분야의 진짜 전문가가,<br />진짜 사람의 눈으로 이틀 안에.</p>
            </div>
          </div>
        </section>

        {/* ============ FEATURES (4 test types) ============ */}
        <section className="features container" id="features">
          <div className="sec-head reveal">
            <span className="eyebrow">무엇을 평가하나요</span>
            <h2 className="sec-title">한 곳에서, 네 가지를 평가해요</h2>
            <p className="sec-lead">무엇을 올리든, 점수로 결과를 보여드려요.</p>
          </div>
          <div className="feat-grid">
            <article className="feat-card reveal">
              <span className="feat-no mono">01</span>
              <h3>랜딩페이지 종합 평가</h3>
              <p>랜딩페이지를 다섯 가지 기준으로 꼼꼼히. 전문가가 화면에 직접 의견을 남겨요.</p>
              <div className="feat-mock">
                <div className="mock-shot">
                  <span className="ann ann-1 mono">1</span>
                  <span className="ann ann-2 mono">2</span>
                  <span className="ann ann-3 mono">3</span>
                  <div className="mock-line w70" />
                  <div className="mock-line w40" />
                  <div className="mock-btn" />
                  <div className="mock-line w55" />
                  <div className="mock-line w35" />
                </div>
                <ul className="feat-dims">
                  <li>명확성</li><li>관련성</li><li>가치</li><li>차별화</li><li>신뢰</li>
                </ul>
              </div>
            </article>

            <article className="feat-card reveal">
              <span className="feat-no mono">02</span>
              <h3>두 가지 안 비교</h3>
              <p>두 버전 중 이기는 쪽을, 이유까지 함께.</p>
              <div className="ab-mock">
                <div className="ab-side"><span className="mono">A</span><i style={{ '--h': '52%' }} /><b>38%</b></div>
                <div className="ab-side ab-win"><span className="mono">B</span><i style={{ '--h': '90%' }} /><b>62%</b></div>
              </div>
            </article>

            <article className="feat-card reveal">
              <span className="feat-no mono">03</span>
              <h3>가격 페이지 평가</h3>
              <p>가격이 적당하게 느껴지는지 알아봐요.</p>
              <div className="mini-stat">
                <div><span className="mono">너무 비싸요</span><div className="bar sm"><i style={{ '--w': '72%' }} /></div></div>
                <div><span className="mono">구매 버튼 누르고 싶어요</span><div className="bar sm"><i style={{ '--w': '64%' }} /></div></div>
              </div>
            </article>

            <article className="feat-card reveal">
              <span className="feat-no mono">04</span>
              <h3>이메일 평가</h3>
              <p>보내기 전에, 답장하고 싶은 이메일인지 확인해요.</p>
              <div className="mail-mock">
                <div className="mail-line w80" />
                <div className="mail-line w60" />
                <div className="mail-line w90" />
                <span className="mail-reply"><span className="dot-check" /> 답장하고 싶어요 68%</span>
              </div>
            </article>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            작동 방식 (5분 등록, 48시간 안에 결과)
            ※ 기존 Landing.jsx 섹션 그대로 유지 — id="how" 부여하여 nav 앵커 연결
        ════════════════════════════════════════════════ */}
        <section className="landing-section" id="how" style={{ background: BG }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }} ref={r5}>
            <div style={{ textAlign: 'center', marginBottom: 72 }}>
              <div style={{
                display: 'inline-block', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: PRIMARY, background: BG3,
                borderRadius: 6, padding: '5px 12px', marginBottom: 20,
              }}>이용 방법</div>
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

        {/* ============ PURIT FILTER (dark) ============ */}
        <section className="filter" id="filter">
          <div className="container filter-inner">
            <div className="filter-copy reveal">
              <span className="eyebrow eyebrow-on-dark">왜 믿을 수 있나</span>
              <h2 className="sec-title on-dark">AI가 쏟아지는 시대,<br />사람이 직접 걸러내요</h2>
              <p className="sec-lead on-dark">성의 없는 답변, AI가 쓴 듯한 답변은 걸러내요. 진짜 사람이 남긴 평가만 전달되죠. 이 장치를 Purit Filter라고 불러요.</p>
              <ul className="filter-list on-dark">
                <li><span className="dot-check" /> AI가 쓴 것 같은 답변은 자동으로 걸러요</li>
                <li><span className="dot-check" /> 구체적이고 도움 되는 답변인지 점검해요</li>
                <li><span className="dot-check" /> 진짜 사람이 남긴 평가만 통과해요</li>
              </ul>
            </div>
            <div className="filter-visual reveal" aria-hidden="true">
              <div className="gate">
                <div className="gate-in mono">들어온 평가</div>
                <div className="gate-rows">
                  <div className="gate-row pass"><span className="dot-check" /><i>구체적이고 도움돼요</i><b className="mono">82</b></div>
                  <div className="gate-row pass"><span className="dot-check" /><i>꼼꼼하게 평가했어요</i><b className="mono">71</b></div>
                  <div className="gate-row fail"><span className="x">×</span><i>AI가 쓴 것 같아요</i><b className="mono">38</b></div>
                  <div className="gate-row pass"><span className="dot-check" /><i>골고루 평가했어요</i><b className="mono">69</b></div>
                  <div className="gate-row fail"><span className="x">×</span><i>너무 짧아요</i><b className="mono">41</b></div>
                </div>
                <div className="gate-out"><span className="dot-check" /> 통과한 평가만 전달돼요</div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ EXPERT PANEL ============ */}
        <section className="panel" id="panel">
          <div className="container">
            <div className="sec-head reveal">
              <span className="eyebrow">참여 전문가</span>
              <h2 className="sec-title">어떤 전문가들이 평가하나요?</h2>
              <p className="sec-lead">국가자료와 링크드인으로 경력을 100% 확인했어요. 딱 맞는 전문가만 연결해드려요.</p>
            </div>
            <ExpertCloud />
          </div>
        </section>

        {/* ============ 5 DIMENSIONS ============ */}
        <section className="dims container">
          <div className="dims-grid">
            <div className="dims-copy reveal">
              <span className="eyebrow">5가지 기준</span>
              <h2 className="sec-title">감이 아니라, 5가지 기준으로</h2>
              <p className="sec-lead">다섯 가지 기준으로 점수를 받아요. 잘한 점, 부족한 점이 숫자로 보이죠.</p>
              <ul className="dims-list">
                <li><b>명확성</b><span>한눈에 이해되나요</span></li>
                <li><b>관련성</b><span>우리 고객에게 맞나요</span></li>
                <li><b>가치</b><span>살 만하다고 느껴지나요</span></li>
                <li><b>차별화</b><span>다른 곳과 다른가요</span></li>
                <li><b>신뢰</b><span>믿음이 가나요</span></li>
              </ul>
            </div>
            <div className="dims-radar reveal">
              <div className="radar-host radar-lg"><Radar large /></div>
            </div>
          </div>
        </section>

        {/* ============ COMPARISON ============ */}
        <section className="compare container">
          <div className="sec-head reveal">
            <span className="eyebrow">왜 다른가</span>
            <h2 className="sec-title">기존 방법과 비교하면</h2>
          </div>
          <div className="compare-wrap reveal">
            <table className="compare-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="col-hl">Purit</th>
                  <th>내부·지인 검토</th>
                  <th>일반 설문</th>
                  <th>직접 테스트</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>진짜 고객 같은 전문가</td>
                  <td className="col-hl"><span className="dot-check" /></td>
                  <td><span className="x">×</span></td>
                  <td><span className="tilde">△</span></td>
                  <td><span className="dot-check" /></td>
                </tr>
                <tr>
                  <td>점수로 보는 결과</td>
                  <td className="col-hl"><span className="dot-check" /></td>
                  <td><span className="x">×</span></td>
                  <td><span className="dot-check" /></td>
                  <td><span className="tilde">△</span></td>
                </tr>
                <tr>
                  <td>AI 답변 걸러내기</td>
                  <td className="col-hl"><span className="dot-check" /></td>
                  <td><span className="x">×</span></td>
                  <td><span className="x">×</span></td>
                  <td><span className="x">×</span></td>
                </tr>
                <tr>
                  <td>걸리는 시간</td>
                  <td className="col-hl"><strong>48시간</strong></td>
                  <td>즉시~며칠</td>
                  <td>며칠</td>
                  <td>몇 주</td>
                </tr>
                <tr>
                  <td>방문자 필요</td>
                  <td className="col-hl"><span className="dot-check none">필요 없음</span></td>
                  <td>필요 없음</td>
                  <td>필요 없음</td>
                  <td><span className="x">많이 필요</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ TESTIMONIALS ============ */}
        <section className="quotes container">
          <div className="sec-head reveal">
            <span className="eyebrow">고객의 목소리</span>
            <h2 className="sec-title">출시 전에 알 수 있었던 것들</h2>
          </div>
          <div className="quote-grid">
            <figure className="quote-card reveal">
              <blockquote>"우리 눈엔 완벽한 문구, 고객에겐 애매했대요. 미리 고쳤더니 전환율이 2배가 됐죠."</blockquote>
              <figcaption><span className="q-av mono">K</span><span><b>김지원</b><i>마케팅 담당 · 핀테크 스타트업</i></span></figcaption>
            </figure>
            <figure className="quote-card reveal">
              <blockquote>"팀 의견이 갈릴 때, 전문가 평가가 답이 됐어요. 결정이 빨라지고 CTR이 3배 올랐죠."</blockquote>
              <figcaption><span className="q-av mono">L</span><span><b>이서연</b><i>마케터 · 온라인 쇼핑몰</i></span></figcaption>
            </figure>
            <figure className="quote-card reveal">
              <blockquote>"버릴 평가가 없었어요. 받는 의견마다 바로 써먹었더니 광고비가 절반으로 줄었죠."</blockquote>
              <figcaption><span className="q-av mono">P</span><span><b>박준호</b><i>대표 · 소프트웨어 회사</i></span></figcaption>
            </figure>
          </div>
        </section>

        {/* ============ PRICING ============ */}
        <section className="pricing" id="pricing">
          <div className="container">
            <div className="sec-head reveal">
              <span className="eyebrow">요금</span>
              <h2 className="sec-title">팀 규모에 맞게 시작하세요</h2>
              <p className="sec-lead">크레딧으로 이용해요. 쓴 만큼만 차감되고, 남으면 자동으로 돌려드려요.</p>
            </div>
            <div className="plan-grid">
              <article className="plan reveal">
                <h3 className="plan-name">Starter</h3>
                <p className="plan-price"><b>50</b><span>크레딧 / 월</span></p>
                <p className="plan-desc">처음 시작하는 작은 팀에게</p>
                <ul className="plan-feats">
                  <li><span className="dot-check" /> 전문가 10~15명</li>
                  <li><span className="dot-check" /> 실무 전문가</li>
                  <li><span className="dot-check" /> 네 가지 평가 모두 이용</li>
                  <li><span className="dot-check" /> 점수 결과 · 공유 링크</li>
                </ul>
                <a className="btn btn-line btn-block" onClick={startFree}>시작하기</a>
              </article>

              <article className="plan plan--hl reveal">
                <span className="plan-badge mono">가장 인기</span>
                <h3 className="plan-name">Pro</h3>
                <p className="plan-price"><b>165</b><span>크레딧 / 월</span></p>
                <p className="plan-desc">성장하는 팀을 위한 플랜</p>
                <ul className="plan-feats">
                  <li><span className="dot-check" /> 전문가 10~30명</li>
                  <li><span className="dot-check" /> 경력 많은 전문가 · 시니어·헤드급</li>
                  <li><span className="dot-check" /> AI 요약 결과 · 상세 분석</li>
                  <li><span className="dot-check" /> 팀 함께 쓰기 · 여러 신청 비교</li>
                </ul>
                <a className="btn btn-primary btn-block" onClick={startFree}>Pro로 시작하기</a>
              </article>

              <article className="plan reveal">
                <h3 className="plan-name">Enterprise</h3>
                <p className="plan-price"><b>400+</b><span>크레딧 / 월</span></p>
                <p className="plan-desc">대규모로, 전담 지원이 필요한 곳</p>
                <ul className="plan-feats">
                  <li><span className="dot-check" /> 전문가 무제한</li>
                  <li><span className="dot-check" /> 딱 맞는 고객만 골라 연결</li>
                  <li><span className="dot-check" /> 전담 담당자 지원</li>
                  <li><span className="dot-check" /> 맞춤 결제 · 우선 연결</li>
                </ul>
                <a className="btn btn-line btn-block" onClick={startFree}>영업팀 문의</a>
              </article>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="cta">
          <div className="container">
            <div className="cta-inner reveal">
              <h2>첫 신청은 무료예요</h2>
              <p>신용카드 없이 시작하세요. 진짜 사람의 평가를 이틀 안에.</p>
              <div className="cta-actions">
                <button className="btn btn-primary btn-lg" onClick={startFree}>
                  {user ? '대시보드로 이동' : '무료로 시작하기'}
                </button>
                <a className="btn btn-line-on-dark btn-lg" onClick={() => goTo('how')}>이용 방법 다시 보기</a>
              </div>
              <p style={{ position: 'relative', marginTop: 20, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>
                첫 신청 무료 · 카드 등록 없음 · 비용 0원
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <div className="container foot-inner">
          <div className="foot-brand">
            <span className="brand" onClick={() => navigate('/')}>
              <BrandMark />
              <span className="brand-name">Purit</span>
            </span>
            <p>진짜 전문가가 당신의 광고와 페이지를 직접 보고 평가해드려요.</p>
          </div>
          <div className="foot-cols">
            <div>
              <h4>제품</h4>
              <a onClick={() => goTo('features')}>페이지 종합 평가</a>
              <a onClick={() => goTo('features')}>두 가지 안 비교</a>
              <a onClick={() => goTo('features')}>가격 페이지 평가</a>
              <a onClick={() => goTo('features')}>이메일 평가</a>
            </div>
            <div>
              <h4>회사</h4>
              <a onClick={() => goTo('filter')}>평가 걸러내기</a>
              <a onClick={() => goTo('panel')}>참여 전문가</a>
              <a onClick={() => goTo('pricing')}>요금</a>
            </div>
            <div>
              <h4>시작하기</h4>
              <a onClick={() => navigate('/signup?role=company')}>기업으로 가입</a>
              <a onClick={() => navigate('/signup?role=panel')}>전문가로 참여</a>
              <a onClick={() => navigate('/login')}>로그인</a>
            </div>
          </div>
        </div>
        <div className="container foot-bottom">
          <span>© 2026 Purit. All rights reserved.</span>
          <span className="mono">감이 아니라 데이터로 일하는 분들을 위해.</span>
        </div>
      </footer>

    </div>
  );
}
