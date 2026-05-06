import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAll() {
  const steps = [
    { table: 'feedback_annotations',  label: 'feedback_annotations' },
    { table: 'preference_responses',  label: 'preference_responses' },
    { table: 'pricing_responses',     label: 'pricing_responses' },
    { table: 'email_responses',       label: 'email_responses' },
    { table: 'feedback_helpfulness_ratings', label: 'feedback_helpfulness_ratings' },
    { table: 'feedbacks',             label: 'feedbacks' },
    { table: 'mission_credits',       label: 'mission_credits' },
    { table: 'preference_tests',      label: 'preference_tests' },
    { table: 'pricing_tests',         label: 'pricing_tests' },
    { table: 'cold_email_tests',      label: 'cold_email_tests' },
    { table: 'missions',              label: 'missions' },
  ];

  for (const { table, label } of steps) {
    const { error, count } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      // 테이블이 없거나 컬럼이 다를 수 있음 — 다른 pk 컬럼 시도
      const { error: e2 } = await supabase.from(table).delete().gte('created_at', '2000-01-01');
      if (e2) {
        console.log(`⚠️  ${label}: 스킵 (${e2.message})`);
      } else {
        console.log(`✅  ${label}: 삭제 완료`);
      }
    } else {
      console.log(`✅  ${label}: 삭제 완료`);
    }
  }

  // panels.honor_points, total_missions 초기화
  const { error: pe } = await supabase.from('panels').update({ honor_points: 0, total_missions: 0 }).gte('created_at', '2000-01-01');
  console.log(pe ? `⚠️  panels 초기화 실패: ${pe.message}` : '✅  panels.honor_points & total_missions 초기화');

  // missions.filled_count 초기화 (missions 이미 삭제됐으므로 불필요하지만 안전장치)
  console.log('\n🎉 전체 삭제 완료');
}

deleteAll().catch(console.error);
