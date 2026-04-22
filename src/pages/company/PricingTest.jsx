// 가격 페이지 전용 테스트 — Wynter의 Pricing Page Test를 PURIT 서비스 맥락으로 재설계
// 가격 구조의 명확성·지각 가치·행동 장벽·경쟁 포지셔닝을 4축으로 진단

import { useState } from 'react';
import { Card, Badge, Btn, ScoreBar } from '../../components/ui';

const FOUR_AXES = [
  { key: 'clarity', label: '가격 명확성', icon: '◎', color: 'var(--blue)', score: 3.2, desc: '플랜 간 차이가 즉시 이해되는가?' },
  { key: 'value', label: '지각 가치', icon: '◆', color: 'var(--accent)', score: 2.6, desc: '가격 대비 가치가 납득되는가?' },
  { key: 'barrier', label: '행동 장벽', icon: '▲', color: 'var(--red)', score: 2.1, desc: '전환을 막는 의심·불안 요소는?' },
  { key: 'competition', label: '경쟁 포지셔닝', icon: '●', color: '#C084FC', score: 2.9, desc: '경쟁사 대비 선택 이유가 명확한가?' },
];

const PANEL_RESPONSES = [
  {
    panelist: '이커머스 마케터 · 7년',
    tier: 'Standard (월 90만 원)',
    wouldBuy: true,
    keyComment: '패널 규모별 단가 차이가 직관적으로 보여서 좋음. 근데 "건당 보상 제외 마진 40%"라는 설명이 없으면 수수료 구조가 불투명하게 느껴질 것.',
    barriers: ['보안/데이터 처리 정책 명시 필요', '첫 의뢰 전 샘플 리포트 없음'],
  },
  {
    panelist: 'B2B SaaS CMO · 11년',
    tier: 'Pro (구독형)',
    wouldBuy: true,
    keyComment: '구독 리테이너가 월 단위로 잠기는 게 아니라 "소재 수 기준"이면 더 유연하게 쓸 수 있을 것 같음. 분기 약정 옵션도 있으면 좋겠음.',
    barriers: ['환불 정책 없음', '팀 계정 공유 가능 여부 불명확'],
  },
  {
    panelist: '스타트업 Growth · 4년',
    tier: '건당 (1회성)',
    wouldBuy: false,
    keyComment: '1회 50~200만 원이면 ROI가 명확해야 납득 가능. "ROAS 최적화 전행 지표"라는 표현이 추상적 — 실제 사례 수치로 뒷받침해줘야 함.',
    barriers: ['결과 보장 없음', '경쟁사 대비 가격 우위 근거 없음'],
  },
];

const SUMMARY_ISSUES = [
  { priority: 1, type: 'barrier', text: 'ROI 근거 부족 — 패널 66%가 "효과를 믿기 어렵다"고 응답. 전/후 전환율 비교 사례가 가격 페이지 내에 있어야 함.' },
  { priority: 2, type: 'clarity', text: '플랜 비교표 없음 — 건당 vs 구독형의 차이가 글로만 설명됨. 시각적 비교 테이블이 필요.' },
  { priority: 3, type: 'barrier', text: '환불/보장 정책 미노출 — 고관여 B2B 구매에서 "결과 불만족 시 환불" 또는 "재검증 1회 무료" 문구가 전환율에 직결됨.' },
];

export default function PricingTest() {
  const [tab, setTab] = useState('overview');
  const [selectedResp, setSelectedResp] = useState(0);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 980, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>PRICING PAGE TEST</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>가격 페이지 검증</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          가격 페이지는 두 번째로 많이 방문되는 페이지입니다. 전환을 막는 의심과 불안을 미리 제거하세요.
        </p>
      </div>

      {/* 4-axis radar summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28 }}>
        {FOUR_AXES.map(ax => (
          <div key={ax.key} style={{ background: 'var(--surface)', padding: '22px 20px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{ax.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: ax.color, fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 8 }}>{ax.score}</div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(ax.score / 5) * 100}%`, height: '100%', background: ax.color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{ax.desc}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['overview', '핵심 이슈'], ['responses', '패널 응답'], ['action', '개선 액션']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500,
            background: tab === v ? 'var(--bg)' : 'transparent',
            color: tab === v ? 'var(--text)' : 'var(--text-3)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SUMMARY_ISSUES.map(issue => (
            <Card key={issue.priority} style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: issue.priority === 1 ? 'var(--red-dim)' : issue.priority === 2 ? 'var(--blue-dim)' : 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: issue.priority === 1 ? 'var(--red)' : issue.priority === 2 ? 'var(--blue)' : 'var(--accent)',
                }}>P{issue.priority}</div>
                <div>
                  <Badge type={issue.type === 'barrier' ? 'red' : 'blue'} style={{ marginBottom: 8 }}>
                    {issue.type === 'barrier' ? '행동 장벽' : '명확성'}
                  </Badge>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginTop: 6 }}>{issue.text}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'responses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PANEL_RESPONSES.map((r, i) => (
              <div key={i} onClick={() => setSelectedResp(i)} style={{
                padding: '14px 16px', background: selectedResp === i ? 'var(--surface-2)' : 'var(--surface)',
                borderRadius: 'var(--radius)', border: '1px solid ' + (selectedResp === i ? 'var(--border-light)' : 'var(--border)'),
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.panelist}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 8 }}>{r.tier}</div>
                <Badge type={r.wouldBuy ? 'green' : 'red'}>{r.wouldBuy ? '구매 의향 ○' : '구매 의향 ✕'}</Badge>
              </div>
            ))}
          </div>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{PANEL_RESPONSES[selectedResp].panelist}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16, padding: '14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)' }}>
              "{PANEL_RESPONSES[selectedResp].keyComment}"
            </div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>전환 장벽 요인</div>
            {PANEL_RESPONSES[selectedResp].barriers.map((b, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--red)', padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 'var(--radius)', marginBottom: 6, border: '1px solid rgba(224,112,112,0.2)' }}>
                ⚠ {b}
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'action' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { action: '가격 페이지 상단에 "전환율 개선 사례" 수치 배치', effort: '낮음', impact: '높음' },
            { action: '건당 vs 구독형 시각적 비교표 추가 (기능/패널수/단가 기준)', effort: '낮음', impact: '높음' },
            { action: '"첫 의뢰 결과 불만족 시 재검증 1회 무료" 보장 배지 삽입', effort: '중간', impact: '높음' },
            { action: '팀 계정 공유 가능 여부 명시 (기업 구매 결정권자 대상)', effort: '낮음', impact: '중간' },
            { action: '샘플 리포트 PDF 무료 다운로드 CTA 추가', effort: '중간', impact: '중간' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', width: 20 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{item.action}</span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Badge type="gray">노력 {item.effort}</Badge>
                <Badge type={item.impact === '높음' ? 'green' : 'gold'}>임팩트 {item.impact}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
