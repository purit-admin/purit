-- 114_feedbacks_insert_guard.sql
-- feedbacks 의 승인·정산 컬럼 보호를 INSERT 경로까지 확장 (니체-SEC-피드백INSERT, 28-2 / D-160 비대칭 잔존)
--
--  배경: 112 가 guard_feedbacks_decision_columns() 트리거로 purity_passed→true·payout_amount·
--    rejection_penalty_applied 직접 조작을 막았으나, 트리거가 BEFORE UPDATE 전용이었음.
--    feedbacks INSERT RLS(feedbacks_insert)의 with_check 은 panel_id 소유만 검사하고
--    (panel_id IN (SELECT id FROM panels WHERE user_id = auth.uid())) purity_passed·payout_amount 는 무제한 →
--    패널이 콘솔/REST 로 자기 panel_id + purity_passed=true(+payout_amount 임의, +임의 mission_id) 행을
--    직접 INSERT 가능 → 어드민 검수 없이 가짜 승인(결과 집계 오염)·가짜 정산 내역 조작 (실 DB pg_policies 로 확정).
--    "수정은 막고 삽입은 안 막은" 비대칭 — D-159(reactivate/complete 비대칭)·D-160(행만 막고 컬럼 방치) 동형.
--
--  해결: 트리거를 BEFORE INSERT OR UPDATE 로 확장. 함수 본문은 이미 NULL 안전이라 무수정:
--    INSERT 시 OLD 는 NULL → OLD.purity_passed IS DISTINCT FROM TRUE = TRUE 이므로
--    NEW.purity_passed IS TRUE(=직접 합격 도장) 면 차단. payout_amount/rejection_penalty_applied 동일.
--    · 정상 제출(accept_mission_slot, SECURITY DEFINER·postgres 소유)은 current_user≠authenticated → 가드 스킵.
--    · 패널 정상 직접 INSERT(클라 코드엔 없음)라도 purity_passed=false·payout_amount NULL 이면 통과 → 무해.
--    · 어드민 client(is_caller_admin) 통과.
--  → 클라이언트 코드 무변경. 112 와 동일 함수를 트리거 시점만 대칭화.
--
-- ⚠️ Supabase SQL Editor 수동 실행 필요. 순수 DB(트리거 재생성) — 함수·정책·클라이언트 무변경.

-- 함수는 112 정의 그대로 사용(NULL 안전 — INSERT 시 OLD 컬럼 참조는 NULL 반환). 트리거만 INSERT OR UPDATE 로 교체.
DROP TRIGGER IF EXISTS trg_guard_feedbacks_decision ON feedbacks;
CREATE TRIGGER trg_guard_feedbacks_decision
  BEFORE INSERT OR UPDATE ON feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION guard_feedbacks_decision_columns();
