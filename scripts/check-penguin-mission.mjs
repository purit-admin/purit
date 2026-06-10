// check-penguin-mission.mjs — 읽기 전용: 미스터펭귄 의뢰 조회
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
const COMPANY_ID = '44c822c3-681f-4fcf-82ac-09d460fb905b';
const { data, error } = await supabase.from('missions')
  .select('id,title,type,status,panel_count,filled_count,is_free_trial,trial_unlocked,unlock_cost,image_urls,description,created_at')
  .eq('company_id', COMPANY_ID).order('created_at', { ascending: false });
if (error) { console.log('ERROR:', error.message); process.exit(1); }
for (const m of data) {
  console.log('────────────────────────────');
  console.log('id:', m.id);
  console.log('title:', m.title, '| type:', m.type, '| status:', m.status);
  console.log('is_free_trial:', m.is_free_trial, '| trial_unlocked:', m.trial_unlocked, '| unlock_cost:', m.unlock_cost);
  console.log('slots:', m.filled_count + '/' + m.panel_count, '| images:', (m.image_urls || []).length);
  console.log('created_at:', m.created_at);
  let desc; try { desc = JSON.parse(m.description || '{}'); } catch { desc = '(plain text)'; }
  if (typeof desc === 'object') {
    console.log('selectedQuestions:', (desc.selectedQuestions || []).length, 'items');
    console.log('keys:', Object.keys(desc).join(', '));
  } else console.log('description: plain text len', (m.description || '').length);
}
