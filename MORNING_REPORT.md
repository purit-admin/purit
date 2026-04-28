# MORNING REPORT — AI 리포트 파이프라인 구축 완료

작성일: 2026-04-28

---

## 밤새 완성된 것들

| 파일 | 설명 |
|------|------|
| `supabase/migrations/005_ai_reports.sql` | ai_reports 테이블 + RLS 정책 |
| `supabase/functions/generate-ai-report/index.ts` | Deno Edge Function (Anthropic API 호출) |
| `src/pages/company/AIReport.jsx` | "AI 리포트 생성" 버튼 + ai_reports 연동 |

---

## 아침에 직접 실행해야 할 작업 (순서대로)

### STEP 1. SQL 마이그레이션 실행

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- supabase/migrations/005_ai_reports.sql 내용 붙여넣기
```

또는 파일 경로: `supabase/migrations/005_ai_reports.sql`

---

### STEP 2. Supabase CLI 로그인 및 프로젝트 연결

```bash
# CLI 설치 (이미 되어 있으면 스킵)
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결 (프로젝트 ID는 Supabase Dashboard URL에서 확인)
supabase link --project-ref <YOUR_PROJECT_ID>
```

---

### STEP 3. Anthropic API Key를 Supabase Secret으로 등록

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx
```

> API Key 발급: https://console.anthropic.com → API Keys
> 
> **주의: ANTHROPIC_API_KEY 없이도 동작합니다** (Mock 응답으로 폴백).
> Mock 상태에서는 AI 분석 없이 로컬 계산값 + 안내 메시지가 표시됩니다.

---

### STEP 4. Edge Function 배포

```bash
supabase functions deploy generate-ai-report
```

배포 성공 시 출력 예시:
```
Deployed Function generate-ai-report on project <id>
```

---

### STEP 5. 동작 확인

1. Company 계정으로 `/company/report` 접속
2. 우측 상단 **"AI 리포트 생성"** 버튼 클릭
3. "분석 중…" → AI 생성 완료 후 결과 표시
4. Supabase Dashboard → Table Editor → `ai_reports` 테이블에 레코드 확인

---

## 동작 방식 요약

```
[버튼 클릭]
    ↓
supabase.functions.invoke('generate-ai-report', { mission_id })
    ↓
[Edge Function]
  1. 사용자 인증 검증
  2. missions + feedbacks 조회
  3. Anthropic claude-haiku-4-5 호출 (한국어 JSON 응답)
     └→ ANTHROPIC_API_KEY 없으면 Mock 응답 사용
  4. ai_reports 테이블 INSERT
  5. 결과 반환
    ↓
[AIReport.jsx]
  AI 생성 데이터로 TL;DR · 우선 개선 과제 · 강점 · 리스크 업데이트
```

---

## 알려진 제약사항

- Edge Function은 Supabase CLI로 직접 배포해야 함 (자동화 불가)
- Anthropic API 비용: claude-haiku-4-5 기준 리포트 1건당 약 $0.001 미만
- 현재 ai_reports INSERT 정책이 `WITH CHECK (true)`이므로,
  추후 보안 강화 시 `service_role` 전용 정책으로 교체 권장

---

## [DAY 2: 시각화 엔진 구축 완료]

작성일: 2026-04-28

---

### 수정된 컴포넌트

| 파일 | 변경 내용 |
|------|-----------|
| `src/pages/company/Dashboard.jsx` | 전면 재작성 — 차트 3종 + Framer Motion 애니메이션 추가 |

신규 파일 없음 (기존 파일 수정만).

---

### 새로 추가된 UI 구조

