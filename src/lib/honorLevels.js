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
  blue:   { color: '#3b82f6',                bg: '#eff6ff',               label: '실버'   },
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
  const s = (experience || '').toLowerCase().trim();
  if (!s) return 1.0;
  if (/c레벨|팀장|임원|ceo|cto|coo|cfo|vp|대표|이사/.test(s)) return 3.0;
  if (/시니어/.test(s)) return 2.0;
  const match = s.match(/(\d+)/);
  if (match) {
    const years = parseInt(match[1], 10);
    if (years >= 8) return 2.0;
    if (years >= 4) return 1.5;
    return 1.0;
  }
  if (/미들/.test(s)) return 1.5;
  return 1.0;
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
