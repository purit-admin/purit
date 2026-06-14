-- 052_fix_expire_panel_drafts_race.sql
-- expire_panel_drafts (per-user) 동작 개선
--
-- 변경 1: 051과 동일한 케이스별 처리 적용
--   ① 최초 수락 draft 만료 → 슬롯 반환 + 행 삭제
--   ② 재작성 draft 만료    → 슬롯 반환 + status = 'rejected'
--   ③ rejected 만료        → 처리 없음
--
-- 변경 2: race condition 수정
--   expire_all_panel_drafts(전역 cron)과 동시 실행 시 이중 차감 방지
--   ① DELETE 후 GET DIAGNOSTICS로 실제 삭제 여부 확인
--   ② UPDATE feedbacks status='rejected' 후 ROW_COUNT 확인 → 0이면 이미 처리됨

CREATE OR REPLACE FUNCTION expire_panel_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id    UUID;
  v_total       INTEGER := 0;
  v_deleted_row INTEGER;
  rec           RECORD;
BEGIN
  SELECT id INTO v_panel_id FROM panels WHERE user_id = auth.uid();
  IF v_panel_id IS NULL THEN RETURN 0; END IF;

  -- ① 최초 수락 draft 만료: 슬롯 반환 + 행 삭제
  FOR rec IN
    SELECT id, mission_id FROM feedbacks
    WHERE panel_id             = v_panel_id
      AND status               = 'draft'
      AND rejection_deadline   IS NULL
      AND submission_deadline  IS NOT NULL
      AND submission_deadline  < NOW()
  LOOP
    DELETE FROM feedbacks WHERE id = rec.id;
    GET DIAGNOSTICS v_deleted_row = ROW_COUNT;
    IF v_deleted_row > 0 THEN
      UPDATE missions
      SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
      WHERE id = rec.mission_id;
      v_total := v_total + 1;
    END IF;
  END LOOP;

  -- ② 재작성 draft 만료: 슬롯 반환 + status = 'rejected'
  --    feedbacks 먼저 UPDATE → 0행이면 전역 cron이 이미 처리 → missions 건너뜀
  FOR rec IN
    SELECT id, mission_id FROM feedbacks
    WHERE panel_id           = v_panel_id
      AND status             = 'draft'
      AND rejection_deadline IS NOT NULL
      AND rejection_deadline < NOW()
  LOOP
    UPDATE feedbacks
    SET status = 'rejected'
    WHERE id = rec.id AND status = 'draft';
    GET DIAGNOSTICS v_deleted_row = ROW_COUNT;

    IF v_deleted_row > 0 THEN
      UPDATE missions
      SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
      WHERE id = rec.mission_id;
      v_total := v_total + 1;
    END IF;
  END LOOP;

  -- ③ rejected 만료: 처리 없음 (패널이 정산내역에서 수동 삭제)

  RETURN v_total;
END;
$$;
