-- 031_feedbacks_payout_tracking.sql
-- 정산 이력 불변성 보장: 승인 시점 확정 금액 저장 + 반려 패널티 복구 추적
--
-- payout_amount      : approve() 시 getPanelReward 결과를 스냅샷 저장
--                      이후 패널이 experience를 변경해도 확정된 금액이 불변
-- rejection_penalty_applied : reject() 시 true, 재승인 시 +5pts 복구 후 false로 되돌림

ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rejection_penalty_applied BOOLEAN NOT NULL DEFAULT FALSE;
