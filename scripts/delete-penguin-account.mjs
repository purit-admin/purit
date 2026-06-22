// delete-penguin-account.mjs
// "미스터 펭귄" 테스트 계정 삭제 + 무엇이 삭제를 막았는지 진단 보고
// service role 키 사용(RLS 우회). 안전장치: 이름에 '펭귄' 포함 계정만 대상.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEEDLE = '펭귄';

async function main() {
  // 1) 펭귄 계정 식별 (panels / companies 양쪽)
  const { data: panels } = await supabase.from('panels')
    .select('id,user_id,name,email,status').ilike('name', `%${NEEDLE}%`);
  const { data: companies } = await supabase.from('companies')
    .select('id,user_id,name,email,plan').ilike('name', `%${NEEDLE}%`);

  console.log('=== 식별된 계정 ===');
  console.log('panels   :', panels);
  console.log('companies:', companies);

  const targets = [
    ...(panels || []).map(p => ({ kind: 'panel', ...p })),
    ...(companies || []).map(c => ({ kind: 'company', ...c })),
  ];
  if (targets.length === 0) { console.log('❌ 펭귄 계정을 찾지 못함'); return; }

  for (const t of targets) {
    if (!t.user_id) { console.log(`\n⚠️ ${t.name}: user_id 없음(고아 레코드) → 부모행만 삭제`);
      await supabase.from(t.kind === 'panel' ? 'panels' : 'companies').delete().eq('id', t.id);
      continue;
    }
    console.log(`\n================ 처리: ${t.name} (${t.kind}, user_id=${t.user_id}) ================`);

    // 2) 1차 삭제 시도 → 실제 에러 메시지 캡처(진단)
    let { error: e1 } = await supabase.auth.admin.deleteUser(t.user_id);
    if (!e1) { console.log('✅ 즉시 삭제 성공 (cascade 정상 — 087 적용됨)'); continue; }
    console.log('🔴 1차 삭제 실패 — 원본 에러:', JSON.stringify(e1, null, 2));

    // 3) 막은 자식행 진단 + 수동 정리
    const blockers = [];
    const countDel = async (table, col, val) => {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, val);
      if (count) blockers.push(`${table}.${col} = ${count}건`);
      if (count) await supabase.from(table).delete().eq(col, val);
      return count || 0;
    };

    if (t.kind === 'company') {
      // 의뢰 ID 수집 → 의뢰 자식 먼저
      const { data: ms } = await supabase.from('missions').select('id').eq('company_id', t.id);
      const missionIds = (ms || []).map(m => m.id);
      for (const mid of missionIds) {
        await countDel('feedback_annotations', 'mission_id', mid);
        await countDel('feedbacks', 'mission_id', mid);
        await countDel('email_responses', 'mission_id', mid);
        await countDel('preference_responses', 'mission_id', mid);
        await countDel('pricing_responses', 'mission_id', mid);
        await countDel('ai_reports', 'mission_id', mid);
        await countDel('cold_email_tests', 'mission_id', mid);
        await countDel('preference_tests', 'mission_id', mid);
        await countDel('pricing_tests', 'mission_id', mid);
      }
      // 회사 직속 자식
      for (const tbl of ['invoices','question_templates','ai_reports','preference_tests',
        'pricing_tests','cold_email_tests','icp_research','icp_pulse_subscriptions','brand_tracking_campaigns']) {
        await countDel(tbl, 'company_id', t.id);
      }
      await countDel('missions', 'company_id', t.id);
      await countDel('team_members', 'company_id', t.id);
      await supabase.from('companies').delete().eq('id', t.id);
    } else {
      // 패널 자식
      const { data: fbs } = await supabase.from('feedbacks').select('id').eq('panel_id', t.id);
      for (const fb of (fbs || [])) await countDel('feedback_annotations', 'feedback_id', fb.id);
      for (const tbl of ['feedbacks','settlements','email_responses','preference_responses','pricing_responses']) {
        await countDel(tbl, 'panel_id', t.id);
      }
      await supabase.from('panels').delete().eq('id', t.id);
    }
    await countDel('team_members', 'user_id', t.user_id);

    console.log('🧹 정리한 자식행:', blockers.length ? blockers.join(', ') : '(없음)');

    // 4) 재시도
    const { error: e2 } = await supabase.auth.admin.deleteUser(t.user_id);
    if (e2) console.log('❌ 2차 삭제도 실패:', JSON.stringify(e2, null, 2));
    else console.log('✅ 수동 정리 후 삭제 성공');
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
