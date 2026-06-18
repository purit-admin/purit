-- 115_tighten_select_and_insert_guards.sql
-- 니체 보안 전수조사 1단계 — 라이브 DB(pg_policies) 검증으로 확정된 4개 갭 일괄 차단.
-- 전부 순수 DB(정책·트리거·RPC 게이트). 클라이언트 코드 무변경. 정상 경로 전부 보존(아래 근거).
--
--  [#1] panels SELECT = `true` (대시보드 수동 추가) → 로그인 불필요 포함 전체 패널 PII 열람
--       (전화번호·서류 URL·이메일·실명·honor/trust 점수). RLS는 정책 OR 결합이라 `true` 하나가
--       본인/어드민 제한 정책을 전부 무력화. 문서(3_Error_Log D-1)는 '본인 or admin'으로 적혀 있었으나
--       실 DB는 개방 상태였음(니체 라이브 검증).
--       → 기업 포털은 panels 를 직접 SELECT 하지 않음(전부 get_panel_public_profiles DEFINER RPC 경유) →
--         본인+어드민으로 좁혀도 깨지는 경로 없음(클라 읽기경로 전수 매핑 완료). anon 직접읽기 경로도 없음.
--
--  [#5] preference/pricing/email_responses UPDATE = `USING(true)` (007) → 아무 인증 유저가
--       타 패널의 서브 응답(점수·코멘트)을 임의 UPDATE → 경쟁사 결과 오염.
--       → 본인 패널(+어드민)만 UPDATE 가능하게 좁힘. 정상 재제출(D-29)은 본인 panel_id UPDATE라 통과.
--       ※ SELECT(=true)·INSERT는 본 마이그레이션 비대상(Results/ShareResult 읽기경로 영향 — 2단계에서 처리).
--
--  [#6] missions freemium 컬럼(092/094 guard)이 BEFORE UPDATE 전용 → INSERT 경로로 우회(114와 동형 D-163).
--       기업이 콘솔/REST로 is_free_trial=true·trial_unlocked=true 등을 직접 INSERT → 크레딧예약·언락 페이월 우회.
--       → 가드 함수를 TG_OP 분기로 재작성 후 트리거를 BEFORE INSERT OR UPDATE 로 대칭화.
--         INSERT 분기는 "비-기본값(권한) 컬럼이면 차단" — 4개 등록폼(NewMission·Pref·Pricing·ColdEmail)은
--         freemium 컬럼을 일절 INSERT하지 않음(전부 default, 무료체험은 INSERT 후 create_free_trial_mission RPC)
--         → 정상 등록 무영향. DEFINER RPC(create_free_trial_mission 등)는 current_user≠authenticated라 통과.
--
--  [#8] admin_delete_feedback(053)·decrement_mission_filled_count·restore_mission_slot(049)의 어드민 게이트가
--       `(... app_metadata->>'role') <> 'admin'` 형태 → app_metadata.role NULL 인 일반 유저가 `NULL <> 'admin'`
--       = NULL(거짓) 로 게이트를 통과(D-134). → 112의 is_caller_admin()(EXISTS·NULL 안전·app_metadata 전용 D-58)로 교체.
--
-- ⚠️ Supabase SQL Editor 수동 실행 필요. is_caller_admin() 헬퍼는 112에서 이미 생성됨(선행 적용 전제).


-- ─── #1) panels SELECT 과다개방 차단 → 본인 + 어드민 ──────────────────────────────
--   이름 무관 안전: 현재 panels 의 모든 cmd='SELECT' 정책(`true`·dead jwt-role·app_metadata)을 일괄 제거 후
--   단일 정책으로 재생성. cmd='ALL'(본인 self) / 066 어드민 UPDATE 정책은 보존(SELECT 외).
--   어드민 SELECT 는 새 정책의 is_caller_admin() 으로 유지.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'panels' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON panels', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS panels_select_own_or_admin ON panels;
CREATE POLICY panels_select_own_or_admin ON panels
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_caller_admin());


-- ─── #5) 서브 응답 3종 UPDATE 과다개방 차단 → 본인 패널 + 어드민 ───────────────────
--   이름 무관 안전: 각 테이블의 모든 cmd='UPDATE' 정책을 제거 후 본인+어드민 정책 재생성.
--   INSERT(본인 panel_id)·SELECT(true) 정책은 그대로 유지(비대상).
DO $$
DECLARE pol RECORD; t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['preference_responses','pricing_responses','email_responses']
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'UPDATE'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY auth_update_pref_responses ON preference_responses
  FOR UPDATE TO authenticated
  USING (panel_id = (SELECT id FROM panels WHERE user_id = auth.uid()) OR public.is_caller_admin())
  WITH CHECK (panel_id = (SELECT id FROM panels WHERE user_id = auth.uid()) OR public.is_caller_admin());

CREATE POLICY auth_update_pricing_responses ON pricing_responses
  FOR UPDATE TO authenticated
  USING (panel_id = (SELECT id FROM panels WHERE user_id = auth.uid()) OR public.is_caller_admin())
  WITH CHECK (panel_id = (SELECT id FROM panels WHERE user_id = auth.uid()) OR public.is_caller_admin());

CREATE POLICY auth_update_email_responses ON email_responses
  FOR UPDATE TO authenticated
  USING (panel_id = (SELECT id FROM panels WHERE user_id = auth.uid()) OR public.is_caller_admin())
  WITH CHECK (panel_id = (SELECT id FROM panels WHERE user_id = auth.uid()) OR public.is_caller_admin());


-- ─── #6) missions freemium 컬럼 가드 — INSERT 경로 대칭화 (092/094 재정의) ─────────
--   UPDATE 분기: 094 본문 그대로(IS DISTINCT FROM OLD). INSERT 분기: 비-기본값(권한) 컬럼이면 차단.
--   current_user 가 authenticated/anon(클라 직접)일 때만 검사 — DEFINER RPC(postgres)는 통과(092 패턴 유지).
CREATE OR REPLACE FUNCTION guard_mission_freemium_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- 클라 직접 INSERT 는 freemium/결제 컬럼을 미설정(기본값)으로만 둘 수 있음. 비-기본값이면 차단.
      IF COALESCE(NEW.is_free_trial, false) IS TRUE
         OR COALESCE(NEW.trial_unlocked, false) IS TRUE
         OR NEW.trial_public_panel_ids IS NOT NULL
         OR COALESCE(NEW.credits_consumed, 0) <> 0
         OR COALESCE(NEW.credits_reserved, 0) <> 0
         OR COALESCE(NEW.unlock_cost, 0) <> 0
         OR NEW.trial_results_seen_at IS NOT NULL
      THEN
        RAISE EXCEPTION 'protected_column: 무료 체험/결제 컬럼은 직접 INSERT할 수 없습니다';
      END IF;
    ELSE  -- UPDATE (094 본문 그대로)
      IF NEW.trial_unlocked            IS DISTINCT FROM OLD.trial_unlocked
         OR NEW.trial_public_panel_ids IS DISTINCT FROM OLD.trial_public_panel_ids
         OR NEW.credits_consumed       IS DISTINCT FROM OLD.credits_consumed
         OR NEW.credits_reserved       IS DISTINCT FROM OLD.credits_reserved
         OR NEW.unlock_cost            IS DISTINCT FROM OLD.unlock_cost
         OR NEW.is_free_trial          IS DISTINCT FROM OLD.is_free_trial
         OR NEW.trial_results_seen_at  IS DISTINCT FROM OLD.trial_results_seen_at
      THEN
        RAISE EXCEPTION 'protected_column: 무료 체험 결제 컬럼은 직접 수정할 수 없습니다';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mission_freemium ON missions;
CREATE TRIGGER trg_guard_mission_freemium
  BEFORE INSERT OR UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION guard_mission_freemium_columns();


-- ─── #8) 어드민 RPC NULL 게이트(D-134) → is_caller_admin() 로 교체 ─────────────────
--   본문 로직(반려 피드백 삭제·슬롯 ±1)은 049/053 그대로. 어드민 판별만 NULL 안전 헬퍼로 교체.

CREATE OR REPLACE FUNCTION admin_delete_feedback(p_feedback_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_caller_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM feedbacks WHERE id = p_feedback_id AND status = 'rejected'
  ) THEN
    RAISE EXCEPTION 'feedback not found or not in rejected status';
  END IF;

  DELETE FROM feedback_annotations WHERE feedback_id = p_feedback_id;
  DELETE FROM feedbacks WHERE id = p_feedback_id AND status = 'rejected';
END;
$$;

CREATE OR REPLACE FUNCTION decrement_mission_filled_count(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_caller_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE missions
  SET filled_count = GREATEST(0, COALESCE(filled_count, 0) - 1)
  WHERE id = p_mission_id;
END;
$$;

CREATE OR REPLACE FUNCTION restore_mission_slot(p_mission_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_caller_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE missions
  SET filled_count = LEAST(panel_count, COALESCE(filled_count, 0) + 1)
  WHERE id = p_mission_id;
END;
$$;
