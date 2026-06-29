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
    │   └── solapi.ts                        Solapi 공통 헬퍼 (sendAlimtalk + sendSms)
    ├── send-alimtalk/
    │   └── index.ts                         notifications 웹훅 핸들러
    └── check-deadline-alimtalk/
        └── index.ts                         마감 임박 체커 (pg_cron 호출)
```

---
---

# C. 휴대폰 OTP 인증 (SMS) — 가입/프로필 본인 인증

> 알림톡과 **별개 기능**이지만 같은 Solapi 계정·발신번호를 공유하므로 이 파일에 함께 정리.
> 핵심: OTP는 **일반 SMS**라 카카오 채널·알림톡 템플릿이 **필요 없다.** (발신번호 + API Key + 충전만 있으면 작동)

## C. 진행 현황

| 단계 | 내용 | 상태 |
|------|------|------|
| C-1 | SQL 124 실행 (phone_otps 테이블) | ✅ 완료 |
| C-2 | Edge Function 배포 (send-otp / verify-otp) | ✅ 완료 (ACTIVE) |
| C-3 | 클라이언트 연동 (Signup·VerifyPhone·panel/Profile) | ✅ 완료 (코드 반영·빌드 통과) |
| C-4 | Solapi SMS Secrets 3개 등록 | ⬜ **미완료** ← 사업자 등록 후 진행 예정 |
| C-5 | Solapi 발신번호 등록 + 충전 | ⬜ **미완료** ← 사업자 등록 후 진행 예정 |

> ⚠️ **현재 상태:** 코드·배포·DB는 전부 끝났으나 Solapi SMS 설정(C-4·C-5)이 없어 **실제 문자는 발송되지 않음.**
> 가입 화면에서 "인증번호 받기" → "인증번호 발송에 실패했습니다" 표시됨 (정상 — Solapi 미설정 때문).

## C. 동작 방식 (참고)

- `send-otp`: 번호 형식 검증 → 재발송 제한(60초 간격·1시간 5회) → 6자리 코드 생성 → `phone_otps`에 5분 만료로 저장 → Solapi SMS 발송
- `verify-otp`: 최신 미인증 코드 조회 → 만료·시도횟수(5회) 검사 → 일치 시 `verified=true`
- `phone_otps` 테이블은 RLS 전면 차단 → 클라이언트 직접 접근 불가, Edge Function(service_role)만 접근

## C-4 / C-5. Solapi 준비 (사업자 등록 후 진행)

### 1) Solapi 가입
- https://solapi.com 회원가입 → 콘솔 로그인

### 2) 발신번호 등록 ⭐ (가장 중요·시간 소요)
- 콘솔 **[발신번호 관리] → [발신번호 등록]**
- 인증 방법:
  - **개인 휴대폰** → **ARS 인증** (등록할 번호로 전화 → 인증번호 입력, 즉시 완료) — 가장 빠름
  - **사업자 번호/유선** → 통신서비스 이용증명원 서류 제출 (영업일 1일 내외 심사)
- 등록·인증한 번호 = `SOLAPI_SENDER_PHONE`

### 3) API Key 발급
- 콘솔 **[API Key 관리] → [API Key 생성]**
- `API Key` = `SOLAPI_API_KEY`, `API Secret` = `SOLAPI_API_SECRET`
- ⚠️ **Secret은 생성 시 한 번만 표시됨 — 반드시 복사 저장**

### 4) 충전
- 콘솔 **[캐시 충전]** (테스트는 만 원 정도면 충분)
- SMS 단가: 건당 약 9~20원 (단문)

### 5) Secrets 등록 (위 3개 확보 후 터미널 실행)
```bash
cd <프로젝트 루트>
SUPABASE_ACCESS_TOKEN=<access_token> \
  npx supabase secrets set \
    SOLAPI_API_KEY=발급키 \
    SOLAPI_API_SECRET=발급시크릿 \
    SOLAPI_SENDER_PHONE=01012345678 \
  --project-ref xdpfoevtlgjuhwzqtxrs
```
> 이 3개는 **알림톡(B-4)과 동일한 값** — 한 번 등록하면 OTP와 알림톡 SMS 폴백이 함께 작동.
> (알림톡까지 쓰려면 B-4의 `SOLAPI_PF_ID` + 템플릿 ID들이 추가로 필요. OTP만은 위 3개로 충분.)

## C. 관련 파일

```
supabase/
├── migrations/
│   └── 124_phone_otp.sql                    ✅ SQL Editor 실행 완료 (phone_otps 테이블)
└── functions/
    ├── _shared/solapi.ts                     sendSms 추가됨 (OTP용 평문 SMS)
    ├── send-otp/index.ts                     ✅ 배포 완료 — 코드 생성·발송
    └── verify-otp/index.ts                   ✅ 배포 완료 — 서버 검증
src/lib/otp.js                                requestOtp / confirmOtp 공용 헬퍼 (클라 3곳 공유)
```
