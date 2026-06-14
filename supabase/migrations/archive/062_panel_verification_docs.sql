-- 062_panel_verification_docs.sql
-- panels 테이블에 검증 자료 URL 컬럼 추가
-- handle_new_user 트리거 함수: 신규 패널 status='pending'으로 변경
-- 신규 pending 패널 INSERT 시 어드민 알림 트리거 추가

-- ① 검증 자료 URL 컬럼 추가 (이미 있으면 무시)
ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS health_insurance_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url         TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url        TEXT;

-- ② handle_new_user 트리거 함수 재정의
--    패널 신규 가입 시 status='pending'으로 생성 (기존 'active' → 'pending')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'panel' THEN
    INSERT INTO public.panels (user_id, name, email, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF NEW.raw_user_meta_data->>'role' = 'company' THEN
    INSERT INTO public.companies (user_id, name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 기존 트리거가 없으면 생성 (이미 있으면 함수 교체만으로 충분)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- ③ 신규 pending 패널 어드민 알림 함수
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_panel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_panel_name TEXT;
BEGIN
  -- status='pending' INSERT에만 발화
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  v_panel_name := COALESCE(NEW.name, '(이름 없음)');

  -- 어드민 user_id 조회 (app_metadata 기준 — D-58 준수)
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
    '👤',
    '새 패널 심사 대기',
    v_panel_name || '님이 패널로 가입했습니다. 검증 서류를 확인하고 승인해 주세요.',
    '/admin/panels',
    'admin',
    false
  );

  RETURN NEW;
END;
$$;

-- ④ 트리거 등록 (멱등성 보장)
DROP TRIGGER IF EXISTS on_panel_pending_created ON public.panels;
CREATE TRIGGER on_panel_pending_created
  AFTER INSERT ON public.panels
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_new_panel();
