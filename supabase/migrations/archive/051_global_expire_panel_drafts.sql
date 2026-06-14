-- 051_global_expire_panel_drafts.sql
-- 서버 측 전체 패널 draft 만료 자동 처리
--
-- 문제: expire_panel_drafts()는 auth.uid() 기반 개인 청소 함수 →
--       패널이 접속하지 않으면 만료된 슬롯이 영구 점유됨
--
-- 해결: expire_all_panel_drafts() SECURITY DEFINER 전체 처리 함수 +
--       pg_cron 10분마다 자동 호출 → 패널 접속 여부와 무관하게 만료 즉시 슬롯 반환
--
-- 케이스별 처리:
--   ① draft + submission_deadline 만료 (최초 수락, 미제출)
--      → filled_count -1 + 행 삭제 (제출 데이터 없으므로 보존 가치 없음)
--   ② draft + rejection_deadline 만료 (재작성 클릭 후 포기)
--      → filled_count -1 + status = 'rejected' 로 되돌림
--        (지급거절 탭에 남아 패널이 수동 삭제 가능)
--   ③ rejected + rejection_deadline 만료
--      → 처리 없음 (반려 시점에 이미 -1됨, 기록은 패널이 직접 삭제)
--
-- ⚠️ pg_cron 스케줄 등록은 supabase db push로 적용 불가.
--    Supabase 대시보드 → SQL Editor에서 아래 cron.schedule 블록을 수동 실행할 것.

-- ═══════════════════════════════════════════════════════════════
-- 1. expire_all_panel_drafts — 전체 패널 대상 만료 처리
--    (auth.uid() 미사용 — pg_cron 컨텍스트에서도 실행 가능)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION expire_all_panel_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total       INTEGER := 0;
  v_deleted_row INTEGER;
  rec           RECORD;
BEGIN
  -- ① 최초 수락 draft 만료: submission_deadline 초과, rejection_deadline 없음
  --    슬롯 반환 + 행 삭제 (제출 데이터 없으므로 보존 불필요)
  FOR rec IN
    SELECT id, mission_id FROM feedbacks
    WHERE status               = 'draft'
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

  -- ② 재작성 draft 만료: rejection_deadline 초과
  --    슬롯 반환 + status = 'rejected' 로 되돌림
  --    (지급거절 탭에 남아 패널이 수동 삭제 가능)
  --
  --    동시성 안전: feedbacks UPDATE를 먼저 시도 → 0행이면 이미 다른 트랜잭션이 처리 → missions 건너뜀
  --    (missions 먼저 UPDATE하면 두 트랜잭션 모두 -1해 이중 차감 발생)
  FOR rec IN
    SELECT id, mission_id FROM feedbacks
    WHERE status             = 'draft'
      AND rejection_deadline IS NOT NULL
      AND rejection_deadline < NOW()
  LOOP
    -- feedbacks 먼저: 경쟁에서 이긴 트랜잭션만 1행 반환
    UPDATE feedbacks
    SET status = 'rejected'
    WHERE id = rec.id AND status = 'draft';
    GET DIAGNOSTICS v_deleted_row = ROW_COUNT;

    IF v_deleted_row > 0 THEN
      -- 경쟁 승리 → 슬롯 반환
      UPDATE missions
      SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
      WHERE id = rec.mission_id;
      v_total := v_total + 1;
    END IF;
  END LOOP;

  -- ③ rejected + rejection_deadline 만료: 처리 없음
  --    반려 시점에 이미 -1됨. 패널이 정산내역에서 수동 삭제.

  RETURN v_total;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 2. pg_cron 스케줄 등록
--    ⚠️ 아래 블록은 Supabase SQL Editor에서 수동 실행할 것
--    (pg_cron extension이 활성화되어 있어야 함)
-- ═══════════════════════════════════════════════════════════════

-- 기존 잡이 있으면 제거 후 재등록 (중복 방지)
SELECT cron.unschedule('expire-all-panel-drafts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-all-panel-drafts'
);

-- 10분마다 전체 만료 처리 실행
SELECT cron.schedule(
  'expire-all-panel-drafts',
  '*/10 * * * *',
  $$SELECT expire_all_panel_drafts()$$
);
