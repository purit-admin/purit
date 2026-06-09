-- 082_panel_rejection_flow.sql
-- 패널 심사 거절 → 재제출 → 재심사 / 누적 3회 거절 시 영구 차단(banned) 플로우
-- 배경: 기존엔 심사 거절(pending→suspended)과 계정 정지(active→suspended)가 같은 'suspended' 값을 공유.
--       → 거절 패널에 "정지 해제"를 누르면 active로 잘못 복귀 + 재제출 경로 없음 + 거절 횟수 추적 불가.
--
-- 상태 모델(변경 후):
--   pending   — 심사 대기 (최초 또는 재제출)
--   active    — 승인됨
--   suspended — 활성 계정의 정지 전용 (기존 "정지 해제" 동작 유지)
--   rejected  — 신규: 심사 반려 (사유 + 재제출 가능, 재제출 시 pending 복귀)
--   banned    — 신규: 누적 3회 거절, 영구 차단 (재제출 불가, 어드민 수동 해제만 가능)
--
-- ※ status 컬럼에 CHECK 제약은 없음(앱 레벨 enforce) — 기존 패턴 유지, 신규 값도 CHECK 추가 안 함.
-- ※ 기존 test-data 중 거절로 인해 'suspended'가 된 행은 DB상 실제 정지와 구분 불가하므로
--   자동 마이그레이션하지 않는다. 필요 시 배포 후 콘솔에서 id로 수동 보정.

-- ① 신규 컬럼 2개
ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS rejection_count  INTEGER DEFAULT 0,   -- 누적 심사 거절 횟수 (3 도달 시 banned)
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;                -- 최근 거절 사유 (패널에게 표시, 재제출 시 클리어)

-- ② save_panel_verification_docs RPC 재정의 (081과 동일 6-param 시그니처 → CREATE OR REPLACE만)
--    추가: (1) pending/rejected 상태에서만 (재)제출 허용 — suspended/active/banned의 상태 우회 차단
--          (2) 제출 시 status='pending'으로 flip (rejected→pending = 재제출, pending→pending 유지)
--          (3) 재제출(기존 status='rejected')이면 rejection_reason 클리어
CREATE OR REPLACE FUNCTION public.save_panel_verification_docs(
  p_user_id              UUID,
  p_health_insurance_url TEXT DEFAULT NULL,
  p_linkedin_url         TEXT DEFAULT NULL,
  p_portfolio_url        TEXT DEFAULT NULL,
  p_portfolio_file_url   TEXT DEFAULT NULL,
  p_experience_years     INT  DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- 인증 체크: 호출자가 본인이어야 함
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT status INTO v_status FROM panels WHERE user_id = p_user_id;

  -- pending(최초 제출 단계) 또는 rejected(반려 후 재제출)에서만 허용.
  -- suspended/active/banned 패널이 RPC를 호출해 status를 pending으로 우회하는 것을 차단.
  IF v_status NOT IN ('pending', 'rejected') THEN
    RETURN FALSE;
  END IF;

  -- 전달된 값만 업데이트 (NULL이면 기존 값 유지 — COALESCE 패턴)
  -- experience_years: 미확정(confirmed_at NULL) 상태에서만 자가입력 반영 → 어드민 확정값 보호
  -- rejection_reason: 재제출(기존 status='rejected')이면 클리어, 그 외(pending)는 유지(=NULL)
  UPDATE panels
  SET
    health_insurance_url = COALESCE(p_health_insurance_url, health_insurance_url),
    linkedin_url         = COALESCE(p_linkedin_url,         linkedin_url),
    portfolio_url        = COALESCE(p_portfolio_url,        portfolio_url),
    portfolio_file_url   = COALESCE(p_portfolio_file_url,   portfolio_file_url),
    experience_years     = CASE
                             WHEN experience_confirmed_at IS NULL AND p_experience_years IS NOT NULL
                             THEN p_experience_years
                             ELSE experience_years
                           END,
    rejection_reason     = CASE WHEN status = 'rejected' THEN NULL ELSE rejection_reason END,
    status               = 'pending'
  WHERE user_id = p_user_id
    AND status IN ('pending', 'rejected');

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_panel_verification_docs(UUID, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;

-- ③ 재제출(rejected→pending) 시 어드민 알림 트리거
--    기존 on_panel_pending_created는 AFTER INSERT 전용이라 재제출(UPDATE)에 발화하지 않음.
--    062의 notify_admin_on_new_panel(단일 어드민 조회, app_metadata 기준 — D-58) 패턴을 재사용.
CREATE OR REPLACE FUNCTION public.notify_admin_on_panel_resubmit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_panel_name TEXT;
BEGIN
  -- 반려(rejected) → 재제출(pending) 전환에만 발화
  IF NOT (OLD.status = 'rejected' AND NEW.status = 'pending') THEN
    RETURN NEW;
  END IF;

  v_panel_name := COALESCE(NEW.name, '(이름 없음)');

  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE raw_app_meta_data->>'role' = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, icon, title, body, action_url, target_role, read
  ) VALUES (
    v_admin_id,
    'info',
    '🔁',
    '패널 서류 재제출',
    v_panel_name || '님이 검증 서류를 재제출했습니다. 재심사를 진행해 주세요.',
    '/admin/panels',
    'admin',
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_panel_resubmit ON public.panels;
CREATE TRIGGER on_panel_resubmit
  AFTER UPDATE OF status ON public.panels
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_panel_resubmit();
