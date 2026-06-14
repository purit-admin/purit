-- 패널명 / 기업명 중복 체크 RPC
-- RLS 때문에 클라이언트에서 타인 rows 직접 조회 불가 → SECURITY DEFINER로 우회

CREATE OR REPLACE FUNCTION check_panel_name_taken(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM panels
    WHERE LOWER(name) = LOWER(p_name)
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  );
$$;

CREATE OR REPLACE FUNCTION check_company_name_taken(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies
    WHERE LOWER(name) = LOWER(p_name)
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  );
$$;
