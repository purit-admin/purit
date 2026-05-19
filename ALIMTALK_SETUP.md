# Purit 알림톡 (KakaoTalk AlimTalk) 설정 가이드

## 진행 현황

| 단계 | 내용 | 상태 |
|------|------|------|
| A-1 | Solapi 가입 + API Key 발급 | ⬜ 미완료 |
| A-2 | 카카오 채널 연동 + 알림톡 신청 | ⬜ 미완료 |
| A-3 | 알림톡 템플릿 8개 등록 | ⬜ 미완료 |
| B-1 | SQL 040 실행 (컬럼 추가) | ✅ 완료 |
| B-2 | Extensions 활성화 (pg_cron, pg_net) | ⬜ 미완료 |
| B-3 | Edge Function 배포 | ⬜ 미완료 |
| B-4 | Secrets 12개 등록 | ⬜ 미완료 |
| B-5 | DB Webhook 등록 | ⬜ 미완료 |
| B-6 | SQL 041 실행 (pg_cron 스케줄) | ⬜ 미완료 |

---

## 발송 대상 이벤트

### 패널 (3개)
| 이벤트 | 트리거 | Secret 변수명 |
|--------|--------|---------------|
| 피드백 승인 | PurityFilter 승인 시 | `SOLAPI_TPL_PANEL_APPROVED` |
| 피드백 반려 | PurityFilter 반려 시 | `SOLAPI_TPL_PANEL_REJECTED` |
| 마감 1시간 전 | pg_cron 30분마다 자동 | `SOLAPI_TPL_DEADLINE_REMINDER` |

### 기업 (5개)
| 이벤트 | 트리거 | Secret 변수명 |
|--------|--------|---------------|
| 의뢰 완료 처리 | 어드민 완료 처리 시 | `SOLAPI_TPL_CO_COMPLETED` |
| 조기종료 피드백 공개 | 어드민 earlyComplete 시 | `SOLAPI_TPL_CO_EARLY_DONE` |
| 의뢰 강제 취소 | 어드민 취소 처리 시 | `SOLAPI_TPL_CO_CANCELLED` |
| 취소 의뢰 재개 | 어드민 재개 처리 시 | `SOLAPI_TPL_CO_REACTIVATED` |
| 완료 의뢰 재진행 | 어드민 재진행 처리 시 | `SOLAPI_TPL_CO_RESUMED` |

---

## A. 외부 서비스 준비 (며칠 소요)

### A-1. Solapi 가입 및 API Key 발급
1. https://solapi.com 회원가입
2. 로그인 → **설정 → API Key 관리** → 새 Key 생성
3. `API Key`와 `API Secret` 메모

### A-2. 카카오 채널 연동
1. https://business.kakao.com → 카카오 비즈니스 채널 생성
2. Solapi 대시보드 → **카카오 알림톡 → 채널 연동** → 채널 연결
3. **채널 심사 완료까지 약 1~2주 소요**
4. 승인 완료 후 `pfId` (KA01PF...) 메모

### A-3. 알림톡 템플릿 8개 등록
채널 승인 후 Solapi에서 아래 8개 템플릿 등록 (각 1~3일 심사):

| # | 템플릿 이름 | 내용 예시 | 사용 변수 |
|---|------------|-----------|----------|
| 1 | 피드백 승인 | `#{내용}` | `#{내용}` |
| 2 | 피드백 반려 | `#{내용}` | `#{내용}` |
| 3 | 마감 1시간 전 | `[#{미션명}] #{구분} 마감이 #{마감시간}입니다. 서둘러 제출해주세요.` | `#{미션명}` `#{마감시간}` `#{구분}` |
| 4 | 의뢰 완료 | `#{내용}` | `#{내용}` |
| 5 | 피드백 공개 | `#{내용}` | `#{내용}` |
| 6 | 의뢰 취소 | `#{내용}` | `#{내용}` |
| 7 | 의뢰 재개 | `#{내용}` | `#{내용}` |
| 8 | 의뢰 재진행 | `#{내용}` | `#{내용}` |

등록 완료 시 각 템플릿 ID (`KA01TP...`) 8개 메모

---

## B. Supabase 적용

### B-1. SQL 실행 ✅ 완료
`supabase/migrations/040_alimtalk_setup.sql` → SQL Editor에서 실행 완료

