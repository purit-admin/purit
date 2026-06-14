-- 091_admin_delete_trial_restore.sql
-- 어드민이 무료 체험 의뢰를 삭제하면 기업의 무료 체험 기회(companies.free_trial_used)를 복구한다.
--   문제: create_free_trial_mission(085)이 free_trial_used=true로 박은 뒤 이를 false로 되돌리는 경로가 없어,
--         어드민이 체험 의뢰를 삭제하면 의뢰는 사라지는데 기회는 영구 소진 → 기업이 무료 의뢰를 다시 못 만듦.
--   처리: 삭제(영구 제거)를 "이 체험은 없던 일"로 보고 free_trial_used=false 복구.
--         취소(cancelled)는 재개 가능하므로 복구하지 않음 — 삭제 경로에서만 복구.
--   ※ 미션 삭제 + companies UPDATE를 한 SECURITY DEFINER 트랜잭션으로 처리(RLS 무음 실패 회피, C-5).
--   ※ feedbacks 등 자식 행은 ON DELETE CASCADE(088)로 함께 삭제됨.

CREATE OR REPLACE FUNCTION admin_delete_trial_mission(p_mission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_is_free    BOOLEAN;
BEGIN
  -- 어드민만 (user_metadata/app_metadata 어느 쪽이든 — 043 OR 패턴)
  IF NOT (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
    OR (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT company_id, is_free_trial INTO v_company_id, v_is_free
  FROM missions WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'mission_not_found');
  END IF;

  -- 미션 삭제 (자식 행은 CASCADE)
  DELETE FROM missions WHERE id = p_mission_id;

  -- 무료 체험 의뢰였다면 기업의 무료 체험 기회 복구
  IF v_is_free AND v_company_id IS NOT NULL THEN
    UPDATE companies SET free_trial_used = false WHERE id = v_company_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'free_trial_restored', COALESCE(v_is_free, false));
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_trial_mission(UUID) TO authenticated;
