-- 108_panel_avatar_emoji.sql
-- 기능 추가: 패널 프로필 원형 아바타 개인화
--   기존: 이름 첫 글자 + 네이비 단색 그라데이션 고정 → 동명 첫글자(김민수·김지영) 전부 동일한 원으로 보임.
--   변경:
--     A) 배경색 — panel.id 시드 기반 자동 색이 기본, 패널이 직접 선택도 가능 (avatar_color 컬럼)
--     B) 이모지 아바타 — 패널이 직접 선택한 이모지를 아바타에 표시 (avatar_emoji 컬럼)
--
-- ※ avatar_color: AVATAR_PALETTE 인덱스 문자열('0'~'11'). NULL이면 panel.id 해시 자동색.
-- ※ 이 아바타는 패널 본인 프로필 화면 전용 — 기업에게는 패널이 "패널 #N"(익명)으로만 노출되어 누출 없음.
-- ※ 저장은 기존 panels self-UPDATE RLS(본인 행) 경유 — Profile.jsx의 selected_badge와 동일 패턴.
--    avatar_emoji·avatar_color는 권한 컬럼이 아니므로 self-UPDATE 권한 상승(D-144) 무관.

ALTER TABLE panels
  ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT NULL;
