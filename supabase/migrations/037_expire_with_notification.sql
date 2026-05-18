-- 037_expire_with_notification.sql
-- expire_panel_drafts 재정의: 만료 draft 삭제 시 패널에게 "수락 취소됨" 알림 발송
-- 변경 사항:
--   - panels.user_id도 함께 조회 (알림 수신자 식별)
--   - 만료 draft 삭제 직전 mission title JOIN 후 notifications INSERT
--   - rejected 만료는 알림 없이 삭제만 (기존 동일)

CREATE OR REPLACE FUNCTION expire_panel_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id       UUID;
  v_user_id        UUID;
  v_draft_deleted  INTEGER := 0;
  v_reject_deleted INTEGER;
  rec              RECORD;
BEGIN
  SELECT id, user_id INTO v_panel_id, v_user_id
  FROM panels
  WHERE user_id = auth.uid();

  IF v_panel_id IS NULL THEN RETURN 0; END IF;

  -- draft 만료 처리: 수락 시 +1됐으므로 삭제 시 -1 + 알림 발송
  FOR rec IN
    SELECT f.id, f.mission_id, m.title AS mission_title
    FROM feedbacks f
    JOIN missions m ON m.id = f.mission_id
    WHERE f.panel_id = v_panel_id
      AND f.status   = 'draft'
      AND (
        -- 최초 수락 draft: submission_deadline 만료
        (f.rejection_deadline IS NULL
          AND f.submission_deadline IS NOT NULL
          AND f.submission_deadline < NOW())
        -- 재작성 draft: rejection_deadline 만료
        OR (f.rejection_deadline IS NOT NULL AND f.rejection_deadline < NOW())
      )
  LOOP
    DELETE FROM feedbacks WHERE id = rec.id;

    UPDATE missions
    SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
    WHERE id = rec.mission_id;

    -- 수락 취소 알림 발송
    INSERT INTO notifications (user_id, type, icon, title, body, action_url, read, target_role)
    VALUES (
      v_user_id,
      'warning',
      '🚫',
      '[' || COALESCE(rec.mission_title, '미션') || '] 수락 취소됨',
      '제출 기간이 만료되어 미션 수락이 자동 취소되었습니다.',
      '/panel/missions',
      false,
      'panel'
    );

    v_draft_deleted := v_draft_deleted + 1;
  END LOOP;

  -- rejected 만료 처리: 반려 시 이미 decrement됐으므로 삭제만 (알림 없음)
  DELETE FROM feedbacks
  WHERE panel_id = v_panel_id
    AND status   = 'rejected'
    AND rejection_deadline IS NOT NULL
    AND rejection_deadline < NOW();
  GET DIAGNOSTICS v_reject_deleted = ROW_COUNT;

  RETURN v_draft_deleted + v_reject_deleted;
END;
$$;