### B-2. Extensions 활성화
Supabase 대시보드 → **Database → Extensions**

- `pg_cron` 검색 → 토글 켜기
- `pg_net` 검색 → 토글 켜기

### B-3. Edge Function 배포
터미널에서 프로젝트 루트 경로로 이동 후 실행:

```bash
# Supabase CLI 없으면 먼저 설치
npm install -g supabase
supabase login

# 함수 배포
supabase functions deploy send-alimtalk
supabase functions deploy check-deadline-alimtalk
```

배포된 파일 위치:
- `supabase/functions/send-alimtalk/index.ts` — notifications INSERT 시 알림톡 발송
- `supabase/functions/check-deadline-alimtalk/index.ts` — 마감 1시간 전 자동 체크
- `supabase/functions/_shared/solapi.ts` — 공통 발송 헬퍼

### B-4. Secrets 등록 (A 완료 후)
A에서 발급받은 값들을 실제 값으로 교체해서 터미널 실행:

```bash
supabase secrets set SOLAPI_API_KEY=여기에_API_KEY_입력
supabase secrets set SOLAPI_API_SECRET=여기에_API_SECRET_입력
supabase secrets set SOLAPI_SENDER_PHONE=01012345678
supabase secrets set SOLAPI_PF_ID=KA01PF여기에_pfId_입력
supabase secrets set SOLAPI_TPL_PANEL_APPROVED=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_PANEL_REJECTED=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_DEADLINE_REMINDER=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_CO_COMPLETED=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_CO_EARLY_DONE=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_CO_CANCELLED=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_CO_REACTIVATED=KA01TP여기에_템플릿ID
supabase secrets set SOLAPI_TPL_CO_RESUMED=KA01TP여기에_템플릿ID
```

### B-5. DB Webhook 등록
Supabase 대시보드 → **Database → Webhooks → Create a new hook**

| 항목 | 입력값 |
|------|--------|
| Name | `send-alimtalk` |
| Table | `notifications` |
| Events | Insert ✅ |
| Type | HTTP Request |
| URL | `https://[프로젝트ID].supabase.co/functions/v1/send-alimtalk` |
| Header Key | `Authorization` |
| Header Value | `Bearer [service_role_key]` |

> `프로젝트ID`와 `service_role_key` 위치:
> Supabase 대시보드 → **Settings → API**
> - Project URL에서 `https://[프로젝트ID].supabase.co` 확인
> - `service_role` → `secret` 키 복사

### B-6. pg_cron 스케줄 등록 (B-2 완료 후)
`supabase/migrations/041_pg_cron_deadline_alimtalk.sql` 파일에서
아래 두 곳을 실제 값으로 교체 후 SQL Editor 실행:

```sql
-- 이 두 줄의 [YOUR_PROJECT_REF], [YOUR_ANON_KEY] 교체
ALTER DATABASE postgres SET app.supabase_url = 'https://[YOUR_PROJECT_REF].supabase.co';
ALTER DATABASE postgres SET app.supabase_anon_key = '[YOUR_ANON_KEY]';
```

> `YOUR_PROJECT_REF` = Supabase 대시보드 → Settings → General → Reference ID
> `YOUR_ANON_KEY`    = Supabase 대시보드 → Settings → API → `anon` `public` 키

---

## 지금 할 수 있는 것 vs 나중에

| 지금 바로 가능 | A 완료 후 |
|----------------|-----------|
| ✅ B-1 완료됨 | B-4 Secrets 등록 |
| B-2 Extensions 활성화 | B-6 pg_cron 등록 |
| B-3 Edge Function 배포 | |
| B-5 Webhook 등록 | |

---

## 관련 파일 목록

```
supabase/
├── migrations/
│   ├── 040_alimtalk_setup.sql              ✅ SQL Editor 실행 완료
│   └── 041_pg_cron_deadline_alimtalk.sql   값 교체 후 실행 필요
└── functions/
    ├── _shared/
    │   └── solapi.ts                        Solapi 공통 헬퍼
    ├── send-alimtalk/
    │   └── index.ts                         notifications 웹훅 핸들러
    └── check-deadline-alimtalk/
        └── index.ts                         마감 임박 체커 (pg_cron 호출)
```
