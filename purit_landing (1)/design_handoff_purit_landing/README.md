# Handoff: Purit 랜딩페이지

## Overview
Purit는 "현직 마케팅 전문가가 당신의 광고·페이지를 직접 보고 평가해주는 서비스"를 소개하는
원페이지 마케팅 랜딩페이지입니다. 한국어 카피, 네이비 기반의 신뢰감 있는 톤, 그리고
"AI가 아닌 진짜 사람" 이라는 메시지를 시각적으로 강조하는 것이 핵심입니다.

이 문서는 이 대화에서 만든 HTML 디자인을 **실제 코드베이스에 그대로 옮겨 구현**하기 위한
개발자용 핸드오프 문서입니다.

## About the Design Files
이 번들의 `design/` 폴더에 든 파일들은 **HTML로 만든 디자인 레퍼런스**입니다.
의도한 룩앤필과 동작을 보여주는 프로토타입이며, 프로덕션 코드로 그대로 복사해 쓰는 것이
목적이 아닙니다.

목표는 이 HTML 디자인을 **타깃 코드베이스의 기존 환경(React, Vue, Next.js, SwiftUI 등)에서
그 프로젝트의 패턴·컴포넌트·디자인 시스템을 사용해 재구현**하는 것입니다.
아직 환경이 없다면, 프로젝트에 가장 적합한 프레임워크를 골라(예: Next.js + Tailwind)
디자인을 구현하면 됩니다.

## Fidelity
**High-fidelity (hifi).** 최종 색상·타이포·간격·인터랙션이 모두 확정된 픽셀 단위 목업입니다.
아래 디자인 토큰과 컴포넌트 명세의 정확한 값을 그대로 재현하세요.

## Tech & Dependencies (현재 프로토타입 기준)
- 순수 HTML + CSS + 바닐라 JS (프레임워크 없음). 빌드 단계 없음.
- 폰트: **Pretendard** (한국어 가변폭 산세리프).
  현재는 CDN으로 로드: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`
  → 실제 코드베이스에서는 npm 패키지 `pretendard` 또는 self-host 권장.
- 아이콘/이미지: **외부 에셋 없음.** 모든 그래픽(체크 dot, 브랜드 마름모 로고, 레이더 차트,
  목업 카드)은 CSS와 인라인 SVG, 그리고 JS로 그린 SVG로 구현됨.
- 레이더 차트와 떠다니는 "전문가 태그" 클라우드는 `purit.js`에서 동적으로 생성/애니메이션됨.

## File Map (design/ 폴더)
- `Purit 랜딩페이지.html` — 전체 마크업 (모든 섹션)
- `assets/purit.css` — 전체 스타일 (493줄, `:root` 토큰 + 섹션별 스타일)
- `assets/purit.js` — 인터랙션 (스크롤 reveal, 카운터 애니메이션, 레이더 SVG 생성, 전문가 클라우드 애니메이션, 모바일 메뉴, nav scrolled 상태)

---

## Design Tokens

### Colors
| Token | Hex | 용도 |
|---|---|---|
| `--navy` | `#10367D` | 주 브랜드 색 (CTA, 강조, 링크 hover) |
| `--navy-700` | `#1B4796` | navy hover/그라데이션 중간 |
| `--navy-deep` | `#0C2A62` | 다크 섹션 |
| `--navy-night` | `#081E49` | 가장 어두운 배경 |
| `--ink` | `#0F172A` | 본문 제목 텍스트 |
| `--ink-2` | `#475569` | 보조 텍스트 / 리드 |
| `--ink-3` | `#8598AA` | 흐린 텍스트 / 캡션 |
| `--bg` | `#F8FAFC` | 페이지 배경 |
| `--bg-2` | `#EDF0F4` | 옅은 면 |
| `--bg-3` | `#E2E8F0` | 구분선/세퍼레이터 |
| `--line` | `#E5EAF1` | 보더 |
| `--line-2` | `#D8E0EA` | 진한 보더 (버튼 아웃라인) |
| `--white` | `#FFFFFF` | 카드 배경 |
| `--pass` | `#10B981` | 성공/통과 (초록 체크) |
| `--pass-deep` | `#059669` | 진한 초록 텍스트 |
| `--amber` | `#F59E0B` | 강조 태그 |
| `--red` | `#EF4444` | 경고 (현재 거의 미사용) |

