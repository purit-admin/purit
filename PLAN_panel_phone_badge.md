# 계획: 패널 전화번호 인증 + 기업 Results 직군/경력 뱃지

## Context
- 패널 프로필에 핸드폰 번호 입력 및 Mock OTP 인증 UI 추가
- 기업이 피드백 결과를 볼 때 패널의 직군·경력 뱃지 표시 (이름·번호는 비공개)
- D-28 원칙 준수: 기업은 panels 테이블을 직접 JOIN 불가 → SECURITY DEFINER RPC로 우회

## 수정 파일 목록

1. `supabase/migrations/012_panel_phone_public_profiles.sql` — 신규 생성
2. `src/pages/panel/Profile.jsx` — phone 인증 UI + 개인정보 안내 문구
3. `src/pages/company/Results.jsx` — 직군/경력 뱃지 전체 표시
4. `1_PRD.txt` — Profile 섹션 전화번호 인증 추가
5. `2_Architecture.txt` — panels 스키마 + 새 RPC 추가

---

## Step 1: DB 마이그레이션 (012_panel_phone_public_profiles.sql)

```sql
-- panels 테이블에 phone 컬럼 추가
ALTER TABLE panels ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- 기업이 패널 공개 정보만 조회하는 SECURITY DEFINER RPC
-- 반환: panel_id, industry, experience 만 (이름·연락처·계좌 제외)
CREATE OR REPLACE FUNCTION get_panel_public_profiles(p_mission_id UUID)
RETURNS TABLE(panel_id UUID, industry TEXT, experience TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS panel_id,
    p.industry,
    p.experience
  FROM feedbacks f
  JOIN panels p ON p.id = f.panel_id
  WHERE f.mission_id = p_mission_id
    AND f.status != 'draft';
END;
$$;
```

---

## Step 2: Profile.jsx 수정

### 2-1. 상태 추가 (기존 name/industry/experience 상태 옆에)
```js
const [phone, setPhone] = useState('');
const [phoneVerified, setPhoneVerified] = useState(false);
const [otpSent, setOtpSent] = useState(false);
const [otp, setOtp] = useState('');
const [otpLoading, setOtpLoading] = useState(false);
const [otpError, setOtpError] = useState('');
```

### 2-2. 데이터 로드 (fetchPanel 내)
기존 `setName(d.name)` 등과 함께:
```js
setPhone(d.phone || '');
setPhoneVerified(d.phone_verified || false);
```

### 2-3. Mock OTP 핸들러
```js
// "인증번호 발송" 클릭
const handleSendOtp = async () => {
  if (!phone || phone.length < 10) { setOtpError('올바른 번호를 입력해주세요.'); return; }
  setOtpLoading(true);
  setOtpError('');
  await new Promise(r => setTimeout(r, 800)); // mock delay
  setOtpSent(true);
  setOtpLoading(false);
};

// "확인" 클릭 (6자리 아무 숫자 허용 — Mock)
const handleVerifyOtp = async () => {
  if (otp.length !== 6) { setOtpError('인증번호 6자리를 입력해주세요.'); return; }
  setOtpLoading(true);
  setOtpError('');
  await new Promise(r => setTimeout(r, 600)); // mock delay
  const { error } = await supabase
    .from('panels')
    .update({ phone, phone_verified: true })
    .eq('id', panel.id);
  if (error) { setOtpError('저장 중 오류가 발생했습니다.'); }
  else { setPhoneVerified(true); setOtpSent(false); setOtp(''); }
  setOtpLoading(false);
};
```

### 2-4. 'profile' 탭 UI 수정
기존 Bio textarea 아래, 저장 버튼 위에 삽입:

**① 개인정보 안내 박스** (탭 상단에 표시):
```
📌 기업에게는 이름과 핸드폰 번호는 공개되지 않습니다.
   직군과 경력만 공개됩니다.
```
→ 배경: `bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm text-fg-muted`

**② 전화번호 인증 섹션** (Bio 아래):
- 레이블: "핸드폰 번호" + 인증완료 시 초록색 뱃지 "✓ 인증 완료"
- 입력창 + "인증번호 발송" 버튼 (인증완료 시 버튼 숨김)
- otpSent=true 시: OTP 6자리 입력창 + "확인" 버튼 노출
- otpError 있을 때 빨간 에러 메시지 표시

---

## Step 3: Results.jsx 수정

### 3-1. panelProfiles 상태 추가
```js
const [panelProfiles, setPanelProfiles] = useState({}); // { panel_id: { industry, experience } }
```

### 3-2. fetchResults 내 RPC 호출 추가
기존 feedbacks 쿼리 직후:
```js
const { data: ppRows } = await supabase.rpc('get_panel_public_profiles', { p_mission_id: missionId });
if (ppRows) {
  const map = {};
  ppRows.forEach(r => { map[r.panel_id] = { industry: r.industry, experience: r.experience }; });
  setPanelProfiles(map);
}
```

### 3-3. 헬퍼 함수 추가
```js
const PanelBadges = ({ panelId }) => {
  const p = panelProfiles[panelId];
  if (!p) return null;
  return (
    <span className="inline-flex gap-1 ml-1">
      {p.industry && <Badge type="blue">{p.industry}</Badge>}
      {p.experience && <Badge type="gray">{p.experience}</Badge>}
    </span>
  );
};
```

### 3-4. 뱃지 삽입 위치 (5곳 전체)

| 컴포넌트 | 현재 | 변경 |
|---|---|---|
| `SummaryTabView` | `패널 #{i+1}` span | + `<PanelBadges panelId={fb.panel_id} />` |
| `TextMissionResults` | 패널 목록 좌측 패널명 | + `<PanelBadges panelId={fb.panel_id} />` |
| `DimTabView` 코멘트 | 어노테이션 panel 표시 없음 | 피드백 수 아래에 패널별 뱃지 |
| `PreferenceResults` | `패널 #${i+1} · 소재 ${r.preference}` | + `<PanelBadges panelId={r.panel_id} />` |
| `PricingResults` + `EmailResults` | `패널 #${i+1}` | + `<PanelBadges panelId={r.panel_id} />` |

> `panelProfiles`는 Results.jsx 최상위 스코프에서 정의 후 각 컴포넌트에서 클로저로 접근
> (prop drilling 없이 사용 — 모든 서브컴포넌트가 동일 파일 내 정의되어 있음)

---

## 검증

1. 패널 프로필 → 기본 정보 탭: 핸드폰 번호 입력 → "인증번호 발송" → OTP 6자리 입력 → "확인" → "✓ 인증 완료" 배지 표시 + DB phone/phone_verified 컬럼 저장 확인
2. 기업 Results 페이지 → 미션 선택 → 각 피드백에 직군·경력 뱃지 표시 확인
3. 이름·핸드폰 번호는 Results 어디에도 노출되지 않음 확인
4. D-28 원칙 준수: feedbacks 쿼리에 panels JOIN 없음, RPC 경유만 사용
