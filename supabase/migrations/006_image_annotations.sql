-- missions 테이블에 이미지 URL 배열 컬럼 추가
ALTER TABLE missions ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 이미지 영역 어노테이션 테이블
CREATE TABLE IF NOT EXISTS feedback_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  mission_id  UUID NOT NULL REFERENCES missions(id)  ON DELETE CASCADE,
  panel_id    UUID NOT NULL REFERENCES panels(id)    ON DELETE CASCADE,
  image_index INT  NOT NULL DEFAULT 0,
  x_pct NUMERIC(6,2) NOT NULL,
  y_pct NUMERIC(6,2) NOT NULL,
  w_pct NUMERIC(6,2) NOT NULL,
  h_pct NUMERIC(6,2) NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('clarity','relevance','value','differentiation','trust')),
  score     INT  NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fa_feedback_idx ON feedback_annotations(feedback_id);
CREATE INDEX IF NOT EXISTS fa_mission_idx  ON feedback_annotations(mission_id);
CREATE INDEX IF NOT EXISTS fa_panel_idx    ON feedback_annotations(panel_id);

ALTER TABLE feedback_annotations ENABLE ROW LEVEL SECURITY;

-- 패널: 본인 어노테이션 전체 CRUD
CREATE POLICY "panel_own_annotations" ON feedback_annotations
  FOR ALL
  USING (panel_id IN (SELECT id FROM panels WHERE user_id = auth.uid()));

-- 기업: 자사 미션 어노테이션 조회만
CREATE POLICY "company_read_annotations" ON feedback_annotations
  FOR SELECT
  USING (
    mission_id IN (
      SELECT m.id FROM missions m
      JOIN companies c ON c.id = m.company_id
      WHERE c.user_id = auth.uid()
    )
  );

-- 어드민: 전체 조회
CREATE POLICY "admin_read_annotations" ON feedback_annotations
  FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Storage 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-assets', 'mission-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 전체 공개 읽기
CREATE POLICY "public_read_mission_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'mission-assets');

-- Storage RLS: 인증 유저 업로드 허용
CREATE POLICY "auth_upload_mission_assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mission-assets' AND auth.role() = 'authenticated');