### Typography
- 패밀리: Pretendard (sans + mono 모두 동일 패밀리, mono는 `font-feature-settings:"tnum"` 숫자 정렬용)
- `body`: line-height 1.6, antialiased
- **Hero title** (`.hero-title`): `clamp(34px,5vw,62px)`, weight **800**, line-height 1.12, letter-spacing `-.032em`
- **Section title** (`.sec-title`): `clamp(28px,3.6vw,44px)`, weight 700, line-height 1.18, letter-spacing `-.02em`, `text-wrap:balance`
- **Section lead** (`.sec-lead`): `clamp(16px,1.5vw,18px)`, color `--ink-2`, line-height 1.7, `text-wrap:pretty`
- **Hero sub** (`.hero-sub`): `clamp(16px,1.7vw,19px)`, color `--ink-2`, max-width 500px
- **Eyebrow** (`.eyebrow`): mono, 12.5px, weight 600, color `--navy`, 섹션 라벨용
- **Brand**: 20px, weight 800, letter-spacing `-.02em`

### Spacing / Layout
- 컨테이너 최대폭: `--maxw: 1180px`, 좌우 패딩 `clamp(24px,4vw,52px)`
- 섹션 헤드 하단 마진: 56px, 최대폭 720px, 가운데 정렬
- Hero 패딩: `72px 0 96px`, 2열 그리드 `1.05fr .95fr`, gap 56px

### Radius
- `--r: 14px` (기본 카드), `--r-lg: 22px` (큰 카드/목업), 버튼 11px(기본)/13px(lg), pill 20~99px

### Shadows
- `--shadow-s`: `0 1px 2px rgba(15,23,42,.05), 0 4px 14px -8px rgba(15,23,42,.12)`
- `--shadow-m`: `0 4px 10px -4px rgba(15,23,42,.08), 0 24px 48px -24px rgba(16,54,125,.22)`
- `--shadow-l`: `0 30px 70px -28px rgba(16,54,125,.40)` (히어로 메인 카드)

---

## Screens / Views (단일 페이지, 위→아래 순서)

이 페이지는 하나의 스크롤 랜딩입니다. 각 "뷰"는 섹션입니다.

1. **Nav (sticky)** — 좌측 브랜드(마름모 SVG 로고 + "Purit"), 중앙 링크(이용 방법 / 사람이 직접 / 참여 전문가 / 요금), 우측 로그인 + "무료로 시작하기" CTA. 스크롤 시 `.scrolled` 클래스로 보더+그림자 등장(backdrop blur). 모바일은 햄버거 → `.mobile-menu` 토글.

2. **Hero** — 좌: 이지브라우(`AI 말고, 사람이 평가해요`), H1 3줄 카피, 부카피 2줄, CTA 2개(무료로 시작하기 / 이용 방법 보기), 하단 신뢰 푸터(`신용카드 없이 시작 · 24시간 안에 결과 · 100% 사람이 직접`). 우: 흰색 평가 결과 카드(레이더 차트 + 5개 막대 + 전문가 코멘트) + 떠다니는 "사람이 직접 본 평가" 칩. 배경에 radial 그라데이션 2개 + 점박이(dot grid) 패턴 마스크.

3. **Numbers** — 4개 통계(48시간 / 100% / 5가지 / 0% AI). `data-count` 속성으로 스크롤 인 시 카운트업 애니메이션.

