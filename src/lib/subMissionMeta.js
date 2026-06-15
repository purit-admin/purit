// 서브 의뢰(소재 비교·이메일) 메타데이터 단일 출처 (SSOT)
// 기업 등록(PreferenceTest·ColdEmailTest) / 패널 수행(ActiveMission) / 결과(Results·PurityFilter·ShareResult)가
// 동일한 라벨·해석 로직을 공유 — 포털별 라벨 중복 정의로 인한 표시 불일치 방지 (D-35/D-127 교훈)

// 기타(직접입력) 공통 글자수 제한
export const SUB_CUSTOM_MAXLEN = 25;

// ── 소재 비교(preference): 검증 유형 ──
export const ASSET_TYPES = [
  { key: 'headline',   label: '헤드라인 카피', icon: '◎', desc: '두 헤드라인 중 구매 욕구를 더 자극하는 쪽' },
  { key: 'cta',        label: 'CTA 문구',      icon: '▲', desc: '클릭을 유도하는 버튼 텍스트 비교' },
  { key: 'value_prop', label: '가치 제안',     icon: '◆', desc: '핵심 가치를 설명하는 두 방식 비교' },
  { key: 'lp_section', label: 'LP 섹션',       icon: '◈', desc: '랜딩페이지 특정 섹션의 두 버전 비교' },
  { key: 'ad_copy',    label: '광고 소재',     icon: '●', desc: '두 광고 소재 중 전환 가능성 높은 쪽' },
  { key: 'email',      label: '이메일 제목',   icon: '✉', desc: '두 이메일 제목 중 열람율이 높을 쪽' },
];
const ASSET_TYPE_BY_KEY = Object.fromEntries(ASSET_TYPES.map(t => [t.key, t]));

// parsedDesc(미션 description JSON) → { label, desc } | null
// 'custom'(기타)이면 기업이 직접 입력한 문구를 라벨로 사용
export function resolveAssetType(parsedDesc) {
  const at = parsedDesc?.assetType;
  if (!at) return null;
  if (at === 'custom') {
    const t = (parsedDesc.assetTypeCustom || '').trim();
    return t ? { label: t, desc: '' } : null;
  }
  const m = ASSET_TYPE_BY_KEY[at];
  return m ? { label: m.label, desc: m.desc } : null;
}

// ── 이메일(email): 전환 목표 ──
export const EMAIL_GOALS = [
  { key: 'reply',   label: '답장',          desc: '이메일에 직접 답장하도록 유도' },
  { key: 'click',   label: '링크·CTA 클릭', desc: '본문 링크나 버튼을 클릭하도록 유도' },
  { key: 'meeting', label: '미팅·데모 예약', desc: '미팅이나 데모 일정을 예약하도록 유도' },
  { key: 'signup',  label: '가입·회원가입', desc: '서비스 가입·등록을 하도록 유도' },
];
const EMAIL_GOAL_BY_KEY = Object.fromEntries(EMAIL_GOALS.map(g => [g.key, g]));

// parsedDesc → { label } (항상 라벨 반환 — 레거시 미설정 이메일 의뢰는 '답장' 폴백)
export function resolveEmailGoal(parsedDesc) {
  const g = parsedDesc?.conversionGoal;
  if (!g) return { label: '답장' };
  if (g === 'custom') {
    const t = (parsedDesc.conversionGoalCustom || '').trim();
    return { label: t || '답장' };
  }
  const m = EMAIL_GOAL_BY_KEY[g];
  return { label: m ? m.label : '답장' };
}
