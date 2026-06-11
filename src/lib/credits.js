// credits.js — 월간(구독)/추가(구매) 크레딧 구분 헬퍼
//
// 서버는 단일 지갑(companies.credit_balance)에서 차감하고, addon_credits 는 "보존돼야 할
// 구매 충전분"만 추적한다. 소비는 항상 "구독분 먼저, 구매분 나중" 규약이므로
// 아래 파생식으로 월간/추가 잔여를 별도 추적 없이 정확히 분리할 수 있다 (마이그레이션 096 / D-129).

/**
 * 잔액을 월간(구독)·추가(구매)로 분리.
 * @param {number} balance companies.credit_balance (총 가용 잔액)
 * @param {number} addon   companies.addon_credits   (보존 구매분 트래커)
 * @returns {{ monthly: number, addon: number, total: number }}
 */
export function splitCredits(balance, addon) {
  const b = Number(balance) || 0;
  const a = Number(addon) || 0;
  const addonRemain = Math.min(a, b);        // 구독분 먼저 소진 → 구매분 잔량
  const monthlyRemain = Math.max(0, b - a);  // 나머지가 월간 구독 잔량
  return { monthly: monthlyRemain, addon: addonRemain, total: b };
}

/**
 * 의뢰 비용이 '월간 크레딧만으로 부족 & 총잔액으로는 충분' → 추가 크레딧 사용 확인이 필요한지.
 * (총잔액 자체가 부족하면 false — 그건 기존 충전/업그레이드 경로(isShort)가 처리)
 * @returns {boolean}
 */
export function needsAddonConfirm(cost, balance, addon) {
  const c = Number(cost) || 0;
  const b = Number(balance) || 0;
  const { monthly } = splitCredits(b, addon);
  return c > monthly && c <= b;
}

/**
 * 추가 크레딧에서 끌어 쓰게 되는 금액(확인 모달 문구용).
 * @returns {number}
 */
export function addonUsageFor(cost, balance, addon) {
  const c = Number(cost) || 0;
  const { monthly } = splitCredits(balance, addon);
  return Math.max(0, c - monthly);
}

/** "월간 Ncr · 추가 Mcr" 표기 헬퍼 (cr 단위 숫자 포맷은 호출측에서) */
export function fmtSplit(balance, addon) {
  const s = splitCredits(balance, addon);
  return `월간 ${s.monthly}cr · 추가 ${s.addon}cr`;
}
