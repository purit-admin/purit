import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  // 1) purit.admin@gmail.com의 user_id 확인
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users?.users?.find(u => u.email === 'purit.admin@gmail.com');
  if (!adminUser) { console.error('어드민 계정을 찾을 수 없습니다.'); process.exit(1); }
  console.log('어드민 user_id:', adminUser.id);

  // 2) 해당 user_id의 company_id 확인
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', adminUser.id)
    .single();
  if (!company) { console.error('어드민 companies 레코드를 찾을 수 없습니다.'); process.exit(1); }
  console.log('어드민 company_id:', company.id);

  // 3) 해당 company의 mission_id 목록 확인
  const { data: missions } = await supabase
    .from('missions')
    .select('id, title, type')
    .eq('company_id', company.id);
  console.log(`어드민 의뢰 ${missions?.length}개:`, missions?.map(m => `[${m.type||'main'}] ${m.title}`));

  const keepMissionIds = (missions || []).map(m => m.id);
  if (keepMissionIds.length === 0) { console.log('보존할 의뢰가 없습니다.'); return; }

  // 4) 삭제 대상 피드백 (어드민 의뢰에 속하지 않는 것)
  const { data: allFeedbacks } = await supabase
    .from('feedbacks')
    .select('id, mission_id');
  const deleteIds = (allFeedbacks || [])
    .filter(f => !keepMissionIds.includes(f.mission_id))
    .map(f => f.id);

  console.log(`\n전체 피드백: ${allFeedbacks?.length}건`);
  console.log(`보존할 피드백 (어드민 의뢰): ${allFeedbacks?.length - deleteIds.length}건`);
  console.log(`삭제할 피드백: ${deleteIds.length}건`);

  if (deleteIds.length === 0) { console.log('삭제할 항목 없음'); return; }

  // 5) 관련 데이터 먼저 삭제
  const { error: annErr } = await supabase
    .from('feedback_annotations')
    .delete()
    .in('feedback_id', deleteIds);
  if (annErr) console.warn('  annotations 삭제 경고:', annErr.message);
  else console.log('\n  ✓ feedback_annotations 삭제 완료');

  const { error: ratingErr } = await supabase
    .from('feedback_helpfulness_ratings')
    .delete()
    .in('feedback_id', deleteIds);
  if (ratingErr) console.warn('  helpfulness_ratings 삭제 경고:', ratingErr.message);
  else console.log('  ✓ feedback_helpfulness_ratings 삭제 완료');

  // 6) feedbacks 본체 삭제 (1000건 초과 시 배치 처리)
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += BATCH) {
    const batch = deleteIds.slice(i, i + BATCH);
    const { error } = await supabase.from('feedbacks').delete().in('id', batch);
    if (error) { console.error('feedbacks 삭제 실패:', error.message); process.exit(1); }
    deleted += batch.length;
  }
  console.log(`  ✓ feedbacks ${deleted}건 삭제 완료`);
}

run();
