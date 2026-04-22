// 선호도 테스트 — Wynter의 Preference Test를 PURIT 서비스에 맞게 변형
// 두 가지 카피/소재를 비교해 어느 쪽이 더 전환에 기여하는지 측정

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, Badge } from '../../components/ui';

const ASSET_TYPES = [
  { key: 'headline', label: '헤드라인 카피', icon: '◎', desc: '두 가지 헤드라인 중 어느 쪽이 더 구매 욕구를 자극하는가' },
  { key: 'cta', label: 'CTA 문구', icon: '▲', desc: '클릭을 유도하는 버튼 텍스트 비교' },
  { key: 'value_prop', label: '가치 제안', icon: '◆', desc: '핵심 혜택 전달 방식 비교' },
  { key: 'lp_section', label: 'LP 섹션', icon: '◈', desc: '랜딩페이지 특정 섹션의 두 가지 버전 비교' },
  { key: 'ad_copy', label: '광고 카피', icon: '●', desc: '광고 텍스트 또는 이미지+카피 세트 비교' },
  { key: 'email', label: '이메일 제목', icon: '✦', desc: '오픈율을 높이기 위한 이메일 제목 비교' },
];

const MOCK_RESULTS = {
  aPercent: 62,
  bPercent: 38,
  aComments: [
    '숫자가 들어가니까 신뢰가 바로 생겼어요. 막연한 주장보다 훨씬 설득력 있음.',
    '"3km 더 빠르게"라는 표현이 내가 원하는 결과를 정확히 건드림.',
    '간결하고 임팩트 있어서 스크롤을 멈추게 만드는 카피.',
  ],
  bComments: [
    '감성적이긴 한데 러닝화 구매와 직접 연결이 안 됨.',
    '"새로운 나"라는 표현은 너무 많이 써서 식상함.',
  ],
};

export default function PreferenceTest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=setup, 1=results
  const [type, setType] = useState('headline');
  const [varA, setVarA] = useState('매주 3km 더 빠르게. 검증된 카본 플레이트 기술.');
  const [varB, setVarB] = useState('새로운 나를 만나다. 러닝의 시작.');
  const [panels, setPanels] = useState(15);

  if (step === 1) return <PreferenceResults varA={varA} varB={varB} onBack={() => setStep(0)} />;

  const selectedType = ASSET_TYPES.find(t => t.key === type);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 800, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PREFERENCE TEST</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>소재 비교 테스트</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>두 가지 카피/소재 중 어느 쪽이 실제 전환에 더 기여하는지 패널에게 직접 검증받습니다.</p>
      </div>

      {/* Asset type selector */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>검증 소재 유형</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ASSET_TYPES.map(t => (
            <button key={t.key} onClick={() => setType(t.key)} style={{
              padding: '14px', borderRadius: 'var(--radius)', textAlign: 'left',
              background: type === t.key ? 'var(--accent-dim)' : 'var(--surface)',
              border: '1px solid ' + (type === t.key ? 'var(--accent)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: type === t.key ? 'var(--accent)' : 'var(--text)' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Variant input */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'A안', value: varA, set: setVarA, color: 'var(--blue)' },
          { label: 'B안', value: varB, set: setVarB, color: '#C084FC' },
        ].map(({ label, value, set, color }) => (
          <Card key={label} style={{ padding: '20px', borderColor: color + '44' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
                {label}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedType?.label} {label}</span>
            </div>
            <textarea
              value={value}
              onChange={e => set(e.target.value)}
              rows={4}
              style={{ resize: 'vertical', fontSize: 14, lineHeight: 1.6 }}
            />
          </Card>
        ))}
      </div>

      {/* Panel count */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>패널 규모</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[10, 15, 20, 30].map(n => (
            <button key={n} onClick={() => setPanels(n)} style={{
              flex: 1, padding: '10px', borderRadius: 'var(--radius)',
              background: panels === n ? 'var(--accent)' : 'var(--surface-2)',
              color: panels === n ? '#0A0A08' : 'var(--text-2)',
              border: '1px solid ' + (panels === n ? 'var(--accent)' : 'var(--border)'),
              fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {n}명
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-3)' }}>
          * 정성 연구 기준 최소 12명 이상에서 유의미한 인사이트 포화(Saturation)에 도달합니다.
        </div>
      </div>

      <Btn size="lg" onClick={() => setStep(1)}>테스트 시작 →</Btn>
    </div>
  );
}

function PreferenceResults({ varA, varB, onBack }) {
  const { aPercent, bPercent, aComments, bComments } = MOCK_RESULTS;
  const winner = aPercent > bPercent ? 'A' : 'B';

  return (
    <div style={{ padding: '40px 48px', maxWidth: 860, animation: 'fadeUp 0.5s ease both' }}>
      <button onClick={onBack} style={{ background: 'none', color: 'var(--text-3)', fontSize: 13, marginBottom: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← 설정으로
      </button>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>RESULTS</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>비교 테스트 결과</h1>
      </div>

      {/* Winner banner */}
      <Card style={{ marginBottom: 28, background: 'var(--green-dim)', borderColor: 'rgba(126,200,160,0.3)', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Winner</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{winner}안 — {winner === 'A' ? aPercent : bPercent}% 선호</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
              {winner === 'A' ? varA : varB}
            </div>
          </div>
        </div>
      </Card>

      {/* Bar comparison */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600 }}>선호도 분포</div>
        <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', height: 40, marginBottom: 12 }}>
          <div style={{ width: `${aPercent}%`, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', transition: 'width 0.8s ease' }}>
            A {aPercent}%
          </div>
          <div style={{ width: `${bPercent}%`, background: '#C084FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            B {bPercent}%
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--blue)', fontFamily: 'var(--font-mono)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>A안 선택 이유</div>
            {aComments.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', marginBottom: 6, borderLeft: '2px solid var(--blue)', lineHeight: 1.6 }}>
                {c}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#C084FC', fontFamily: 'var(--font-mono)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>B안 선택 이유</div>
            {bComments.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', marginBottom: 6, borderLeft: '2px solid #C084FC', lineHeight: 1.6 }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Btn variant="secondary" onClick={onBack}>새 테스트 설정</Btn>
    </div>
  );
}
