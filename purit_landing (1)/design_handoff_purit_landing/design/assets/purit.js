/* ============================================================
   Purit — Landing interactions
   ============================================================ */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav: scrolled state + mobile menu ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function () {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    var setMenu = function (open) {
      menu.hidden = !open;
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    burger.addEventListener('click', function () {
      setMenu(menu.hidden);
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }

  /* ---------- unified visibility check (robust across iframes) ---------- */
  var visTargets = []; // {el, cb, once, done}
  function watch(el, cb, threshold) {
    visTargets.push({ el: el, cb: cb, t: threshold || 0.88, done: false });
  }
  function checkVisible() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < visTargets.length; i++) {
      var v = visTargets[i];
      if (v.done) continue;
      var r = v.el.getBoundingClientRect();
      if (r.top < vh * v.t && r.bottom > 0) { v.done = true; v.cb(v.el); }
    }
  }
  window.addEventListener('scroll', checkVisible, { passive: true });
  window.addEventListener('resize', checkVisible);

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  reveals.forEach(function (el) {
    watch(el, function (t) { t.classList.add('in'); }, 0.92);
  });

  /* ---------- animated counters ---------- */
  var counters = document.querySelectorAll('[data-count]');
  var runCounter = function (el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (reduceMotion) { el.textContent = target; return; }
    var dur = 1400, start = null;
    var step = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };
    requestAnimationFrame(step);
  };
  counters.forEach(function (el) { watch(el, runCounter, 0.82); });

  /* ---------- radar chart ---------- */
  var DIMS = [
    { label: '명확성', value: 4.2 },
    { label: '관련성', value: 3.8 },
    { label: '가치', value: 4.1 },
    { label: '차별화', value: 3.5 },
    { label: '신뢰', value: 3.9 }
  ];
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function buildRadar(host) {
    var withLabels = host.classList.contains('radar-lg');
    var size = 200, cx = 100, cy = 100, R = withLabels ? 64 : 72, max = 5;
    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size });
    var n = DIMS.length;
    function pt(i, r) {
      var a = (-90 + i * (360 / n)) * Math.PI / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }
    // grid rings
    [0.25, 0.5, 0.75, 1].forEach(function (frac) {
      var pts = [];
      for (var i = 0; i < n; i++) pts.push(pt(i, R * frac).map(function (v) { return v.toFixed(1); }).join(','));
      svg.appendChild(el('polygon', {
        points: pts.join(' '),
        fill: 'none',
        stroke: 'rgba(16,54,125,0.12)',
        'stroke-width': 1
      }));
    });
    // axes
    for (var i = 0; i < n; i++) {
      var p = pt(i, R);
      svg.appendChild(el('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: 'rgba(16,54,125,0.12)', 'stroke-width': 1 }));
    }
    // data polygon
    var dpts = [];
    for (var j = 0; j < n; j++) dpts.push(pt(j, R * (DIMS[j].value / max)));
    var poly = el('polygon', {
      points: dpts.map(function (q) { return q.map(function (v) { return v.toFixed(1); }).join(','); }).join(' '),
      fill: 'rgba(16,54,125,0.16)',
      stroke: '#10367D',
      'stroke-width': 2,
      'stroke-linejoin': 'round'
    });
    svg.appendChild(poly);
    // vertices
    dpts.forEach(function (q) {
      svg.appendChild(el('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 3, fill: '#10367D' }));
    });
    // labels
    if (withLabels) {
      for (var l = 0; l < n; l++) {
        var lp = pt(l, R + 18);
        var t = el('text', {
          x: lp[0].toFixed(1), y: lp[1].toFixed(1),
          'text-anchor': lp[0] > cx + 5 ? 'start' : (lp[0] < cx - 5 ? 'end' : 'middle'),
          'dominant-baseline': 'middle',
          'font-size': 11, 'font-weight': 700, fill: '#475569',
          'font-family': "'Pretendard', sans-serif"
        });
        t.textContent = DIMS[l].label;
        svg.appendChild(t);
      }
    }
    // entrance animation
    if (!reduceMotion) {
      poly.style.transformOrigin = '100px 100px';
      poly.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    }
    host.appendChild(svg);
  }
  document.querySelectorAll('[data-radar]').forEach(function (host) {
    watch(host, buildRadar, 0.9);
  });

  /* ---------- expert cloud (floating credentials) ---------- */
  var CREDS = [
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
    { t: '쇼핑 데이터 분석가', c: '' }
  ];
  var cloud = document.getElementById('cloud');
  if (cloud) {
    var N = CREDS.length;
    var T_CYCLE = 20000, STAGGER = T_CYCLE / N, T_IN = 1000, T_HOLD = 1800, T_OUT = 1200;
    var nodes = [];
    // deterministic positions: 5 cols x 4 rows grid with jitter, kept off edges
    var cols = 5, rows = 4;
    for (var i = 0; i < N; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      var jx = Math.sin(i * 12.9898) * 5.0;
      var jy = Math.cos(i * 4.1414) * 6.0;
      var x = 9 + col * (82 / (cols - 1)) + jx; // %
      var y = 16 + row * (68 / (rows - 1)) + jy; // %
      var tag = document.createElement('div');
      tag.className = 'expert-tag ' + CREDS[i].c;
      tag.innerHTML = '<span class="et-dot"></span>' + CREDS[i].t;
      tag.style.left = x + '%';
      tag.style.top = y + '%';
      tag.style.transform = 'translate(-50%,-50%) scale(.8)';
      tag.style.opacity = '0';
      cloud.appendChild(tag);
      nodes.push(tag);
    }
    if (reduceMotion) {
      // show a static subset
      nodes.forEach(function (tag, i) {
        if (i % 5 < 4) { tag.style.opacity = i % 5 === 0 ? '1' : '0.85'; tag.style.transform = 'translate(-50%,-50%) scale(1)'; }
      });
    } else {
      var paused = {}; // index -> accumulated paused ms
      var pauseStart = {};
      nodes.forEach(function (tag, i) {
        paused[i] = 0;
        tag.addEventListener('mouseenter', function () { pauseStart[i] = performance.now(); });
        tag.addEventListener('mouseleave', function () {
          if (pauseStart[i]) { paused[i] += performance.now() - pauseStart[i]; pauseStart[i] = 0; }
        });
      });
      var t0 = performance.now();
      var loop = function (now) {
        for (var k = 0; k < N; k++) {
          var pausedMs = paused[k] + (pauseStart[k] ? now - pauseStart[k] : 0);
          var phase = (((now - t0 - k * STAGGER - pausedMs) % T_CYCLE) + T_CYCLE) % T_CYCLE;
          var op = 0, sc = 0.8, dy = 10;
          if (phase < T_IN) {
            var p1 = phase / T_IN;
            op = p1; sc = 0.8 + 0.2 * p1; dy = 10 * (1 - p1);
          } else if (phase < T_IN + T_HOLD) {
            op = 1; sc = 1; dy = 0;
          } else if (phase < T_IN + T_HOLD + T_OUT) {
            var p2 = (phase - T_IN - T_HOLD) / T_OUT;
            op = 1 - p2; sc = 1 - 0.06 * p2; dy = -8 * p2;
          } else {
            op = 0; sc = 0.8; dy = 10;
          }
          nodes[k].style.opacity = op.toFixed(3);
          nodes[k].style.transform = 'translate(-50%,calc(-50% + ' + dy.toFixed(1) + 'px)) scale(' + sc.toFixed(3) + ')';
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  /* ---------- kick off visibility checks ---------- */
  checkVisible();
  requestAnimationFrame(checkVisible);
  setTimeout(checkVisible, 250);
  setTimeout(checkVisible, 800);
  window.addEventListener('load', checkVisible);
})();
