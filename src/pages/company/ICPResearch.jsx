// ICP 리서치 — Wynter의 ICP Discovery Survey를 변형
// 광고 집행 전, 타겟 고객의 언어·고통점·구매 트리거를 먼저 파악하는 리서치

import { useState } from 'react';
import { Card, Badge, Btn } from '../../components/ui';

const PAIN_POINTS = [
  { label: '퇴근 후 러닝할 시간이 절대적으로 부족함', percent: 78, selected: true },
  { label: '기존 러닝화가 무거워서 장거리에 부담', percent: 71, selected: true },
  { label: '러닝화 구매 기준을 모르겠음', percent: 54, selected: false },
  { label: '비싼 제품이 정말 효과 있는지 불확실', percent: 62, selected: true },
  { label: '매장 방문 없이 온라인 구매가 불안함', percent: 43, selected: false },
];

const BUY_TRIGGERS = [
  { trigger: '지인 추천 / SNS 후기', percent: 82 },
  { trigger: '실제 페이스/거리 개선 수치', percent: 74 },
  { trigger: '무료 반품 보장', percent: 68 },
  { trigger: '한정 할인 / 시즌 세일', percent: 55 },
  { trigger: '유명 러너/인플루언서 착용', percent: 41 },
];

const LANGUAGE = [
  { phrase: '발이 편해야 오래 뛴다', frequency: 'high' },
  { phrase: '쿠셔닝이 무릎을 보호한다', frequency: 'high' },
  { phrase: '카본 플레이트 = 페이스 개선', frequency: 'mid' },
  { phrase: '미드솔 소재 EVA vs PEBA', frequency: 'low' },
  { phrase: '저중량 200g 이하', frequency: 'mid' },
  { phrase: '숨 막히는 아스팔트에서 유일한 해방감', frequency: 'high' },
];

const freqColor = { high: 'var(--green)', mid: 'var(--accent)', low: 'var(--text-3)' };
const freqBg = { high: 'var(--green-dim)', mid: 'var(--accent-dim)', low: 'rgba(255,255,255,0.03)' };

export default function ICPResearch() {
  const [tab, setTab] = useState('pain');

  return (
    <div style={{ padding: '40px 48px', maxWidth: 920, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>ICP RESEARCH</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>타겟 고객 인텔리전스</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          광고 집행 전, 타겟 고객이 실제로 쓰는 언어·고통점·구매 트리거를 먼저 파악하세요.
          카피에 그들의 언어를 그대로 담으면 전환율이 올라갑니다.
        </p>
      </div>

      {/* Persona summary */}
      <Card style={{ marginBottom: 24, padding: '20px 24px', display: 'flex', gap: 24, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          🏃
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>직장인 러너 (35-45세, 남/녀)</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            월 소득 500만 원 이상 · 주 2-3회 러닝 · 러닝화 구매 경험 2회 이상 · 성과 개선에 투자 의향 있음
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Badge type="gold">리서치 완료</Badge>
        </div>
      </Card>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['pain', '고통점'], ['trigger', '구매 트리거'], ['language', '고객 언어']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: tab === v ? 'var(--bg)' : 'transparent',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Pain points */}
      {tab === 'pain' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
            패널 20명이 응답한 상위 고통점입니다. 이 언어를 LP 헤드라인/서브카피에 직접 반영하세요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PAIN_POINTS.map(p => (
              <div key={p.label} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 18px', background: p.selected ? 'var(--accent-dim2)' : 'var(--surface)',
                borderRadius: 'var(--radius)', border: '1px solid ' + (p.selected ? 'rgba(232,213,163,0.2)' : 'var(--border)'),
              }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: p.selected ? 600 : 400, color: p.selected ? 'var(--text)' : 'var(--text-2)' }}>
                  {p.selected && <span style={{ color: 'var(--accent)', marginRight: 8 }}>◆</span>}
                  {p.label}
                </div>
                <div style={{ width: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${p.percent}%`, height: '100%', background: p.percent >= 70 ? 'var(--green)' : 'var(--accent)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', width: 32, textAlign: 'right' }}>{p.percent}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>◆ 표시 = 현재 LP에서 활용 중인 고통점</div>
        </div>
      )}

      {/* Buy triggers */}
      {tab === 'trigger' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
            타겟 고객이 구매 결정을 내리는 핵심 트리거입니다. 이 순서대로 LP 섹션을 배치하면 전환율이 올라갑니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BUY_TRIGGERS.map((t, i) => (
              <div key={t.trigger} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 18px', background: 'var(--surface)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', width: 20, textAlign: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.trigger}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 100, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${t.percent}%`, height: '100%', background: i < 2 ? 'var(--accent)' : 'var(--blue)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', width: 36, textAlign: 'right' }}>{t.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer language */}
      {tab === 'language' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
            패널이 실제로 사용한 표현 빈도입니다. <strong style={{ color: 'var(--text)' }}>High 빈도 언어를 LP 카피에 그대로 사용하세요.</strong> 자사 언어보다 고객 언어가 항상 전환율이 높습니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {LANGUAGE.map(l => (
              <div key={l.phrase} style={{
                padding: '10px 16px', borderRadius: 'var(--radius)',
                background: freqBg[l.frequency],
                border: `1px solid ${freqColor[l.frequency]}44`,
                fontSize: l.frequency === 'high' ? 15 : l.frequency === 'mid' ? 13 : 12,
                fontWeight: l.frequency === 'high' ? 700 : l.frequency === 'mid' ? 500 : 400,
                color: freqColor[l.frequency],
              }}>
                {l.phrase}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--green)' }}>■</span> 고빈도 (카피 즉시 활용)
            <span style={{ color: 'var(--accent)' }}>■</span> 중빈도 (보조 카피)
            <span style={{ color: 'var(--text-3)' }}>■</span> 저빈도
          </div>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <Btn>리서치 결과 내보내기</Btn>
      </div>
    </div>
  );
}
