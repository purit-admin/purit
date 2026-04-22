// 5차원 전환 진단 — Wynter의 Clarity/Relevance/Value/Differentiation/Brand 프레임을
// PURIT 서비스에 맞게 재해석한 전환 진단 페이지

import { useState } from 'react';
import { Card, Badge, ScoreBar, Btn } from '../../components/ui';

const DIMENSIONS = [
  {
    key: 'clarity',
    label: '명확성',
    sublabel: 'Clarity',
    icon: '◎',
    color: 'var(--blue)',
    desc: '메시지를 처음 본 사람이 3초 안에 무엇을 파는지 이해하는가?',
    questions: ['무엇을 파는지 즉시 알 수 있었나요?', '혜택이 명확하게 전달됐나요?', '전문 용어나 모호한 표현이 있었나요?'],
    benchmark: 3.2,
  },
  {
    key: 'relevance',
    label: '관련성',
    sublabel: 'Relevance',
    icon: '◆',
    color: 'var(--green)',
    desc: '타겟 고객의 현실적인 고통과 욕구에 메시지가 정렬되어 있는가?',
    questions: ['내 상황/문제에 공감되는 내용이 있었나요?', '이 제품이 나를 위한 것처럼 느껴졌나요?', '페르소나가 얼마나 정확하게 느껴졌나요?'],
    benchmark: 2.8,
  },
  {
    key: 'value',
    label: '가치',
    sublabel: 'Value',
    icon: '▲',
    color: 'var(--accent)',
    desc: '제품이 제공하는 가치가 가격 대비 충분히 설득력 있는가?',
    questions: ['이 제품/서비스가 충분한 가치를 제공한다고 느꼈나요?', '가격이 합리적으로 느껴졌나요?', '어떤 결과를 기대하게 만드나요?'],
    benchmark: 3.5,
  },
  {
    key: 'differentiation',
    label: '차별화',
    sublabel: 'Differentiation',
    icon: '◈',
    color: '#C084FC',
    desc: '경쟁사 대비 왜 이 제품을 선택해야 하는지 명확히 전달되는가?',
    questions: ['다른 제품과 무엇이 다른지 알 수 있었나요?', '고유한 강점이 설득력 있게 전달됐나요?', '전환 이유가 충분했나요?'],
    benchmark: 2.4,
  },
  {
    key: 'trust',
    label: '신뢰',
    sublabel: 'Trust',
    icon: '●',
    color: 'var(--green)',
    desc: '처음 방문자가 브랜드와 제품을 신뢰할 수 있는 근거가 충분한가?',
    questions: ['이 브랜드를 신뢰할 수 있다고 느꼈나요?', '사회적 증거(후기, 수치)가 충분했나요?', '구매를 망설이게 만드는 요소가 있었나요?'],
    benchmark: 3.0,
  },
];

// Mock scores per dimension
const MOCK_SCORES = {
  clarity: [3, 2, 4, 3, 2],
  relevance: [2, 2, 3, 2, 3],
  value: [4, 3, 4, 3, 4],
  differentiation: [2, 1, 2, 2, 1],
  trust: [3, 2, 3, 3, 2],
};

const avg = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length);

const MOCK_COMMENTS = {
  clarity: [
    '헤드라인만 봐서는 러닝화인지 스포츠웨어인지 알 수 없었습니다.',
    '두 번째 스크롤까지 내려야 제품 이미지가 보임. 첫 화면에서 바로 보여야 함.',
  ],
  relevance: [
    '"새로운 나를 만나다" — 이건 헬스클럽 광고 같은 느낌. 러닝화라는 맥락이 없음.',
    '직장인 러너라는 타겟을 언급하는 카피가 없어서 내 얘기 같지 않았음.',
  ],
  value: [
    '정가 대비 할인가 표기가 명확해서 가성비 납득됨.',
    '반품/AS 정책이 명시되어 있어 신뢰 주지만 가격 앵커링이 조금 더 필요.',
  ],
  differentiation: [
    '왜 이 제품이어야 하는지 근거가 없음. "국내 1위" 같은 구체적 수치 필요.',
    '경쟁 제품 대비 무엇이 다른지 전혀 언급 없음.',
  ],
  trust: [
    '리뷰 수는 많지만 원문이 없어서 진짜인지 의심됨.',
    '구매자 인증 배지나 미디어 노출 실적 추가하면 신뢰 올라갈 것 같음.',
  ],
};

