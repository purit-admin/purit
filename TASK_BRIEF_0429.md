# 작업 브리프 — 피드백 결과 대공사
작성일: 2026-04-29 | 재개 예정: 2시간 후 다른 컴퓨터

---

## 현재 브랜치 상태

```
branch: main
수정된 파일 (미커밋):
  - 1_PRD.txt
  - src/pages/company/Dashboard.jsx
  - src/pages/company/NewMission.jsx
  - src/pages/company/PricingTest.jsx
```

---

## 작업 목록 (우선순위 순)

### 1. 패널 피드백 제출 조건 강화
**파일:** `src/pages/panel/ActiveMission.jsx`

**문제:** 이미지 미션에서 어노테이션 1개만 있어도 제출 가능  
**수정:**
- 이미지 미션: 5개 차원(명확성/관련성/가치/차별화/신뢰) 전부 최소 1개 이상 어노테이션 있어야 제출 버튼 활성화
- 텍스트 미션: 5개 점수 모두 입력(1~5) 필수
- 미충족 시 "모든 차원에 평가를 남겨주세요" 경고 메시지 표시

---

### 2. Results.jsx 전면 재설계
**파일:** `src/pages/company/Results.jsx`

#### 2-A. 미션 선택 UI 개선 (최우선)
**문제:** 미션이 많으면 칩 버튼이 여러 줄로 펼쳐져 지저분함 (스크린샷 확인)  
**수정:** 좌측 패널 구조로 변경
```
┌──────────────────┬─────────────────────────┐
│ [메인 미션]       │  피드백 상세 영역          │
│  • 메인의뢰_제품  │                          │
│ [서브 미션]       │                          │
│  • 이메일 검증    │                          │
│  • 소재 비교: CTA │                          │
│  • 가격 페이지    │                          │
└──────────────────┴─────────────────────────┘
```
- 좌측 패널: 메인(landing_page) / 서브(preference, pricing, email) 섹션 분리
- 타입 뱃지 표시 (LP검증 / 소재비교 / 가격검증 / 이메일검증)
- 선택된 미션 하이라이트

#### 2-B. 이미지 미션 피드백 결과 표시
**문제:** 현재 텍스트 점수만 표시됨. 이미지+어노테이션이 보여야 함  
**수정:** 패널별 피드백 카드 구조 개편
1. 각 패널 카드 내부에 `ImageAnnotator` (readonly) 로 이미지+어노테이션 오버레이 표시
2. 카드 아래에 해당 패널의 dimension별 코멘트 박스 표시
3. **페이지 최하단**에 전체 집계 5차원 평균 점수 (레이더 or 바 차트)

**참고:**
- `ImageAnnotator` props: `imageUrl, imageIndex, annotations, readonly={true}`
- `feedback_annotations` 테이블에서 `feedback_id` 기준으로 어노테이션 로드

#### 2-C. 서브 미션 지표 분기
**문제:** 모든 미션에서 명확성/관련성/가치/차별화/신뢰 5축을 동일하게 표시함  
**수정:** `mission.type`으로 분기

| mission.type | 표시할 지표 | 테이블 |
|---|---|---|
| `landing_page` / null | clarity, relevance, value, differentiation, trust (5축) | feedbacks |
| `preference` | A/B 선택 비율 + message_clarity + purchase_intent | preference_responses |
| `pricing` | would_buy 비율 + price_fairness + value_perception | pricing_responses |
| `email` | would_reply 비율 + open_intent + hook_score + clarity_score + curiosity_score | email_responses |

**조회 방법:**
```js
// preference 예시
supabase
  .from('preference_responses')
  .select('*')
  .eq('mission_id', selected)
```

---

### 3. 미션 수정 기능
**파일:** `src/pages/company/Dashboard.jsx`, `src/pages/company/NewMission.jsx`

**규칙:** `filled_count === 0` 일 때만 수정 가능  
**구현:**
- Dashboard.jsx: 미션 카드에 수정 버튼 추가 (filled_count === 0 조건부 표시)
- NewMission.jsx: `mode='edit'` + `missionId` prop 받아서 기존 데이터 pre-fill
- 미션 등록 완료 직후 경고 문구: "첫 피드백 수신 후에는 수정이 불가합니다"
- 수정 제출 시 `missions UPDATE` (INSERT 아닌 UPDATE)

---

## 현재 코드 구조 참고사항

### 핵심 파일 경로
```
src/pages/company/Results.jsx        ← 2번 작업 대상
src/pages/company/Dashboard.jsx      ← 3번 작업 대상
src/pages/company/NewMission.jsx     ← 3번 작업 대상
src/pages/panel/ActiveMission.jsx    ← 1번 작업 대상
src/components/ui/ImageAnnotator.jsx ← 2-B에서 readonly로 재사용
```

### DB 테이블 구조 핵심
```
feedbacks: mission_id, panel_id, clarity_score, relevance_score,
           value_score, differentiation_score, trust_score,
           suggestions, status, purity_passed

feedback_annotations: feedback_id, mission_id, panel_id,
                      image_index, x_pct, y_pct, w_pct, h_pct,
                      dimension, score, comment

preference_responses: test_id, panel_id, mission_id,
                      preference('A'|'B'), message_clarity, purchase_intent, comment

pricing_responses: test_id, panel_id, mission_id,
                   would_buy, price_fairness, value_perception, key_comment

email_responses: test_id, panel_id, mission_id,
                 would_reply, open_intent, hook_score, clarity_score, curiosity_score, comment
```

### 미션 타입 분류 기준 (프로젝트 공통 패턴)
```js
const isMainMission = !m.type || m.type === 'landing_page';
const isSubMission  = ['preference', 'pricing', 'email'].includes(m.type);
```

---

## 작업 순서 권장

1. **Results.jsx 미션 선택 UI** (2-A) → 가장 눈에 띄는 문제, 빠른 임팩트
2. **서브 미션 지표 분기** (2-C) → 데이터 구조 명확, 구현 범위 명확
3. **이미지 피드백 결과 표시** (2-B) → 가장 공수 큰 작업
4. **패널 제출 조건 강화** (1번) → ActiveMission.jsx 수정
5. **미션 수정 기능** (3번) → 신규 기능, 마지막에

---

## 시작 전 체크리스트

- [ ] `CLAUDE.md` + `1_PRD.txt` + `2_Architecture.txt` 읽기 완료
- [ ] `npm run dev` 로컬 서버 실행
- [ ] `src/pages/company/Results.jsx` 전체 읽기
- [ ] `src/pages/panel/ActiveMission.jsx` 전체 읽기 (이미지 모드 섹션 집중)
- [ ] `src/components/ui/ImageAnnotator.jsx` readonly 모드 props 확인
