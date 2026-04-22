// 커스텀 질문 템플릿 — Wynter의 Pre-made Question Templates를 PURIT 맥락으로 재설계
// 의뢰 등록 시 검증 목적에 맞는 질문 세트를 선택하거나 직접 조합할 수 있는 라이브러리

import { useState } from 'react';
import { Card, Badge, Btn } from '../../components/ui';

const TEMPLATES = [
  {
    id: 't1',
    name: '랜딩페이지 전환 진단',
    icon: '◎',
    category: 'LP',
    desc: '방문자가 구매 버튼을 누르지 않는 이유를 찾는 표준 질문 세트',
    questions: [
      '이 페이지를 처음 봤을 때, 무엇을 파는 곳인지 즉시 이해됐나요?',
      '헤드라인이 당신의 상황/고통점과 얼마나 공명했나요? (1-5점)',
      '스크롤 중 멈추게 만든 요소가 있었나요? 있다면 어느 부분이었나요?',
      '구매 버튼을 누르는 데 망설여진다면, 그 이유는 무엇인가요?',
      '이 제품/서비스가 경쟁사와 어떻게 다른지 이해됐나요?',
    ],
    tags: ['명확성', 'CTA', '차별화', '신뢰'],
    useCount: 34,
  },
  {
    id: 't2',
    name: '가격 페이지 인식 검증',
    icon: '◆',
    category: '가격',
    desc: '가격 구조의 명확성과 지각 가치, 전환 장벽을 집중적으로 파악',
    questions: [
      '가격 플랜들 간 차이를 한눈에 이해할 수 있었나요?',
      '이 가격이 제공하는 가치 대비 합리적이라고 느껴졌나요?',
      '결제를 망설이게 만드는 요소가 있다면 무엇인가요?',
      '경쟁사 대비 이 가격을 선택할 이유가 페이지에서 보였나요?',
    ],
    tags: ['가격 명확성', '지각 가치', '행동 장벽'],
    useCount: 18,
  },
  {
    id: 't3',
    name: '콜드 이메일 회신율 진단',
    icon: '✦',
    category: '이메일',
    desc: '아웃바운드 이메일의 훅·관련성·CTA를 집중 검증',
    questions: [
      '이메일 첫 문장에서 계속 읽고 싶은 호기심이 생겼나요?',
      '이 이메일이 당신 상황에 맞는 내용이라고 느껴졌나요?',
      '답장할 의향이 있다면, 어느 부분이 설득됐나요?',
      '답장하지 않겠다면, 어느 부분에서 흥미를 잃었나요?',
      'CTA("데모 보내드리겠습니다" 등)가 부담 없이 느껴졌나요?',
    ],
    tags: ['훅', '관련성', 'CTA 부담감'],
    useCount: 12,
  },
  {
    id: 't4',
    name: '브랜드 포지셔닝 체크',
    icon: '▲',
    category: '브랜드',
    desc: '타겟이 브랜드를 어떻게 인식하는지, 원하는 포지셔닝과 갭이 있는지 확인',
    questions: [
      '이 브랜드를 한 단어로 표현한다면 어떤 단어가 떠오르나요?',
      '"프리미엄 / 가성비 / 신뢰 / 혁신" 중 이 브랜드와 가장 가까운 이미지는?',
      '이 브랜드가 주로 어떤 고객을 위한 곳이라고 느껴졌나요?',
      '이 브랜드를 지인에게 추천할 의향이 있나요? 그 이유는?',
    ],
    tags: ['포지셔닝', '브랜드 인식', 'NPS'],
    useCount: 9,
  },
  {
    id: 't5',
    name: '광고 소재 전환 검증',
    icon: '●',
    category: '광고',
    desc: '배너·SNS 광고의 클릭 유발력과 랜딩 연결성을 측정',
    questions: [
      '이 광고를 피드에서 봤을 때 스크롤을 멈추고 보게 됐나요?',
      '광고 이미지와 카피가 서로 잘 맞는다고 느껴졌나요?',
      '클릭해보고 싶은 욕구가 생겼나요? 어느 요소 때문이었나요?',
      '광고를 클릭한다면 어떤 페이지가 나올 것 같나요? (기대 일치 확인)',
    ],
    tags: ['클릭 유발력', '이미지-카피 정합성', '기대 일치'],
    useCount: 22,
  },
];

export default function QuestionTemplates() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('전체');

  const CATS = ['전체', 'LP', '가격', '이메일', '브랜드', '광고'];
  const filtered = TEMPLATES.filter(t =>
    (catFilter === '전체' || t.category === catFilter) &&
    (t.name.includes(search) || t.desc.includes(search))
  );

  const sel = TEMPLATES.find(t => t.id === selected);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>QUESTION TEMPLATES</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>질문 템플릿 라이브러리</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>검증 목적에 맞는 질문 세트를 선택하거나 직접 조합해 의뢰에 추가하세요.</p>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="템플릿 검색..." style={{ maxWidth: 260 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
              background: catFilter === c ? 'var(--accent)' : 'var(--surface)',
              color: catFilter === c ? '#0A0A08' : 'var(--text-2)',
              border: '1px solid ' + (catFilter === c ? 'var(--accent)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* Template list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => (
            <Card key={t.id} onClick={() => setSelected(selected === t.id ? null : t.id)}
              style={{ cursor: 'pointer', borderColor: selected === t.id ? 'var(--accent)' : 'var(--border)' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--accent)', flexShrink: 0 }}>
                  {t.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 10 }}>{t.useCount}회 사용</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.6 }}>{t.desc}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge type="gray">{t.category}</Badge>
                    {t.tags.map(tag => <Badge key={tag} type="gray">{tag}</Badge>)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Preview */}
        {sel && (
          <Card style={{ position: 'sticky', top: 24, height: 'fit-content', borderColor: 'var(--accent)', padding: '24px' }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              질문 미리보기
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>{sel.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {sel.questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>Q{i + 1}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{q}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm">의뢰에 추가</Btn>
              <Btn size="sm" variant="secondary">커스터마이즈</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