export default function Diagnosis() {
  const [activeTab, setActiveTab] = useState('overview');

  const overallAvg = avg(Object.values(MOCK_SCORES).map(arr => avg(arr)));
  const worstDim = DIMENSIONS.reduce((worst, d) =>
    avg(MOCK_SCORES[d.key]) < avg(MOCK_SCORES[worst.key]) ? d : worst
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>
          5-DIMENSION DIAGNOSIS
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>전환 5차원 진단</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          메시지 전환 실패의 5가지 근본 원인을 정량적으로 분석합니다.
        </p>
      </div>

      {/* Overall score */}
      <Card style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 40, background: 'linear-gradient(135deg, var(--surface), var(--bg-3))' }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>종합 전환 점수</div>
          <div style={{ fontSize: 64, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, color: overallAvg >= 4 ? 'var(--green)' : overallAvg >= 3 ? 'var(--accent)' : 'var(--red)' }}>
            {overallAvg.toFixed(1)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>/ 5.0</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            🔴 가장 취약한 차원: <span style={{ color: worstDim.color }}>{worstDim.label} ({avg(MOCK_SCORES[worstDim.key]).toFixed(1)})</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>
            {worstDim.desc} 이 부분이 전환 병목을 만들고 있을 가능성이 높습니다.
          </p>
          <Btn size="sm" variant="outline">개선 가이드 보기 →</Btn>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['overview', '차원별 점수'], ['comments', '패널 코멘트'], ['benchmark', '업계 벤치마크']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v)} style={{
            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: activeTab === v ? 'var(--bg)' : 'transparent',
            color: activeTab === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DIMENSIONS.map(d => {
            const score = avg(MOCK_SCORES[d.key]);
            const pct = (score / 5) * 100;
            return (
              <Card key={d.key} style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${d.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: d.color, flexShrink: 0 }}>
                    {d.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{d.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{d.sublabel}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: d.color }}>{score.toFixed(1)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: d.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{d.desc}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comments tab */}
      {activeTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {DIMENSIONS.map(d => (
            <div key={d.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 16, color: d.color }}>{d.icon}</span>
                <span style={{ fontWeight: 700 }}>{d.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: d.color }}>{avg(MOCK_SCORES[d.key]).toFixed(1)}/5</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MOCK_COMMENTS[d.key].map((c, i) => (
                  <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, borderLeft: `3px solid ${d.color}` }}>
                    "{c}"
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Benchmark tab */}
      {activeTab === 'benchmark' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.7 }}>
            동일 산업군(패션/커머스) 의뢰 평균값과 비교한 결과입니다.
          </p>
          {DIMENSIONS.map(d => {
            const myScore = avg(MOCK_SCORES[d.key]);
            const bench = d.benchmark;
            const diff = myScore - bench;
            return (
              <Card key={d.key} style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 80, fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                  <div style={{ flex: 1, position: 'relative', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'visible' }}>
                    {/* Benchmark line */}
                    <div style={{ position: 'absolute', left: `${(bench/5)*100}%`, top: -4, width: 2, height: 16, background: 'var(--text-3)', borderRadius: 1 }} />
                    {/* My score bar */}
                    <div style={{ width: `${(myScore/5)*100}%`, height: '100%', background: diff >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                  </div>
                  <div style={{ width: 80, textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{myScore.toFixed(1)}</span>
                    <Badge type={diff >= 0 ? 'green' : 'red'}>{diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            <span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--text-3)', verticalAlign: 'middle', marginRight: 6 }} />
            세로선 = 업계 평균 벤치마크
          </div>
        </div>
      )}
    </div>
  );
}
