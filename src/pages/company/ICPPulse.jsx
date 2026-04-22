// ICP Pulse — Wynter의 Always-on ICP Research를 PURIT 서비스에 맞게 재설계
// 분기마다 자동으로 타겟 고객 인사이트를 수집하고 변화 추이를 제공하는 구독 서비스

import { useState } from 'react';
import { Card, Badge, Btn, Stat } from '../../components/ui';

const QUARTERS = ['2025 Q1', '2025 Q2', '2025 Q3 (최신)'];

const PULSE_DATA = {
  'Q1': {
    topPains: [
      { pain: '광고 소재 효과 예측 불가', freq: 71 },
      { pain: '타겟 고객 언어를 모름', freq: 58 },
      { pain: 'A/B 테스트 시간·비용 과다', freq: 52 },
    ],
    desiredGains: [
      { gain: '광고 집행 전 리스크 사전 제거', freq: 84 },
      { gain: '타겟 고객의 실제 언어 파악', freq: 70 },
    ],
    buyingTrigger: '경쟁사 광고비 낭비 사례 공유',
    topChannel: '마케터 커뮤니티 (오픈카톡, 링크드인)',
  },
  'Q2': {
    topPains: [
      { pain: '광고 소재 효과 예측 불가', freq: 68 },
      { pain: '랜딩페이지 이탈률 원인 불명', freq: 74 },
      { pain: '전환율 개선 방법론 부재', freq: 61 },
    ],
    desiredGains: [
      { gain: '광고 집행 전 리스크 사전 제거', freq: 80 },
      { gain: '전환율 개선 ROI 측정 지표', freq: 68 },
    ],
    buyingTrigger: '랜딩페이지 전환율 벤치마크 데이터',
    topChannel: '성과 마케터 커뮤니티, 퍼포먼스 뉴스레터',
  },
  'Q3': {
    topPains: [
      { pain: '랜딩페이지 이탈률 원인 불명', freq: 79 },
      { pain: 'AI 생성 소재 품질 의심', freq: 65 },
      { pain: '전환율 개선 방법론 부재', freq: 63 },
    ],
    desiredGains: [
      { gain: '광고 집행 전 리스크 사전 제거', freq: 82 },
      { gain: 'AI 소재 품질 검증 체계', freq: 71 },
    ],
    buyingTrigger: '"AI 카피 썼다가 전환율 반토막" 실패 사례',
    topChannel: 'B2B 마케터 슬랙, 링크드인 광고',
  },
};

const SHIFTS = [
  { signal: 'AI 생성 소재 불신 급증', qFrom: 'Q2', qTo: 'Q3', change: '+24%p', direction: 'up', insight: 'AI 소재 남발 피로감이 타겟층에 형성됨. "사람이 검증한" 메시지가 차별화 포인트가 될 수 있음.' },
  { signal: '랜딩페이지 이탈 고통점', qFrom: 'Q1', qTo: 'Q3', change: '+8%p', direction: 'up', insight: 'LP 전환 실패에 대한 문제 의식이 꾸준히 상승. 시장 교육 없이도 니즈가 성숙 중.' },
  { signal: '"타겟 언어 파악" 니즈', qFrom: 'Q1', qTo: 'Q3', change: '-10%p', direction: 'down', insight: 'ICP 언어 파악 니즈가 감소 — 이미 많은 도구가 등장했기 때문. 차별화 포인트 재정비 필요.' },
];

export default function ICPPulse() {
  const [activeQ, setActiveQ] = useState('Q3');
  const data = PULSE_DATA[activeQ];

  return (
    <div style={{ padding: '40px 48px', maxWidth: 980, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em' }}>ICP PULSE</div>
          <Badge type="green">상시 구독</Badge>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>분기별 ICP 인텔리전스</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          타겟 고객의 고통점·구매 트리거·채널 선호가 분기마다 어떻게 변하는지 자동으로 추적합니다.<br />
          경쟁사보다 먼저 시장 변화를 감지하세요.
        </p>
      </div>

      {/* Quarter selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {QUARTERS.map((q, i) => {
          const key = ['Q1', 'Q2', 'Q3'][i];
          return (
            <button key={key} onClick={() => setActiveQ(key)} style={{
              padding: '8px 20px', borderRadius: 'var(--radius)',
              background: activeQ === key ? 'var(--accent)' : 'var(--surface)',
              color: activeQ === key ? '#0A0A08' : 'var(--text-2)',
              border: '1px solid ' + (activeQ === key ? 'var(--accent)' : 'var(--border)'),
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {q}{key === 'Q3' && <span style={{ fontSize: 10, marginLeft: 6 }}>✦ 최신</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Top pains */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>상위 고통점</div>
          {data.topPains.map((p, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-2)' }}>{p.pain}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: p.freq >= 70 ? 'var(--red)' : 'var(--accent)' }}>{p.freq}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${p.freq}%`, height: '100%', background: p.freq >= 70 ? 'var(--red)' : 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </Card>

        {/* Desired gains + trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>원하는 성과</div>
            {data.desiredGains.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ color: 'var(--green)', fontSize: 10, flexShrink: 0 }}>◆</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{g.gain}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{g.freq}%</span>
              </div>
            ))}
          </Card>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>핵심 구매 트리거</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', lineHeight: 1.6 }}>"{data.buyingTrigger}"</div>
          </Card>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>최우선 도달 채널</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', lineHeight: 1.6 }}>{data.topChannel}</div>
          </Card>
        </div>
      </div>

      {/* Quarter-over-quarter shifts */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)' }}>분기 간 유의미한 변화 감지</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SHIFTS.map((s, i) => (
          <Card key={i} style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14,
                background: s.direction === 'up' ? 'var(--red-dim)' : 'var(--blue-dim)',
                color: s.direction === 'up' ? 'var(--red)' : 'var(--blue)',
              }}>
                {s.direction === 'up' ? '↑' : '↓'} {s.change}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.signal}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>{s.qFrom} → {s.qTo}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)' }}>
                  {s.insight}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Subscribe CTA */}
      <Card style={{ marginTop: 28, background: 'var(--accent-dim2)', borderColor: 'rgba(232,213,163,0.2)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>ICP Pulse 구독 중</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>다음 분기 인사이트 자동 발송: 2025년 10월 1일 · 패널 30명</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm" variant="secondary">구독 관리</Btn>
          <Btn size="sm">전체 리포트 PDF</Btn>
        </div>
      </Card>
    </div>
  );
}
