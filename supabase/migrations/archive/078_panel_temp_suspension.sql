-- 078_panel_temp_suspension.sql
-- 패널 기간제 임시 정지 기능
-- panels.suspend_until 컬럼 추가 + 만료 자동 해제 RPC (알림 포함)

-- 1. suspend_until 컬럼 추가
ALTER TABLE panels ADD COLUMN IF NOT EXISTS suspend_until TIMESTAMPTZ DEFAULT NULL;

-- 2. 만료된 임시 정지 자동 해제 함수 (해제 패널에게 알림 발송 포함)
CREATE OR REPLACE FUNCTION lift_expired_panel_suspensions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  INTEGER := 0;
  v_rec    RECORD;
BEGIN
  -- 만료 대상 패널 순회: 해제 + 알림 발송
  FOR v_rec IN
    SELECT id, user_id
    FROM panels
    WHERE status = 'suspended'
      AND suspend_until IS NOT NULL
      AND suspend_until <= NOW()
  LOOP
    -- 상태 해제
    UPDATE panels
    SET status = 'active', suspend_until = NULL
    WHERE id = v_rec.id;

    -- 패널에게 알림 발송
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, target_role, read, created_at)
    VALUES (
      v_rec.user_id,
      'success',
      '✅',
      '임시 정지가 해제되었습니다',
      '계정이 다시 활성화되었습니다. 미션 탐색 페이지에서 새로운 의뢰에 참여할 수 있습니다.',
      '/panel/missions',
      'panel',
      FALSE,
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION lift_expired_panel_suspensions() TO service_role;

-- 3. pg_cron 매시간 자동 실행 스케줄
-- ※ Supabase SQL Editor에서 아래 구문을 별도로 실행해야 함
-- SELECT cron.schedule(
--   'lift-panel-suspensions',
--   '0 * * * *',
--   $$SELECT lift_expired_panel_suspensions()$$
-- );
