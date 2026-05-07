import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  // 삭제 대상: 검토 대기(purity_passed=false AND status='submitted') 제외한 전체
  const { data: targets, error: fetchErr } = await supabase
    .from('feedbacks')
    .select('id')
    .or('purity_passed.eq.true,status.eq.approved,status.eq.rejected,status.eq.draft');

  if (fetchErr) { console.error('조회 실패:', fetchErr.message); process.exit(1); }

  const ids = (targets || []).map(f => f.id);
  console.log(`삭제 대상 피드백: ${ids.length}건`);
  if (ids.length === 0) { console.log('삭제할 항목 없음'); return; }

  // 1) feedback_annotations 삭제
  const { error: annErr } = await supabase
    .from('feedback_annotations')
    .delete()
    .in('feedback_id', ids);
  if (annErr) console.warn('annotations 삭제 경고:', annErr.message);
  else console.log('  ✓ feedback_annotations 삭제 완료');

  // 2) feedback_helpfulness_ratings 삭제
  const { error: ratingErr } = await supabase
    .from('feedback_helpfulness_ratings')
    .delete()
    .in('feedback_id', ids);
  if (ratingErr) console.warn('helpfulness_ratings 삭제 경고:', ratingErr.message);
  else console.log('  ✓ feedback_helpfulness_ratings 삭제 완료');

  // 3) feedbacks 본체 삭제
  const { error: fbErr } = await supabase
    .from('feedbacks')
    .delete()
    .in('id', ids);
  if (fbErr) { console.error('feedbacks 삭제 실패:', fbErr.message); process.exit(1); }
  console.log(`  ✓ feedbacks ${ids.length}건 삭제 완료`);
}

run();
