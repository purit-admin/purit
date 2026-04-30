-- panels 테이블에 phone 컬럼 추가
ALTER TABLE panels ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- 기업이 패널 공개 정보만 조회하는 SECURITY DEFINER RPC
-- 반환: panel_id, industry, experience 만 (이름·연락처·계좌 제외)
CREATE OR REPLACE FUNCTION get_panel_public_profiles(p_mission_id UUID)
RETURNS TABLE(panel_id UUID, industry TEXT, experience TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS panel_id,
    p.industry,
    p.experience
  FROM feedbacks f
  JOIN panels p ON p.id = f.panel_id
  WHERE f.mission_id = p_mission_id
    AND f.status != 'draft';
END;
$$;