```
CompanyDashboard
├── Header (fadeUp 0.0s)
├── Stats Grid (staggerChildren 0.07s — 4카드 순차 등장)
├── Chart Row 1 (fadeUp 0.1s)
│   ├── 5차원 레이더 차트 — RadarChart (내 점수 vs 벤치마크)
│   └── KPI 달성률 게이지 — RadialBarChart 반원 + 축별 미니 프로그레스바
└── Chart Row 2 (fadeUp 0.2s)
    └── 긍/부정 스택 바 차트 — BarChart (horizontal, 5개 미션)
├── 진행 중인 의뢰 (fadeUp 0.3s + whileHover y:-2)
└── 전체 의뢰 현황 (fadeUp 0.35s)
```

---

### 신규 설치 패키지

```bash
npm install framer-motion   # ^11.x — 섹션 fadeUp, stagger, whileHover
# Recharts ^2.12.0 은 기존 설치됨 — RadarChart, RadialBarChart, BarChart 추가 활용
```

---

### Mock 데이터 구조 (실데이터 연결 전 fallback)

**MOCK_RADAR** — 5차원 레이더 + KPI 게이지 공용
```js
[
  { dimension: '명확성', score: 3.8, benchmark: 3.2 },
  { dimension: '관련성', score: 4.2, benchmark: 3.5 },
  { dimension: '가치',   score: 3.1, benchmark: 3.0 },
  { dimension: '차별성', score: 2.9, benchmark: 2.8 },
  { dimension: '신뢰도', score: 3.6, benchmark: 3.3 },
]
// 평균 3.52 → KPI 게이지 70점
```

**MOCK_SENTIMENT** — 미션별 긍/부정 스택 바
```js
[
  { name: 'LP A안',        positive: 68, negative: 32 },
  { name: '가격 테스트',   positive: 45, negative: 55 },
  { name: '이메일 캠페인', positive: 72, negative: 28 },
  { name: 'B2B 랜딩',     positive: 61, negative: 39 },
  { name: '브랜드 인지',   positive: 58, negative: 42 },
]
```

---

### 내일 아침 DB 연동 TODO

**① feedbacks 집계 쿼리 활성화 (레이더/게이지 실데이터 전환)**

`Dashboard.jsx` 의 `useEffect` 안에 아래 쿼리를 추가:

```js
if (co) {
  const { data: fb } = await supabase
    .from('feedbacks')
    .select('clarity_score, relevance_score, value_score, differentiation_score, trust_score, mission_id')
    .eq('status', 'submitted')
    .in('mission_id', missionIds);   // missionIds = ms.map(m => m.id)
  setFeedbacks(fb || []);
}
```

그런 다음 `MOCK_RADAR` 대신 아래 집계 함수로 교체:

```js
function computeRadarFromFeedbacks(feedbacks) {
  const avg = key => feedbacks.reduce((s, f) => s + (f[key] || 0), 0) / feedbacks.length;
  return [
    { dimension: '명확성', score: +avg('clarity_score').toFixed(1),       benchmark: 3.2, fullMark: 5 },
    { dimension: '관련성', score: +avg('relevance_score').toFixed(1),     benchmark: 3.5, fullMark: 5 },
    { dimension: '가치',   score: +avg('value_score').toFixed(1),         benchmark: 3.0, fullMark: 5 },
    { dimension: '차별성', score: +avg('differentiation_score').toFixed(1), benchmark: 2.8, fullMark: 5 },
    { dimension: '신뢰도', score: +avg('trust_score').toFixed(1),         benchmark: 3.3, fullMark: 5 },
  ];
}
const radarData = feedbacks.length > 0 ? computeRadarFromFeedbacks(feedbacks) : MOCK_RADAR;
```

**② 미션별 긍/부정 산출 (스택 바 실데이터 전환)**

긍정 = 평균 점수 ≥ 3.5인 피드백 비율 기준. 미션별로 그룹핑 후 퍼센트 계산.

**③ 빌드 재확인**

```bash
npm run build   # 경고 0개 확인
```

> 청크 크기 1146KB 경고는 기존 이슈(Recharts + framer-motion 추가로 소폭 증가).
> 급하면 `vite.config.js`에 `chunkSizeWarningLimit: 1500` 추가로 경고 억제 가능.
