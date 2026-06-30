// 서버 RPC가 throw하는 영문 에러 코드 → 사용자용 한국어 문구 단일 출처
// (구독/결제 도메인 RPC가 PaymentModal·Pricing·CancelSubscriptionModal 3곳에서 매핑돼
//  복제 시 드리프트 위험 → 단일 출처로 공유. otp.js·purityKeywords.js와 동일 패턴, D-35)
// 코드 출처: migration 120 (cancel/resume/admin_change_plan)의 RAISE EXCEPTION 메시지
export const RPC_ERR_KO = {
  downgrade_not_allowed: '현재 플랜보다 낮은 플랜으로는 변경할 수 없습니다.',
  no_active_subscription: '해지할 구독이 없습니다.',
  reason_required:        '해지 사유를 입력해주세요.',
  unauthorized:           '권한이 없습니다. 계정 오너만 변경할 수 있습니다.',
  'admin only':           '권한이 없습니다.',
  'invalid plan':         '잘못된 플랜입니다.',
  'company not found':    '회사 정보를 찾을 수 없습니다.',
};

// err는 Error 객체 또는 문자열 코드. 미매핑 코드는 원문, 코드도 없으면 fallback.
export function rpcErrorKo(err, fallback = '처리 중 오류가 발생했습니다.') {
  const code = typeof err === 'string' ? err : err?.message;
  return RPC_ERR_KO[code] || code || fallback;
}