4. **Problem (`#problem`)** — 제목 2줄 + 리드, 4개 카드(× 3개 + Purit ✓ 1개) 그리드. 카드 카피는 줄바꿈 규칙 적용됨(아래 "Copy & 줄바꿈 규칙" 참고).

5. **Features (`#features`)** — "한 곳에서, 네 가지를 평가해요". 4개 평가 유형 카드(01 페이지 종합 / 02 A·B 비교 / 03 가격 페이지 / 04 이메일), 각 카드마다 작은 목업(CSS로 그린 와이어프레임/막대/메일 라인).

6. **How it works (`#how`)** — "신청부터 결과까지, 3단계". STEP 1~3 카드, 각 단계 목업.

7. **Purit Filter (`#filter`, 다크 섹션)** — 네이비 배경. 좌측 카피 + 체크 리스트, 우측 "게이트" 비주얼(들어온 평가 → pass/fail 행 → 통과한 평가만 전달). `aria-hidden` 처리된 장식 비주얼.

8. **Expert Panel (`#panel`)** — "어떤 분들이 평가하나요?". `#cloud`에 JS가 20개 전문가 직함 태그를 5×4 그리드 + jitter 위치로 생성, 20초 주기로 staggered 페이드 인/아웃 애니메이션(hover 시 해당 태그 일시정지).

9. **5 Dimensions** — "감이 아니라, 5가지 기준으로". 좌측 5개 기준 리스트(명확성/관련성/가치/차별화/신뢰), 우측 큰 레이더 차트(JS 생성 SVG).

10. **Comparison** — "기존 방법과 비교하면". 비교 표(Purit 열 하이라이트, ✓/×/△ 기호).

11. **Testimonials** — "출시 전에 알 수 있었던 것들". 3개 고객 인용 카드.

12. **Pricing (`#pricing`)** — "팀 규모에 맞게 시작하세요". 3개 플랜(Starter / Pro[가장 인기, 하이라이트] / Enterprise), 크레딧 기반.

13. **CTA** — "첫 신청은 무료예요" 다크 배너 + CTA 2개.

14. **Footer** — 브랜드 + 설명, 3개 링크 컬럼(제품/회사/시작하기), 하단 카피라이트 + `감으로 일하기 싫은 분들을 위해.`

---

## Key Component: "진짜 전문가" 강조 (중요)
Hero H1의 "진짜 전문가" 단어에 은은한 강조가 적용돼 있습니다. `<em class="accent">진짜 전문가</em>`.
재현 시 정확히 따라야 하는 스펙:

- **글자색**: `--navy` (`#10367D`), font-style normal, `white-space:nowrap`
- **뒤 글로우 (`::before`)**: radial-gradient `rgba(16,54,125,.08) → transparent 70%`, 단어보다 살짝 넓게(left/right -.12em). 스크롤 인(`.in`) 시 opacity 0→1, transition `.9s ease .35s`.
- **밑줄 (`::after`)**: 높이 `.085em`, `bottom:.02em`(글자 바로 아래), border-radius 99px, 배경 `linear-gradient(90deg, navy 0%, navy-700 45%, pass 100%)`. 기본 `scaleX(0)` → `.in` 시 `scaleX(1)`, transform-origin left, transition `1s cubic-bezier(.2,.7,.2,1) .5s` (왼→오 그려지는 효과).
- `prefers-reduced-motion: reduce` 시 애니메이션 없이 최종 상태로 표시.

---

## Copy & 줄바꿈 규칙 (이 대화에서 합의된 규칙)
한국어 카피 줄바꿈에 대한 규칙이 적용돼 있습니다. 컴포넌트화 시에도 이 규칙을 유지하세요:

