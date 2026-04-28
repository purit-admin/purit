import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const TABS = [
  { key: 'preference', label: '소재 비교 A/B', category: '광고소재', badge: 'blue',  icon: '🎨', path: '/company/preference',    desc: '두 소재 중 어떤 것이 더 전환율 높은지 실 패널로 검증' },
  { key: 'pricing',    label: '가격 페이지',    category: '가격',    badge: 'gold',  icon: '💰', path: '/company/pricing-test',  desc: '가격 구성·플랜 명확성·WTP를 정밀 측정' },
  { key: 'email',      label: '이메일 검증',    category: '이메일',  badge: 'green', icon: '📬', path: '/company/email-test',    desc: '제목줄·개봉 의향·CTA 효과를 패널 피드백으로 진단' },
];

const BADGE_COLORS = { 광고소재: 'blue', 가격: 'gold', 이메일: 'green', LP검증: 'blue', LP: 'blue' };

export default function QuestionTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('preference');
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(null); }, [activeTab]);

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

    if (error) console.error('[QuestionTemplates]', error.message);
    if (data) setTemplates(data.map(t => ({
      ...t,
      template_questions: [...(t.template_questions || [])].sort((a, b) => a.question_order - b.question_order),
    })));
    setLoading(false);
  }

  async function handleUse(template) {
    const tab = TABS.find(t => t.key === activeTab);
    await supabase.from('question_templates')
      .update({ use_count: (template.use_count || 0) + 1 })
      .eq('id', template.id);
    navigate(tab.path, { state: { templateId: template.id, templateName: template.name } });
  }

  const currentTab = TABS.find(t => t.key === activeTab);
  const filtered = templates.filter(t => t.category === currentTab?.category);
  const selectedTemplate = templates.find(t => t.id === selected);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>QUESTION TEMPLATES</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>질문 템플릿</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>서브 의뢰 유형에 맞는 검증된 질문 세트를 선택하고, 바로 의뢰를 등록하세요.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 18px',
              fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-3)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <div style={{
        background: 'var(--accent-dim)', borderRadius: 'var(--radius)',
        padding: '12px 16px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{currentTab?.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{currentTab?.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{currentTab?.desc}</div>
          </div>
        </div>
        <Btn size="sm" variant="secondary" onClick={() => navigate(currentTab?.path)}>
          바로 의뢰 등록 →
        </Btn>
      </div>

      {loading ? (
        <div style={{ padding: '40px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>로딩 중…</div>
      ) : filtered.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{currentTab?.icon}</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>이 유형의 템플릿이 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>관리자가 기본 템플릿을 추가하면 여기에 표시됩니다.</div>
          <Btn onClick={() => navigate(currentTab?.path)}>바로 의뢰 등록하기</Btn>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
          {/* 템플릿 카드 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, alignContent: 'start' }}>
            {filtered.map(t => (
              <Card
                key={t.id}
                style={{ cursor: 'pointer', transition: 'all 0.15s', borderColor: selected === t.id ? 'var(--accent)' : undefined }}
                onClick={() => setSelected(selected === t.id ? null : t.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 'var(--radius)',
                      background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, color: 'var(--accent)',
                    }}>
                      {t.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                      <Badge type={BADGE_COLORS[t.category] || 'gray'} style={{ marginTop: 4 }}>{t.category}</Badge>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>{t.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {t.template_questions?.length || 0}개 문항 · {t.use_count || 0}회 사용
                  </span>
                  <Btn size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSelected(t.id); }}>
                    미리보기
                  </Btn>
                </div>
              </Card>
            ))}
          </div>

          {/* 우측 사이드 패널 */}
          {selectedTemplate && (
            <div style={{ position: 'sticky', top: 24 }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedTemplate.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {selectedTemplate.template_questions?.length || 0}개 문항
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18 }}
                  >✕</button>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
                  {selectedTemplate.description}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {(selectedTemplate.template_questions || []).map((q, i) => (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex', gap: 12, padding: '10px 12px',
                        background: 'var(--bg-3)', borderRadius: 'var(--radius)', fontSize: 13,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
                        Q{i + 1}
                      </span>
                      <span style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{q.question_text}</span>
                    </div>
                  ))}
                </div>

                <Btn style={{ width: '100%' }} onClick={() => handleUse(selectedTemplate)}>
                  이 템플릿으로 의뢰하기 →
                </Btn>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
