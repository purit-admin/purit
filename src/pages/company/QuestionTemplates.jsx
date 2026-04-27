import { useState, useEffect } from 'react';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const CATEGORY_COLORS = { LP: 'blue', 가격: 'gold', 이메일: 'green', 브랜드: 'gray', 광고: 'red' };

export default function QuestionTemplates() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();

    const baseQuery = supabase
      .from('question_templates')
      .select('*, template_questions(id, question_text, question_order)')
      .order('use_count', { ascending: false });

    const { data, error } = await (co
      ? baseQuery.or(`is_default.eq.true,company_id.eq.${co.id}`)
      : baseQuery.eq('is_default', true));
    if (error) console.error('[QuestionTemplates] 쿼리 오류:', error.message);
    if (data) setTemplates(data.map(t => ({
      ...t,
      template_questions: [...(t.template_questions || [])].sort((a, b) => a.question_order - b.question_order),
    })));
    setLoading(false);
  }

  async function handleUse(id) {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    await supabase.from('question_templates').update({ use_count: (t.use_count || 0) + 1 }).eq('id', id);
    setTemplates(ts => ts.map(x => x.id === id ? { ...x, use_count: (x.use_count || 0) + 1 } : x));
  }

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>데이터 로딩 중…</div>
  );

  const selectedTemplate = templates.find(t => t.id === selected);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>QUESTION TEMPLATES</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>질문 템플릿</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>의뢰 목적에 맞는 검증된 질문 세트를 선택해 빠르게 미션을 구성하세요.</p>
      </div>

      {templates.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>질문 템플릿이 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>관리자가 기본 템플릿을 추가하면 여기에 표시됩니다.</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, alignContent: 'start' }}>
            {templates.map(t => (
              <Card
                key={t.id}
                style={{ cursor: 'pointer', transition: 'all 0.15s', borderColor: selected === t.id ? 'var(--accent)' : undefined }}
                onClick={() => setSelected(selected === t.id ? null : t.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 'var(--radius)', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--accent)' }}>
                      {t.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                      <Badge type={CATEGORY_COLORS[t.category] || 'gray'} style={{ marginTop: 4 }}>{t.category}</Badge>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>{t.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {t.template_questions?.length || 0}개 문항 · {t.use_count || 0}회 사용
                  </span>
                  <Btn size="sm" onClick={(e) => { e.stopPropagation(); handleUse(t.id); }}>사용</Btn>
                </div>
              </Card>
            ))}
          </div>

          {selectedTemplate && (
            <div style={{ position: 'sticky', top: 24 }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedTemplate.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{selectedTemplate.template_questions?.length || 0}개 문항</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(selectedTemplate.template_questions || []).map((q, i) => (
                    <div key={q.id} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>Q{i + 1}</span>
                      <span style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{q.question_text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16 }}>
                  <Btn style={{ width: '100%' }} onClick={() => handleUse(selectedTemplate.id)}>이 템플릿으로 의뢰하기</Btn>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