1. **마침표(.)/반점(,) 뒤에서 줄이 어색하게 끊기면** 그 지점에 `<br />`(또는 프레임워크식 줄바꿈)를 넣어 깔끔한 2줄로 만든다.
2. **단, 줄바꿈했을 때 3줄로 넘어가면** 강제하지 말고 자연스럽게 흐르게 둔다(`text-wrap: balance/pretty` 활용).
3. 구두점이 줄 중앙과 맞지 않는 경우(예: Problem 카드 1 "이미 편견이 생겼어요. 모두 좋다고 했는데...")는 강제 `<br/>` 대신 자연 줄바꿈에 맡긴다.
4. 기존 마크업에 남아 있던 한글 소프트 줄바꿈용 `&nbsp;`(`\u00A0`)는 제거하고 `<br />`로 대체한다.

현재 적용 위치:
- Hero H1: `고객의 뒤로가기,` / `<em>진짜 전문가</em>가` / `짚어줍니다` (3줄, `<br/>`)
- Hero 부카피: `...직접 봅니다.` / `AI가 아닌, 진짜 사람들입니다.` (2줄)
- Problem 제목: `"이 광고, 괜찮은 걸까?"` / `그 고민, 사람이 풀어줍니다.`
- Problem 카드 2/3/4: 마침표·반점 뒤 `<br/>`로 2줄
- Problem 카드 1: 자연 줄바꿈(규칙 3)

---

## Interactions & Behavior (purit.js)
- **Scroll reveal**: `.reveal` 요소가 뷰포트 92% 지점 도달 시 `.in` 클래스 추가 → opacity/transform 전환. (구현은 IntersectionObserver 대체 가능)
- **Counter**: `[data-count]` 요소가 보이면 0→목표값 카운트업(약 1.4s, ease-out cubic). `prefers-reduced-motion` 시 즉시 표시.
- **Radar chart**: `[data-radar]` 호스트에 JS가 5각형 SVG 생성(5개 축, 라벨은 DIMS 배열). 보일 때 그려짐.
- **Expert cloud**: `#cloud`에 20개 직함 태그 생성, 20s 주기 staggered 페이드. hover 시 해당 태그 정지. reduce-motion 시 정적 부분집합만 표시.
- **Nav**: 스크롤 시 `.scrolled` 토글. 모바일 햄버거 → 메뉴 토글, 링크 클릭 시 닫힘.
- 전환/이징: 버튼 hover `translateY(-2px)` + 그림자 강화, transition 0.18~0.2s ease.

### 동적으로 생성되는 텍스트 (주의)
다음 텍스트는 HTML이 아니라 **JS 배열에서 생성**됩니다. 재구현 시 데이터로 다뤄야 합니다(HTML에 하드코딩 X):
- 레이더 차트 축 라벨 (`purit.js`의 `DIMS`)
- 전문가 클라우드 직함들 (`purit.js`의 `CREDS` 20개 배열)

---

## State Management (재구현 시)
프로토타입은 상태가 거의 없습니다. 컴포넌트화 시 필요한 최소 상태:
- `navScrolled: boolean` (스크롤 위치 기반)
- `mobileMenuOpen: boolean`
- 각 reveal 요소의 `inView: boolean` (IntersectionObserver)
- 카운터/클라우드/레이더는 mount 후 effect로 구동

데이터 페칭 요구사항 없음(정적 마케팅 페이지). 실제 서비스에서는 통계·요금·후기를 CMS/API로
빼는 것을 권장.

## Assets
외부 이미지/아이콘 에셋 없음. 모든 그래픽은 CSS + 인라인 SVG + JS 생성 SVG.
폰트 Pretendard만 외부 의존성. 실제 코드베이스에서는 npm `pretendard` 또는 self-host 사용.

## 참고
- 반응형: 데스크톱 우선, 모바일에서 nav가 햄버거로 전환되고 그리드가 단(column)으로 떨어짐. (CSS 하단 미디어쿼리 참고)
- 접근성: 장식 비주얼에 `aria-hidden="true"`. 단, 편집 가능해야 하는 텍스트에는 붙이지 말 것.
- 색상 대비: 본문은 `--ink`/`--ink-2`로 충분, 다크 섹션은 흰색/`rgba(255,255,255,.74)` 사용.
