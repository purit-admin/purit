export const HONOR_LEVELS = [
  { level: 1,  minPoints: 0,      baseReward: 8000,  colorTier: 'gray'   },
  { level: 2,  minPoints: 100,    baseReward: 8200,  colorTier: 'gray'   },
  { level: 3,  minPoints: 300,    baseReward: 8400,  colorTier: 'gray'   },
  { level: 4,  minPoints: 700,    baseReward: 8700,  colorTier: 'blue'   },
  { level: 5,  minPoints: 1400,   baseReward: 9000,  colorTier: 'blue'   },
  { level: 6,  minPoints: 2500,   baseReward: 9400,  colorTier: 'blue'   },
  { level: 7,  minPoints: 4200,   baseReward: 9900,  colorTier: 'gold'   },
  { level: 8,  minPoints: 6800,   baseReward: 10500, colorTier: 'gold'   },
  { level: 9,  minPoints: 11000,  baseReward: 11200, colorTier: 'purple' },
  { level: 10, minPoints: 20000,  baseReward: 12000, colorTier: 'purple' },
];

export const HONOR_COLOR_META = {
  gray:   { color: 'var(--text-3)',          bg: 'var(--surface-2)',      label: '브론즈' },
  blue:   { color: '#10367D',                bg: '#E8EEF8',               label: '실버'   },
  gold:   { color: 'var(--accent)',          bg: 'var(--accent-dim)',     label: '골드'   },
  purple: { color: '#a855f7',                bg: 'rgba(168,85,247,0.1)', label: '다이아' },
};

export function getHonorLevel(points = 0) {
  for (let i = HONOR_LEVELS.length - 1; i >= 0; i--) {
    if (points >= HONOR_LEVELS[i].minPoints) return HONOR_LEVELS[i];
  }
  return HONOR_LEVELS[0];
}

export function getNextLevel(points = 0) {
  const current = getHonorLevel(points);
  return HONOR_LEVELS.find(l => l.level === current.level + 1) ?? null;
}

export function getProgressPct(points = 0) {
  const current = getHonorLevel(points);
  const next    = getNextLevel(points);
  if (!next) return 100;
  const range = next.minPoints - current.minPoints;
  const done  = points - current.minPoints;
  return Math.min(100, Math.round((done / range) * 100));
}

export function getExperienceMultiplier(experience = '') {
  // 연차 구간: 주니어 2~4(1.0×) / 미들 5~7(1.5×) / 시니어 8~14(2.0×) / 헤드 15+(3.0×)
  // ※ 헤드는 experience 텍스트가 'N년'으로 저장됨(숫자 분기에서 ≥15 처리). 키워드 분기는 레거시 텍스트 안전망.
  const s = (experience || '').toLowerCase().trim();
  if (!s) return 1.0;
  if (/헤드|c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사/.test(s)) return 3.0;
  if (/시니어/.test(s)) return 2.0;
  const match = s.match(/(\d+)/);
  if (match) {
    const years = parseInt(match[1], 10);
    if (years >= 15) return 3.0;
    if (years >= 8) return 2.0;
    if (years >= 5) return 1.5;
    return 1.0;
  }
  if (/미들/.test(s)) return 1.5;
  return 1.0;
}

export function getExperienceCareerKey(experience = '') {
  const mult = getExperienceMultiplier(experience);
  if (mult >= 3.0) return 'clevel';
  if (mult >= 2.0) return 'senior';
  if (mult >= 1.5) return 'middle';
  return 'junior';
}

// 무료 체험 언락: 패널 1인당 잠금 해제 크레딧 (경력 기준 × 메인 1.5배 — 주니어1.5·미들3·시니어4.5·헤드6)
// ※ 체험 의뢰는 항상 메인(landing_page)이므로 메인 1.5배(calcCredits 'main')를 경력 크레딧에도 동일 반영
export const CAREER_UNLOCK_CREDIT = { junior: 1.5, middle: 3, senior: 4.5, clevel: 6 };
export function getCareerUnlockCredit(experience = '') {
  return CAREER_UNLOCK_CREDIT[getExperienceCareerKey(experience)] || 1;
}

// 무료 체험 첫 언락 할인: 결과 최초 열람 시점부터 48시간 동안 30% 할인 (마감 후 정가)
// ※ 서버 unlock_free_trial_mission RPC와 1:1 정합 (D-121 표시가=결제가). 값 변경 시 094 마이그레이션도 함께 수정.
export const TRIAL_FIRST_UNLOCK_DISCOUNT = 0.30;
export const TRIAL_UNLOCK_DISCOUNT_WINDOW_HOURS = 48;
// 잠금 해제 비용에 할인 적용 (정가 → 할인가). 소수 둘째자리 반올림 — 서버 ROUND(_,2)와 동일.
export function applyUnlockDiscount(baseCost, withinWindow) {
  if (!withinWindow) return baseCost;
  return Math.round(baseCost * (1 - TRIAL_FIRST_UNLOCK_DISCOUNT) * 100) / 100;
}

export function getPanelReward(points = 0, experience = '') {
  const level = getHonorLevel(points);
  const mult  = getExperienceMultiplier(experience);
  return Math.round(level.baseReward * mult);
}

export function fmtWon(n) {
  if (!n) return '₩0';
  const man  = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!man)  return `₩${rest.toLocaleString()}`;
  if (!rest) return `₩${man}만`;
  return `₩${man}만 ${rest.toLocaleString()}`;
}

export function fmtKRW(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString();
}
