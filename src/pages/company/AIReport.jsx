// AI 인사이트 리포트 — Wynter의 "CRO 전문가 요약 리포트" 옵션을
// AI 자동 생성 리포트로 변형. 법적 리스크 없이 유사 가치 제공.

import { useState } from 'react';
import { Card, Badge, Btn } from '../../components/ui';

const REPORT = {
  mission: '프리미엄 러닝화 LP',
  company: '어반핏 코리아',
  generatedAt: '2025-07-15 09:22',
  panelCount: 5,
  overallVerdict: '개선 필요',
  verdictColor: 'var(--red)',

  tldr: '현재 LP는 "가격 대비 가치" 전달은 양호하지만, 헤드라인 명확성과 차별화 메시지 부재로 인해 첫 화면 이탈율이 높을 것으로 예상됩니다. 3가지 핵심 수술이 필요합니다.',

  priorityFixes: [
    {
      priority: 1,
      area: '헤드라인 재작성',
      impact: '전환율 +15~25% 예상',
      issue: '현재 헤드라인("새로운 나를 만나다")이 카테고리 정체성이 없어 타겟이 즉시 이탈합니다.',
      action: '구체적 성과 수치를 포함한 헤드라인으로 교체하세요. 예: "12주 안에 5km 페이스 2분 단축. 카본 플레이트가 만든 차이."',
    },
    {
      priority: 2,
      area: 'CTA 플로팅 버튼 추가',
      impact: '전환율 +10~18% 예상',
      issue: 'CTA가 스크롤 중간에 소멸합니다. 모바일 기준 60% 이상의 사용자가 CTA를 한 번도 보지 못하고 이탈합니다.',
      action: '스크롤 위치와 무관하게 고정되는 플로팅 CTA 버튼을 추가하세요. 버튼 배경색을 제품 이미지 색상과 대비되도록 조정하세요.',
    },
    {
      priority: 3,
      area: '경쟁사 대비 차별화 섹션',
      impact: '전환율 +8~12% 예상',
      issue: '"왜 이 제품이어야 하는가"에 대한 답이 없습니다. 패널 62%가 구체적 차별화 근거 부재를 지적했습니다.',
      action: '경쟁 제품 대비 비교표 또는 "OO 브랜드와 다른 점" 섹션을 추가하세요. 단, 경쟁사명 직접 언급보다는 기능/소재 사양 중심으로 구성하세요.',
    },
  ],

  strengths: [
    '가격 앵커링(정가 vs 할인가) 표기 방식은 즉각적 구매 욕구를 자극함 — 유지 권장',
    '상단 리뷰 수 표기(4.8★ 2,341개)는 즉각적 사회적 증거 역할 수행 — 유지 권장',
    '제품 소재 스펙 상세 기재는 고관여 구매자 신뢰 형성에 기여',
  ],

  riskFlags: [
    { level: 'high', text: '"한정 수량" 텍스트가 실제 재고 수치 없이 사용됨 — 불신 유발 가능성' },
    { level: 'mid', text: '반품 정책이 FAQ에만 있고 구매 버튼 주변에 없음 — 구매 망설임 요인' },
  ],
};

export default function AIReport() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ padding: '40px 48px', maxWidth: 880, animation: 'fadeUp 0.5s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>AI INSIGHT REPORT</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>인사이트 리포트</h1>
        <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {REPORT.mission} · {REPORT.panelCount}명 패널 · {REPORT.generatedAt} 생성
        </div>
      </div>

      {/* TL;DR */}
      <Card style={{ marginBottom: 24, borderLeft: `4px solid ${REPORT.verdictColor}`, padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            핵심 요약 (TL;DR)
          </div>
          <Badge type="red">{REPORT.overallVerdict}</Badge>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.8, fontWeight: 500 }}>
          {REPORT.tldr}
        </p>
      </Card>

      {/* Priority fixes */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-2)' }}>
        🔧 우선순위 개선 항목
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {REPORT.priorityFixes.map(fix => (
          <Card key={fix.priority} onClick={() => setExpanded(expanded === fix.priority ? null : fix.priority)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: fix.priority === 1 ? 'var(--red-dim)' : fix.priority === 2 ? 'var(--accent-dim)' : 'var(--blue-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: fix.priority === 1 ? 'var(--red)' : fix.priority === 2 ? 'var(--accent)' : 'var(--blue)',
                }}>
                  P{fix.priority}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{fix.area}</span>
                    <Badge type="green">{fix.impact}</Badge>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{fix.issue}</p>
                  {expanded === fix.priority && (
                    <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)' }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        권장 액션
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{fix.action}</p>
                    </div>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--text-3)', fontSize: 18, marginLeft: 12, flexShrink: 0 }}>
                {expanded === fix.priority ? '↑' : '↓'}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Strengths */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)' }}>✅ 유지해야 할 강점</h2>
      <Card style={{ marginBottom: 24, padding: '20px 24px' }}>
        {REPORT.strengths.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < REPORT.strengths.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <span style={{ color: 'var(--green)', flexShrink: 0 }}>◆</span>
            {s}
          </div>
        ))}
      </Card>

      {/* Risk flags */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)' }}>⚠️ 리스크 플래그</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {REPORT.riskFlags.map((r, i) => (
          <div key={i} style={{
            padding: '12px 16px', borderRadius: 'var(--radius)',
            background: r.level === 'high' ? 'var(--red-dim)' : 'rgba(232,213,163,0.08)',
            border: '1px solid ' + (r.level === 'high' ? 'rgba(224,112,112,0.3)' : 'rgba(232,213,163,0.2)'),
            fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 600, color: r.level === 'high' ? 'var(--red)' : 'var(--accent)', marginRight: 8 }}>
              {r.level === 'high' ? '🔴 HIGH' : '🟡 MID'}
            </span>
            {r.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Btn>PDF 내보내기</Btn>
        <Btn variant="secondary">팀원에게 공유</Btn>
      </div>
    </div>
  );
}
