-- 093_admin_cancel_trial_restore.sql
-- 어드민이 무료 체험 의뢰를 "취소"만 해도 기업의 무료 체험 기회(companies.free_trial_used)를 복구한다.
--   기존(091/D-124): 복구는 "삭제"에만 있었고, 취소(cancelled)는 재개 가능하므로 복구하지 않았음.
--   변경(제품 결정): 취소 후 삭제까지 가지 않아도 다시 체험할 수 있도록 — 취소 시 free_trial_used=false 복구.
--                   재개(cancelled→active) 시에는 다시 소진(free_trial_used=true) — 취소/재개 대칭, farming 방지.
--   ※ missions.status + companies.free_trial_used를 한 SECURITY DEFINER 트랜잭션으로 처리(RLS 무음 실패 회피, C-5).
--   ※ 기업 직접 '조기 종료'(company Dashboard)는 이 RPC를 쓰지 않으므로 복구되지 않음 — 어드민 취소 경로 전용(farming 방지).
--   ※ status는 092 보호 컬럼이 아니므로 일반 의뢰 취소는 클라 직접 UPDATE 유지(동작 불변). 무료 체험 의뢰만 이 RPC로 라우팅.

CREATE OR REPLACE FUNCTION admin_set_trial_mission_status(p_mission_id UUID, p_new_status TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_is_free    BOOLEAN;
BEGIN
  -- 취소/재개만 허용 (그 외 상태 전환은 이 RPC 대상 아님)
  IF p_new_status NOT IN ('cancelled', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

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

  -- 상태 전환
  UPDATE missions SET status = p_new_status WHERE id = p_mission_id;

  -- 무료 체험 의뢰면 기회 토글: 취소→false(복구) / 재개→true(재소진)
  IF v_is_free AND v_company_id IS NOT NULL THEN
    UPDATE companies
      SET free_trial_used = (p_new_status = 'active')
      WHERE id = v_company_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_free_trial', COALESCE(v_is_free, false),
    'free_trial_used', (p_new_status = 'active')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_trial_mission_status(UUID, TEXT) TO authenticated;
