import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { Btn, Card, Badge, ConfirmModal } from '../../components/ui';
import PanelTargetStep, { calcCredits, calcPanelPayout, CAREER_LEVELS } from '../../components/ui/PanelTargetStep';
import { splitCredits, needsAddonConfirm, addonUsageFor } from '../../lib/credits';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';
import { navigationGuard } from '../../lib/navigationGuard';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';
import { compressImage } from '../../lib/imageUtils';

const STEPS = ['서비스/타겟 설정', '소재 업로드', '질문 설정', '패널 설정', '검토 & 제출'];
const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const INDUSTRIES = [
  '뷰티/코스메틱', '헬스/피트니스', '식품/음료', '패션/의류',
  'SaaS/소프트웨어', '교육/에듀테크', '금융/핀테크', '여행/숙박',
  '부동산/인테리어', '의료/헬스케어', '반려동물', '게임/엔터테인먼트',
  '이커머스/리테일', '자동차/모빌리티', '미디어/콘텐츠', 'B2B 서비스',
  'HR/채용', '법률/컨설팅', '물류/배송', '환경/에너지',
];

const INDUSTRY_PLACEHOLDERS = {
  '헬스/피트니스': {
    product: '프리미엄 러닝화 LP',
    personaAge: '35-45세',
    personaIncome: '500만 원 이상',
    personaRole: '직장인 러너, 마케터 등',
    personaContext: '제품: 기능성 러닝화\n퇴근 후 운동하는 30-40대 직장인. 러닝화에 10만 원 이상 지출 경험 있음',
    briefText: '이 LP는 러닝화 첫 구매자를 타겟으로 합니다. 스크롤 흐름과 CTA 전환 가능성을 중심으로 피드백 부탁드립니다.',
  },
  '뷰티/코스메틱': {
    product: '비건 스킨케어 브랜드 LP',
    personaAge: '25-35세',
    personaIncome: '300-500만 원',
    personaRole: '뷰티에 관심 있는 직장 여성',
    personaContext: '제품: 비건 세럼 라인\n피부 트러블로 화학 성분에 민감한 20-30대 여성. 스킨케어에 월 5만 원 이상 지출',
    briefText: '비건 세럼 LP입니다. 성분 신뢰도와 첫인상 전환력을 중심으로 피드백 부탁드립니다.',
  },
  '식품/음료': {
    product: '건강 도시락 구독 서비스 LP',
    personaAge: '28-40세',
    personaIncome: '350-600만 원',
    personaRole: '바쁜 직장인, 건강 관심 1인 가구',
    personaContext: '제품: 주 5회 저칼로리 도시락 배송\n점심 식비 절약과 건강을 동시에 챙기고 싶은 직장인. 구독 서비스 이용 경험 있음',
    briefText: '건강 도시락 구독 LP입니다. 메뉴 신뢰감과 구독 가치 전달력 위주로 피드백 부탁드립니다.',
  },
  '패션/의류': {
    product: '스트릿 캐주얼 브랜드 LP',
    personaAge: '20-30세',
    personaIncome: '200-400만 원',
    personaRole: '트렌드에 민감한 MZ세대',
    personaContext: '제품: 오버핏 캐주얼 의류 라인\n트렌드에 민감하고 온라인 쇼핑을 즐기는 20대. 월 의류비 10만 원 이상 지출',
    briefText: '스트릿 패션 브랜드 LP입니다. 브랜드 감성 전달과 구매 욕구 유발 포인트 위주로 피드백 부탁드립니다.',
  },
  'SaaS/소프트웨어': {
    product: 'B2B 마케팅 자동화 툴 LP',
    personaAge: '28-42세',
    personaIncome: '500만 원 이상',
    personaRole: '마케터, 그로스 담당자, 스타트업 팀장',
    personaContext: '제품: 리드 너처링 자동화 SaaS\n마케팅 ROI 개선이 필요한 스타트업~중소기업 마케터. 유료 툴 도입 결정권 있음',
    briefText: '마케팅 자동화 SaaS LP입니다. 가치 제안 명확성과 전환 CTA 효과 위주로 피드백 부탁드립니다.',
  },
  '교육/에듀테크': {
    product: 'AI 영어 회화 앱 LP',
    personaAge: '22-35세',
    personaIncome: '250-450만 원',
    personaRole: '취준생, 영어 실력 향상 원하는 직장인',
    personaContext: '제품: 1일 10분 AI 튜터 영어 앱\n영어 울렁증 있는 20-30대. 기존 학원/앱 경험 있으나 꾸준히 못 했음',
    briefText: 'AI 영어 앱 LP입니다. 차별점 전달과 지속 동기 유발 요소 위주로 피드백 부탁드립니다.',
  },
  '금융/핀테크': {
    product: '소액 투자 플랫폼 LP',
    personaAge: '25-38세',
    personaIncome: '300-500만 원',
    personaRole: '재테크 초보 직장인, 투자 입문자',
    personaContext: '제품: 월 1만 원부터 시작하는 ETF 투자 앱\n투자에 관심 있지만 복잡해 보여 시작 못 한 20-30대 직장인',
    briefText: '소액 투자 앱 LP입니다. 신뢰감과 진입 장벽 해소 메시지 위주로 피드백 부탁드립니다.',
  },
  '여행/숙박': {
    product: '국내 감성 숙소 예약 플랫폼 LP',
    personaAge: '25-40세',
    personaIncome: '300-600만 원',
    personaRole: '여행 좋아하는 커플, 소규모 가족',
    personaContext: '제품: 독채 펜션·글램핑 특화 예약 서비스\n주말 여행을 즐기는 2-4인. 에어비앤비·야놀자 이용 경험 있음',
    briefText: '감성 숙소 예약 LP입니다. 차별화 포인트와 예약 전환 유도 메시지 위주로 피드백 부탁드립니다.',
  },
  '부동산/인테리어': {
    product: '셀프 인테리어 큐레이션 서비스 LP',
    personaAge: '28-45세',
    personaIncome: '400-700만 원',
    personaRole: '신혼부부, 이사 준비 중인 30-40대',
    personaContext: '제품: 평수·예산별 인테리어 패키지 서비스\n이사 또는 리모델링 계획 중인 30대. 어디서 시작할지 모르는 인테리어 초심자',
    briefText: '셀프 인테리어 서비스 LP입니다. 신뢰감과 의사결정 편의성 위주로 피드백 부탁드립니다.',
  },
  '의료/헬스케어': {
    product: '비대면 심리 상담 서비스 LP',
    personaAge: '25-40세',
    personaIncome: '300-500만 원',
    personaRole: '번아웃·스트레스로 상담 고려 중인 직장인',
    personaContext: '제품: 앱 기반 심리 상담 구독\n정신건강에 관심 있으나 오프라인 상담에 거부감 있는 20-30대. 보험 적용 여부 관심',
    briefText: '비대면 심리 상담 LP입니다. 신뢰감 형성과 첫 상담 진입 장벽 해소 메시지 위주로 피드백 부탁드립니다.',
  },
  '반려동물': {
    product: '반려견 맞춤 사료 구독 LP',
    personaAge: '25-40세',
    personaIncome: '350-550만 원',
    personaRole: '반려견 키우는 1-2인 가구',
    personaContext: '제품: 견종·나이별 맞춤 생식 사료\n강아지 건강에 신경 쓰는 집사. 기존 사료 부작용 경험 있거나 성분에 민감',
    briefText: '맞춤 반려견 사료 LP입니다. 원료 신뢰감과 맞춤화 가치 전달 위주로 피드백 부탁드립니다.',
  },
  '게임/엔터테인먼트': {
    product: '모바일 RPG 신작 사전예약 LP',
    personaAge: '18-32세',
    personaIncome: '100-350만 원',
    personaRole: '모바일 게이머, 장르 팬',
    personaContext: '제품: 판타지 수집형 RPG\n하루 1-2시간 모바일 게임 즐기는 10-20대. 아이템 과금 경험 있음',
    briefText: '모바일 RPG 사전예약 LP입니다. 게임 첫인상과 플레이 욕구 유발 요소 위주로 피드백 부탁드립니다.',
  },
  '이커머스/리테일': {
    product: '프리미엄 원두 이커머스 LP',
    personaAge: '25-40세',
    personaIncome: '300-550만 원',
    personaRole: '커피 좋아하는 직장인, 홈카페 족',
    personaContext: '제품: 산지 직수입 스페셜티 원두 정기배송\n커피에 월 3만 원 이상 지출하는 커피 애호가. 홈카페 장비 보유',
    briefText: '스페셜티 원두 LP입니다. 상품 신뢰도와 구독 가치 전달 위주로 피드백 부탁드립니다.',
  },
  '자동차/모빌리티': {
    product: '전기차 리스 비교 플랫폼 LP',
    personaAge: '30-50세',
    personaIncome: '500만 원 이상',
    personaRole: '차량 교체 고려 중인 직장인, 사업자',
    personaContext: '제품: 전기차 리스·할부 비교 서비스\n내연기관에서 전기차로 전환 고려 중인 30-40대. 보조금·유지비에 관심',
    briefText: '전기차 리스 비교 LP입니다. 정보 신뢰성과 의사결정 전환 포인트 위주로 피드백 부탁드립니다.',
  },
  '미디어/콘텐츠': {
    product: '직장인 재테크 뉴스레터 LP',
    personaAge: '25-40세',
    personaIncome: '300-550만 원',
    personaRole: '경제 뉴스에 관심 있는 직장인',
    personaContext: '제품: 주 3회 발행 재테크·경제 뉴스레터\n재테크에 관심 있지만 복잡한 정보 소화가 어려운 20-30대 직장인',
    briefText: '재테크 뉴스레터 LP입니다. 구독 가치 전달과 개봉 동기 유발 요소 위주로 피드백 부탁드립니다.',
  },
  'B2B 서비스': {
    product: '스타트업 법인 세무 대행 서비스 LP',
    personaAge: '28-45세',
    personaIncome: '500만 원 이상',
    personaRole: '스타트업 대표, CFO, 재무 담당자',
    personaContext: '제품: 스타트업 특화 세무·회계 월정액 서비스\n법인 설립 1-3년 차 스타트업. 세무 처리 직접 하기 어렵고 비용 최적화 필요',
    briefText: 'B2B 세무 서비스 LP입니다. 신뢰감과 도입 결정 전환 포인트 위주로 피드백 부탁드립니다.',
  },
  'HR/채용': {
    product: '기술 직군 채용 플랫폼 LP',
    personaAge: '28-45세',
    personaIncome: '500만 원 이상',
    personaRole: '채용 담당자, HR 팀장, 스타트업 CTO',
    personaContext: '제품: 개발자·디자이너 특화 채용 SaaS\n채용 속도와 퀄리티에 고민 있는 HR 담당. 기존 플랫폼 대비 비용 민감',
    briefText: '기술 직군 채용 플랫폼 LP입니다. 차별점 명확성과 도입 설득력 위주로 피드백 부탁드립니다.',
  },
  '법률/컨설팅': {
    product: '개인 소송 법률 지원 서비스 LP',
    personaAge: '30-55세',
    personaIncome: '350-600만 원',
    personaRole: '법적 분쟁에 처한 일반인, 소상공인',
    personaContext: '제품: 비대면 법률 상담 및 서류 작성 지원\n변호사 선임이 부담스러운 일반인. 계약 분쟁·부동산·이혼 등 다양한 사례',
    briefText: '법률 지원 서비스 LP입니다. 신뢰감과 진입 장벽 해소 메시지 위주로 피드백 부탁드립니다.',
  },
  '물류/배송': {
    product: '소규모 셀러 당일 출고 풀필먼트 LP',
    personaAge: '28-45세',
    personaIncome: '500만 원 이상',
    personaRole: '온라인 셀러, 소규모 이커머스 운영자',
    personaContext: '제품: 소규모 셀러 대상 당일 출고 풀필먼트\n하루 50건 이상 주문 처리하는 인스타그램·스마트스토어 셀러. 배송 지연 CS 부담',
    briefText: '풀필먼트 서비스 LP입니다. 비용 대비 가치와 신뢰감 전달 위주로 피드백 부탁드립니다.',
  },
  '환경/에너지': {
    product: '가정용 태양광 패널 설치 서비스 LP',
    personaAge: '35-55세',
    personaIncome: '500만 원 이상',
    personaRole: '자가 주택 보유자, 에너지 절감 관심층',
    personaContext: '제품: 가정용 태양광 패널 설치 + 모니터링 앱\n전기요금 절감에 관심 있는 30-50대 자가 주택 보유자. 초기 투자 대비 회수 기간 관심',
    briefText: '가정용 태양광 설치 LP입니다. 절감 효과 신뢰도와 설치 불안감 해소 메시지 위주로 피드백 부탁드립니다.',
  },
};

const DEFAULT_PLACEHOLDERS = {
  product: '검증할 서비스명을 입력하세요',
  personaAge: '예) 35-45세',
  personaIncome: '예) 500만 원 이상',
  personaRole: '예) 직장인, 마케터 등',
  personaContext: '예) 제품명과 타겟 고객의 특징을 간단히 적어주세요',
  briefText: '이 LP의 핵심 타겟과 검증받고 싶은 포인트를 적어주세요.',
};

const AGE_MIN = 10, AGE_MAX = 70;

// 월 소득 수준 — 연령대처럼 듀얼 슬라이더로 선택 (만원/월 임계값, 마지막 인덱스는 '이상')
const INCOME_STOPS = [100, 200, 300, 400, 500, 700, 1000];
const INCOME_MIN_IDX = 0, INCOME_MAX_IDX = INCOME_STOPS.length - 1;
const fmtMan = (v) => v.toLocaleString();
const incomeHandleLabel = (i) => i >= INCOME_MAX_IDX ? `${fmtMan(INCOME_STOPS[i])}만원+` : `${fmtMan(INCOME_STOPS[i])}만원`;
// 인덱스 범위 → 사람이 읽는 소득 문자열 (전체 범위면 '' 반환 → 페르소나에서 생략)
function fmtIncomeRange(lo, hi) {
  const top = hi >= INCOME_MAX_IDX;
  if (lo <= INCOME_MIN_IDX && top) return '';                              // 소득 무관
  if (top)                  return `${fmtMan(INCOME_STOPS[lo])}만원 이상`;
  if (lo <= INCOME_MIN_IDX) return `${fmtMan(INCOME_STOPS[hi])}만원 이하`;
  return `${fmtMan(INCOME_STOPS[lo])}~${fmtMan(INCOME_STOPS[hi])}만원`;
}
// 저장된 소득 문자열 → 슬라이더 인덱스 복원 (구 드롭다운/신 범위 포맷 모두 지원)
function parseIncomeToIdx(str) {
  if (!str || /무관/.test(str)) return { min: INCOME_MIN_IDX, max: INCOME_MAX_IDX };
  if (/억/.test(str))           return { min: INCOME_MAX_IDX, max: INCOME_MAX_IDX };
  const nums = (str.replace(/,/g, '').match(/\d+/g) || []).map(Number);
  const nearest = (n) => {
    let bi = 0, bd = Infinity;
    INCOME_STOPS.forEach((s, i) => { const d = Math.abs(s - n); if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  if (/이상/.test(str) && nums.length) return { min: nearest(nums[0]), max: INCOME_MAX_IDX };
  if (/이하/.test(str) && nums.length) return { min: INCOME_MIN_IDX, max: nearest(nums[0]) };
  if (nums.length >= 2) { const a = nearest(nums[0]), b = nearest(nums[1]); return { min: Math.min(a, b), max: Math.max(a, b) }; }
  if (nums.length === 1) { const a = nearest(nums[0]); return { min: a, max: a }; }
  return { min: 2, max: 4 };
}
// 저장된 소득 문자열 → 슬라이더 인덱스 + 특수 타겟 체크박스(1억 이상/기업 고객) 복원
function restoreIncome(str) {
  const s = str || '';
  const high = /억/.test(s);
  const biz  = /기업\s*고객/.test(s);
  if (high || biz) return { personaIncomeMin: 2, personaIncomeMax: 4, personaIncomeHigh: high, personaIncomeBiz: biz };
  const r = parseIncomeToIdx(s);
  return { personaIncomeMin: r.min, personaIncomeMax: r.max, personaIncomeHigh: false, personaIncomeBiz: false };
}

// 듀얼 레인지 슬라이더 — 커스텀 div 핸들 + pointer 드래그 (브라우저 기본 핸들의 양끝 삐져나옴 문제 제거)
function DualRangeSlider({ min, max, step, valueMin, valueMax, onChangeMin, onChangeMax }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(null); // 'min' | 'max' | null
  const R = 9; // 핸들 반지름(px)

  const frac = (v) => (v - min) / (max - min);
  // inset 보정 핸들 중심: 0%→9px, 100%→(100%-9px) → 핸들이 항상 트랙 안에 머묾
  const centerLeft = (v) => `calc(${frac(v) * 100}% + ${(1 - 2 * frac(v)) * R}px)`;

  const valueFromX = (clientX) => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const usable = rect.width - 2 * R;
    const f = usable <= 0 ? 0 : Math.max(0, Math.min(1, (clientX - rect.left - R) / usable));
    return Math.round((min + f * (max - min)) / step) * step;
  };

  const apply = (which, v) => {
    if (v == null) return;
    if (which === 'min') onChangeMin(Math.min(v, valueMax - step));
    else onChangeMax(Math.max(v, valueMin + step));
  };
  const startDrag = (which, e) => { draggingRef.current = which; trackRef.current?.setPointerCapture?.(e.pointerId); };
  const onTrackDown = (e) => {
    const v = valueFromX(e.clientX);
    const which = Math.abs(v - valueMin) <= Math.abs(v - valueMax) ? 'min' : 'max';
    startDrag(which, e); apply(which, v);
  };
  const onThumbDown = (which) => (e) => { e.stopPropagation(); startDrag(which, e); };
  const onMove = (e) => { if (draggingRef.current) apply(draggingRef.current, valueFromX(e.clientX)); };
  const onUp = () => { draggingRef.current = null; };

  const thumbStyle = (v, z) => ({
    position: 'absolute', top: '50%', left: centerLeft(v), transform: 'translate(-50%, -50%)',
    width: 18, height: 18, borderRadius: '50%', background: '#fff', border: '2.5px solid var(--accent)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)', cursor: 'grab', touchAction: 'none', zIndex: z,
  });

  return (
    <div ref={trackRef} onPointerDown={onTrackDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      style={{ position: 'relative', height: 22, userSelect: 'none', touchAction: 'none', cursor: 'pointer' }}>
      {/* 배경 트랙 (핸들 중심 범위와 동일하게 좌우 9px inset) */}
      <div style={{ position: 'absolute', top: '50%', left: R, right: R, transform: 'translateY(-50%)', height: 4, background: 'var(--border)', borderRadius: 2 }} />
      {/* 채워진 트랙 */}
      <div style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 4, background: 'var(--accent)', borderRadius: 2,
        left: centerLeft(valueMin),
        width: `calc(${(frac(valueMax) - frac(valueMin)) * 100}% - ${2 * R * (frac(valueMax) - frac(valueMin))}px)`,
      }} />
      {/* 핸들 2개 */}
      <div onPointerDown={onThumbDown('min')} style={thumbStyle(valueMin, valueMin >= valueMax - step ? 5 : 3)} />
      <div onPointerDown={onThumbDown('max')} style={thumbStyle(valueMax, 4)} />
    </div>
  );
}

const PAGE_SIZE = 5;
const WINDOW = 5;

function Pagination({ page, total, onPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const winStart = Math.max(1, page - 2);
  const winEnd   = Math.min(totalPages, winStart + WINDOW - 1);
  const pageNums = Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);
  const btnBase  = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
      {page > WINDOW && (
        <button onClick={() => onPage(Math.max(1, page - WINDOW))} style={btnBase}>«</button>
      )}
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        style={{ ...btnBase, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>이전</button>
      {pageNums.map(n => (
        <button key={n} onClick={() => onPage(n)} style={{ ...btnBase,
          background: page === n ? 'var(--accent)' : 'var(--surface)',
          color: page === n ? '#fff' : 'var(--text-2)',
          border: '1px solid ' + (page === n ? 'var(--accent)' : 'var(--border)'),
          fontWeight: page === n ? 700 : 400 }}>{n}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        style={{ ...btnBase, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>다음</button>
      {page <= totalPages - WINDOW && (
        <button onClick={() => onPage(Math.min(totalPages, page + WINDOW))} style={btnBase}>»</button>
      )}
    </div>
  );
}

export default function NewMission() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode      = Boolean(location.state?.editMode);
  const editMissionId   = location.state?.missionId   || null;
  const initTemplateId   = location.state?.templateId   || null;
  const initTemplateName = location.state?.templateName || null;

  const fileInputRef = useRef(null);
  const panelStepRef = useRef(null);
  const submittingRef = useRef(false);
  const [view, setView]         = useState(isEditMode ? 'form' : 'list');
  const [step, setStep]         = useState(0);
  const [missionUuid, setMissionUuid] = useState(() => editMissionId || crypto.randomUUID());
  const [form, setForm] = useState({
    product: '', lpUrl: '',
    personaAgeMin: 20, personaAgeMax: 40, personaIncomeMin: 2, personaIncomeMax: 4,
    personaIncomeHigh: false, personaIncomeBiz: false, personaRole: '', personaContext: '',
    industry: '',
    panels: 10, briefText: '', focusAreas: [],
    imageUrls: [],
    estimatedMinutes: 5,
  });
  const [industryOpen,        setIndustryOpen]        = useState(false);
  const [industryCustomMode,  setIndustryCustomMode]  = useState(false);
  const [industryCustomInput, setIndustryCustomInput] = useState('');
  const [focusCustomMode,     setFocusCustomMode]     = useState(false);
  const [focusCustomInput,    setFocusCustomInput]    = useState('');
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [companyPlan, setCompanyPlan]     = useState(null);
  const [companyFreeTrialUsed, setCompanyFreeTrialUsed] = useState(false);
  const [companyId, setCompanyId]         = useState(null);
  const [creditBalance, setCreditBalance] = useState(null);
  const [creditAddon, setCreditAddon]     = useState(0);
  const [teamRole, setTeamRole]           = useState(null);
  const [careerLevels, setCareerLevels]   = useState(['junior']);
  const [missions, setMissions]           = useState([]);
  const [loadingList, setLoadingList]     = useState(true);
  const [listFilter, setListFilter]       = useState('active');
  const [listPage, setListPage]           = useState(1);
  const [savingDraft, setSavingDraft]     = useState(false);
  const [draftSaveError, setDraftSaveError] = useState('');
  const [isDraftMode, setIsDraftMode]     = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleteError, setDeleteError]       = useState('');
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [terminateError, setTerminateError] = useState('');
  const [activeToast, setActiveToast] = useState(null);
  const activeToastTimerRef = useRef(null);
  const [pendingNavPath, setPendingNavPath] = useState(null);
  const [currentEditId, setCurrentEditId] = useState(null);
  // 새로고침/크래시 대비 localStorage 자동저장 → 재진입 시 "이어서 작성" 배너로 복원
  const [restorable, setRestorable] = useState(null);

  // 질문 설정 state
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [localCustomQs,     setLocalCustomQs]     = useState([]);
  const [expandedTmpl,      setExpandedTmpl]      = useState({});
  const [customLPQs,        setCustomLPQs]        = useState([]);
  const [newQText,           setNewQText]          = useState('');
  const [newQType,           setNewQType]          = useState('text');
  const [newQOptions,        setNewQOptions]       = useState(['', '']);
  const [newQScaleMin,       setNewQScaleMin]      = useState('');
  const [newQScaleMax,       setNewQScaleMax]      = useState('');
  const [showSaveModal,      setShowSaveModal]     = useState(false);
  const [savingToTemplate,   setSavingToTemplate]  = useState(false);
  const [saveTmplError,      setSaveTmplError]     = useState('');

  // 플랜 & company id 로드
  useEffect(() => {
    async function fetchPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { company: data, teamRole: tr } = await resolveCompany(user.id);
      setCompanyPlan(data?.plan?.toLowerCase() || 'free_trial');
      setCompanyFreeTrialUsed(data?.free_trial_used ?? false);
      if (data?.id) setCompanyId(data.id);
      if (data != null) { setCreditBalance(data.credit_balance ?? 0); setCreditAddon(data.addon_credits ?? 0); }
      setTeamRole(tr);
    }
    fetchPlan();
  }, []);

  // DB 커스텀 LP 질문 로드
  useEffect(() => {
    if (!companyId) return;
    async function loadCustomLPQs() {
      const { data } = await supabase
        .from('question_templates')
        .select('template_questions(id, question_text, question_type, options, question_order)')
        .eq('company_id', companyId)
        .eq('category', '랜딩페이지')
        .eq('is_default', false);
      const qs = (data || []).flatMap(t =>
        (t.template_questions || [])
          .sort((a, b) => a.question_order - b.question_order)
          .map(q => ({
            id: q.id,
            text: q.question_text,
            type: q.question_type || 'text',
            options: Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })(),
          }))
      );
      setCustomLPQs(qs);
    }
    loadCustomLPQs();
  }, [companyId]);

  // 의뢰 목록 로드 (list 뷰)
  useEffect(() => {
    if (view !== 'list') return;
    async function loadMissions() {
      setLoadingList(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { company: co } = await resolveCompany(user.id);
        if (co) {
          const { data } = await supabase.from('missions')
            .select('id, title, status, panel_count, filled_count, created_at, company_notified_at, is_free_trial')
            .eq('company_id', co.id)
            .or('type.is.null,type.eq.landing_page')
            .eq('dismissed', false)
            .order('created_at', { ascending: false });
          setMissions(data || []);
        }
      } catch (err) {
        console.error('[loadMissions error]', err);
      } finally {
        setLoadingList(false);
      }
    }
    loadMissions();
  }, [view]);

  // 질문 템플릿 페이지에서 templateId/templateName 전달 시 해당 템플릿 미리 선택
  useEffect(() => {
    if (!initTemplateId) return;
    setView('form');
    if (initTemplateName) {
      const target = (QUESTION_TEMPLATES.lp || []).find(t => t.name === initTemplateName);
      if (target) {
        setSelectedQuestions(target.questions.slice(0, 5));
        setExpandedTmpl({ [target.id]: true });
        setStep(2);
      }
    }
  }, []);

  function resetForm() {
    setMissionUuid(crypto.randomUUID());
    setStep(0);
    setForm({ product: '', lpUrl: '', personaAgeMin: 20, personaAgeMax: 40, personaIncomeMin: 2, personaIncomeMax: 4, personaIncomeHigh: false, personaIncomeBiz: false, personaRole: '', personaContext: '', industry: '', panels: 10, briefText: '', focusAreas: [], imageUrls: [], estimatedMinutes: 5 });
    setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput('');
    setFocusCustomMode(false); setFocusCustomInput('');
    setCareerLevels(['junior']);
    setSelectedQuestions([]); setLocalCustomQs([]); setExpandedTmpl({});
    setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
    setIsDraftMode(false); setCurrentEditId(null);
  }

  // 편집 모드: 기존 미션 데이터 pre-fill
  useEffect(() => {
    if (!isEditMode || !editMissionId) return;
    async function load() {
      const { data: ms } = await supabase.from('missions').select('*').eq('id', editMissionId).single();
      if (!ms) return;
      if (ms.status === 'draft') setIsDraftMode(true);
      let parsed = {};
      try { parsed = JSON.parse(ms.description || '{}'); } catch {}
      setForm(f => ({
        ...f,
        product:        parsed.product || ms.title || '',
        lpUrl:          ms.target_url || '',
        briefText:      parsed.briefText || '',
        panels:         ms.panel_count || 10,
        focusAreas:     parsed.focusAreas || ms.assets || [],
        imageUrls:      ms.image_urls || [],
        industry:       parsed.industry || '',
        ...(() => { const m = (parsed.personaAge || '').match(/(\d+)[~\-](\d+)/); return { personaAgeMin: m ? +m[1] : 20, personaAgeMax: m ? +m[2] : 40 }; })(),
        ...restoreIncome(parsed.personaIncome || ''),
        personaRole:    parsed.personaRole || '',
        personaContext: parsed.personaContext || '',
      }));
      if (Array.isArray(parsed.selectedQuestions)) {
        // 저장 시 합쳐진(allLPSelected) 질문을 local-(인라인 생성) / 그 외로 다시 분리 복원
        // → '추가된 질문 목록' 카드(취소 버튼 포함) 복구
        const isLocal = q => typeof q.id === 'string' && q.id.startsWith('local-');
        setLocalCustomQs(parsed.selectedQuestions.filter(isLocal));
        setSelectedQuestions(parsed.selectedQuestions.filter(q => !isLocal(q)));
      }
      if (Array.isArray(parsed.careerLevels)) setCareerLevels(parsed.careerLevels);
      if (parsed.step != null) setStep(parsed.step);
    }
    load();
  }, []);

  const FOCUS = ['첫인상 / 가독성', 'CTA 전환율', '가격 및 가치 전달', 'A/B 소재 비교', '신뢰 요소', '모바일 최적화', '핵심 메시지 명확성', '비주얼 완성도', '타겟 일치도'];

  const stepValid = (() => {
    if (step === 0) return !!form.industry && !!form.product.trim() && !!form.personaRole.trim();
    if (step === 1) return form.imageUrls.length > 0 && form.focusAreas.length > 0 && !!form.briefText.trim();
    return true;
  })();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const incomeFlagLabels = [];
  if (form.personaIncomeHigh) incomeFlagLabels.push('1억 이상');
  if (form.personaIncomeBiz)  incomeFlagLabels.push('기업 고객');
  const incomeOverride = incomeFlagLabels.length > 0;
  // 체크박스(1억 이상/기업 고객)가 켜지면 슬라이더 범위 대신 그 라벨이 소득 표기를 대체
  const personaIncomeStr = incomeOverride
    ? incomeFlagLabels.join(' · ')
    : fmtIncomeRange(form.personaIncomeMin, form.personaIncomeMax);
  // 체크 시 슬라이더를 기본값으로 리셋(체크박스가 소득을 결정), 해제 시 슬라이더 재활성
  const toggleIncomeFlag = (key) => setForm(f => f[key]
    ? { ...f, [key]: false }
    : { ...f, [key]: true, personaIncomeMin: 2, personaIncomeMax: 4 });
  const toggleFocus = (f) => setForm(prev => ({
    ...prev,
    focusAreas: prev.focusAreas.includes(f) ? prev.focusAreas.filter(x => x !== f) : [...prev.focusAreas, f],
  }));

  // 질문 설정 헬퍼
  const lpTemplates      = QUESTION_TEMPLATES.lp || [];
  const allLPSelected    = [...selectedQuestions, ...localCustomQs];
  const totalLPSelected  = allLPSelected.length;
  const textLPSelected   = allLPSelected.filter(q => q.type === 'text').length;
  const canAddLPQ        = (q) => totalLPSelected < 5 && !(q.type === 'text' && textLPSelected >= 2);
  const toggleLPQuestion = (q) => {
    const sel = selectedQuestions.some(s => s.id === q.id);
    if (sel) setSelectedQuestions(prev => prev.filter(s => s.id !== q.id));
    else if (canAddLPQ(q)) setSelectedQuestions(prev => [...prev, q]);
  };

  function handleAddLocalQ() {
    if (!newQText.trim()) return;
    if (!canAddLPQ({ type: newQType })) return;
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    setLocalCustomQs(prev => [...prev, { id: `local-${Date.now()}`, text: newQText.trim(), type: newQType, options }]);
    setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
  }

  async function handleSaveTmpl() {
    if (!newQText.trim() || !companyId) return;
    setSavingToTemplate(true);
    const options =
      newQType === 'radio' ? newQOptions.filter(o => o.trim()) :
      newQType === 'scale' ? [newQScaleMin.trim(), newQScaleMax.trim()] : [];
    try {
      let { data: tmpl } = await supabase
        .from('question_templates').select('id')
        .eq('company_id', companyId).eq('category', '랜딩페이지').eq('is_default', false)
        .maybeSingle();
      if (!tmpl) {
        const { data: newT, error: tErr } = await supabase
          .from('question_templates')
          .insert({ company_id: companyId, name: '내 커스텀 질문', category: '랜딩페이지', icon: '✏️', description: '직접 만든 질문 모음', is_default: false })
          .select().single();
        if (tErr) throw tErr;
        tmpl = newT;
      }
      const { data: newQ, error: qErr } = await supabase.from('template_questions').insert({
        template_id: tmpl.id, question_text: newQText.trim(), question_type: newQType,
        options, question_order: customLPQs.length + 1,
      }).select().single();
      if (qErr) throw qErr;
      const saved = {
        id: newQ.id, text: newQ.question_text, type: newQ.question_type,
        options: Array.isArray(newQ.options) ? newQ.options : (() => { try { return JSON.parse(newQ.options || '[]'); } catch { return []; } })(),
      };
      setCustomLPQs(prev => [...prev, saved]);
      setLocalCustomQs(prev => [...prev, { ...saved, id: `local-${Date.now()}` }]);
      setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
      setSaveTmplError('');
      setShowSaveModal(false);
    } catch (e) {
      console.error('[NewMission] 템플릿 저장 실패:', e.message);
      setSaveTmplError('템플릿 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSavingToTemplate(false);
    }
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remaining = MAX_IMAGES - form.imageUrls.length;
    const toUpload = files.slice(0, remaining);

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name}이 20MB를 초과합니다.`);
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    setUploadError('');
    try {
      if (!companyId) { setUploadError('회사 정보를 불러오는 중입니다. 잠시 후 다시 시도하세요.'); setUploading(false); return; }
      const company = { id: companyId };

      const urls = [];
      for (const file of toUpload) {
        const compressed = await compressImage(file);
        const ext = compressed.type === 'image/png' ? 'png' : 'jpg';
        const path = `${company.id}/${missionUuid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('mission-assets').upload(path, compressed, { upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
        urls.push(publicUrl);
      }
      set('imageUrls', [...form.imageUrls, ...urls]);
    } catch (err) {
      setUploadError('업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (url) => {
    set('imageUrls', form.imageUrls.filter(u => u !== url));
  };

  const effectiveEditMode = isEditMode || !!currentEditId;
  const effectiveEditId   = currentEditId || editMissionId;

  const shouldBlockNav = view === 'form'
    && (!effectiveEditMode || isDraftMode)
    && Boolean(form.product || form.lpUrl || form.briefText || form.imageUrls.length > 0
      || form.industry || form.personaRole || form.personaContext);


  useEffect(() => {
    const handler = (e) => { if (shouldBlockNav) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlockNav]);

  useEffect(() => {
    if (shouldBlockNav) {
      navigationGuard.register({
        onAttempt: (path) => { setPendingNavPath(path); setShowDraftModal(true); },
      });
    } else {
      navigationGuard.unregister();
    }
    return () => navigationGuard.unregister();
  }, [shouldBlockNav]);

  // ── 새로고침 대비 localStorage 자동저장 / 복원 ──
  // beforeunload 안에서는 DB 비동기 저장이 보장되지 않으므로, 작성 중 폼을 브라우저에 동기 저장해 둔다.
  const draftKey = companyId ? `purit_form_draft_main_${companyId}` : null;
  const clearLocalDraft = () => { if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} } };

  // 자동저장: 신규 작성(create) 모드에서 내용이 있을 때만 (수정 모드는 DB가 진실 원천이라 제외)
  useEffect(() => {
    if (!draftKey || effectiveEditMode || view !== 'form') return;
    const hasContent = Boolean(form.product || form.lpUrl || form.briefText || form.imageUrls.length > 0
      || form.industry || form.personaRole || form.personaContext);
    if (!hasContent) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        form, step, careerLevels, selectedQuestions, localCustomQs, missionUuid, savedAt: Date.now(),
      }));
    } catch {}
  }, [draftKey, effectiveEditMode, view, form, step, careerLevels, selectedQuestions, localCustomQs, missionUuid]);

  // 복원 감지: 신규 진입(수정·템플릿 진입 아님) 시 저장본이 있으면 배너로 제안
  useEffect(() => {
    if (!draftKey || isEditMode || initTemplateId) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const parsed = JSON.parse(raw); if (parsed?.form) setRestorable(parsed); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function restoreLocalDraft() {
    const d = restorable;
    if (!d) return;
    if (d.form) setForm(f => ({ ...f, ...d.form }));
    if (typeof d.step === 'number') setStep(d.step);
    if (Array.isArray(d.careerLevels)) setCareerLevels(d.careerLevels);
    if (Array.isArray(d.selectedQuestions)) setSelectedQuestions(d.selectedQuestions);
    if (Array.isArray(d.localCustomQs)) setLocalCustomQs(d.localCustomQs);
    if (d.missionUuid) setMissionUuid(d.missionUuid);
    setIsDraftMode(false); setCurrentEditId(null);
    setRestorable(null);
    setView('form');
  }
  function discardLocalDraft() {
    clearLocalDraft();
    setRestorable(null);
  }

  function openDraftOrActiveForEdit(missionId) {
    setCurrentEditId(missionId);
    supabase.from('missions').select('*').eq('id', missionId).single().then(({ data: ms }) => {
      if (!ms) return;
      setIsDraftMode(ms.status === 'draft');
      let parsed = {};
      try { parsed = JSON.parse(ms.description || '{}'); } catch {}
      setForm(f => ({
        ...f,
        product:        parsed.product || ms.title || '',
        lpUrl:          ms.target_url || '',
        briefText:      parsed.briefText || '',
        panels:         ms.panel_count || 10,
        focusAreas:     parsed.focusAreas || ms.assets || [],
        imageUrls:      ms.image_urls || [],
        industry:       parsed.industry || '',
        ...(() => { const m = (parsed.personaAge || '').match(/(\d+)[~\-](\d+)/); return { personaAgeMin: m ? +m[1] : 20, personaAgeMax: m ? +m[2] : 40 }; })(),
        ...restoreIncome(parsed.personaIncome || ''),
        personaRole:    parsed.personaRole || '',
        personaContext: parsed.personaContext || '',
      }));
      if (Array.isArray(parsed.selectedQuestions)) {
        // 저장 시 합쳐진(allLPSelected) 질문을 local-(인라인 생성) / 그 외로 다시 분리 복원
        const isLocal = q => typeof q.id === 'string' && q.id.startsWith('local-');
        setLocalCustomQs(parsed.selectedQuestions.filter(isLocal));
        setSelectedQuestions(parsed.selectedQuestions.filter(q => !isLocal(q)));
      }
      if (Array.isArray(parsed.careerLevels)) setCareerLevels(parsed.careerLevels);
      if (parsed.step != null) setStep(parsed.step);
      setView('form');
    }).catch(e => console.error('[NewMission] 이어쓰기 로드 실패:', e.message));
  }

  async function handleDeleteMission() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('missions').update({ dismissed: true }).eq('id', deleteTarget);
    if (error) {
      setDeleteError('삭제 중 오류가 발생했습니다. 다시 시도해 주세요.');
      return;
    }
    setMissions(prev => prev.filter(m => m.id !== deleteTarget));
    setDeleteError('');
    setDeleteTarget(null);
  }

  async function handleTerminate() {
    if (!terminateTarget) return;
    const { error } = await supabase
      .from('missions')
      .update({ status: 'cancelled' })
      .eq('id', terminateTarget.id);
    if (error) {
      setTerminateError('종료 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      return;
    }
    setMissions(prev => prev.map(m => m.id === terminateTarget.id ? { ...m, status: 'cancelled' } : m));
    supabase.rpc('recalc_mission_consumed', { p_mission_id: terminateTarget.id })
      .then(({ error: re }) => { if (re) console.warn('[recalc]', re.message); });
    supabase.rpc('notify_early_termination', { p_mission_id: terminateTarget.id })
      .then(({ error: ne }) => { if (ne) console.warn('[notify_early_termination]', ne.message); });
    setTerminateError('');
    setTerminateTarget(null);
  }

  async function saveDraft() {
    if (!companyId) return;
    if (effectiveEditMode && !isDraftMode) return;
    setSavingDraft(true);
    try {
      const personaAgeStr = `${form.personaAgeMin}~${form.personaAgeMax}세`;
      const persona = [
        `연령: ${personaAgeStr}`,
        personaIncomeStr && `소득: ${personaIncomeStr}`,
        form.personaRole && `직군: ${form.personaRole}`,
        form.industry && `산업군: ${form.industry}`,
        form.personaContext && form.personaContext,
      ].filter(Boolean).join(' / ');
      const desc = JSON.stringify({
        briefText: form.briefText, careerLevels, selectedQuestions: allLPSelected,
        industry: form.industry, product: form.product,
        personaAge: personaAgeStr, personaIncome: personaIncomeStr,
        personaRole: form.personaRole, personaContext: form.personaContext,
        focusAreas: form.focusAreas, panels: form.panels, step,
      });
      const payload = {
        company_id: companyId, title: form.product || '임시 저장된 의뢰',
        type: 'landing_page', status: 'draft', target_url: form.lpUrl || null,
        description: desc, panel_count: form.panels || 10,
        image_urls: form.imageUrls, assets: form.focusAreas, persona,
      };
      if (effectiveEditMode && effectiveEditId) {
        await supabase.from('missions').update(payload).eq('id', effectiveEditId);
      } else {
        await supabase.from('missions').insert({ id: missionUuid, ...payload });
        clearLocalDraft();  // DB draft가 진실 원천이 되므로 localStorage 자동저장본 제거 (배너 중복 방지)
      }
    } catch (e) {
      console.error('[NewMission] 임시 저장 실패:', e.message);
      setSavingDraft(false);
      throw e;
    }
    setSavingDraft(false);
  }

  const buildDescription = () => {
    const base = { briefText: form.briefText, careerLevels };
    if (allLPSelected.length > 0)    base.selectedQuestions = allLPSelected;
    if (form.industry)               base.industry          = form.industry;
    if (form.product)                base.product           = form.product;
    if (form.lpUrl)                  base.lpUrl             = form.lpUrl;
    if (form.focusAreas?.length > 0) base.focusAreas        = form.focusAreas;
    base.personaAge = `${form.personaAgeMin}~${form.personaAgeMax}세`;
    if (personaIncomeStr)            base.personaIncome     = personaIncomeStr;
    if (form.personaRole)            base.personaRole       = form.personaRole;
    if (form.personaContext)         base.personaContext    = form.personaContext;
    return JSON.stringify(base);
  };

  // 무료 체험 자격: free_trial 플랜 + 아직 미사용 (메인 의뢰 한정)
  const freeTrialAvailable = companyPlan === 'free_trial' && !companyFreeTrialUsed;
  // active 의뢰 수정은 등록 시 이미 크레딧이 예약(차감)돼 있어 제출 시 추가 차감이 없음
  // → 크레딧 부족 게이트·경고 비활성 (신규 등록·draft 활성화 경로에서만 차감 발생)
  const creditsChargedOnSubmit = !effectiveEditMode || isDraftMode;

  const handleSubmit = async () => {
    if (teamRole === 'viewer') return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!companyId) throw new Error('company not found');
      const company = { id: companyId };

      const persona = [
        `연령: ${form.personaAgeMin}~${form.personaAgeMax}세`,
        personaIncomeStr && `소득: ${personaIncomeStr}`,
        form.personaRole && `직군: ${form.personaRole}`,
        form.industry && `산업군: ${form.industry}`,
        form.personaContext && form.personaContext,
      ].filter(Boolean).join(' / ');

      const description = buildDescription();

      if (effectiveEditMode && effectiveEditId) {
        const submitPanels = freeTrialAvailable ? Math.min(form.panels, 10) : form.panels;
        const updatePayload = {
          title:         form.product || '의뢰',
          target_url:    form.lpUrl,
          description,
          persona,
          panel_count:   submitPanels,
          reward_amount: calcPanelPayout(careerLevels, 'main'),
          assets:        form.focusAreas,
          image_urls:    form.imageUrls,
        };
        if (isDraftMode) {
          if (freeTrialAvailable) {
            // 무료 체험 draft 활성화: create_free_trial_mission 이 status='active' 설정
            const unlockCost = calcCredits(submitPanels, careerLevels, 'main');
            const { data: ftData, error: ftErr } = await supabase.rpc('create_free_trial_mission', {
              p_mission_id:  effectiveEditId,
              p_company_id:  company.id,
              p_unlock_cost: unlockCost,
            });
            if (ftErr || !ftData?.success) {
              throw new Error(
                ftData?.error === 'TRIAL_ALREADY_USED'
                  ? '무료 체험은 1회만 가능합니다.'
                  : '무료 체험 의뢰 등록 중 오류가 발생했습니다.'
              );
            }
          } else {
            const requiredCredits = calcCredits(form.panels, careerLevels, 'main');
            const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
              p_mission_id: effectiveEditId,
              p_company_id: company.id,
              p_credits:    requiredCredits,
            });
            if (creditErr || !creditData?.success) {
              throw new Error(
                creditData?.error === 'INSUFFICIENT_CREDITS'
                  ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
                  : '크레딧 처리 중 오류가 발생했습니다.'
              );
            }
            updatePayload.status = 'active';
          }
        }
        const { error } = await supabase.from('missions').update(updatePayload).eq('id', effectiveEditId);
        if (error) throw error;
      } else {
        // 무료 체험은 패널 10명 상한
        const submitPanels = freeTrialAvailable ? Math.min(form.panels, 10) : form.panels;
        const { error } = await supabase.from('missions').insert({
          id:                missionUuid,
          company_id:        company.id,
          title:             form.product || '의뢰',
          type:              'landing_page',
          target_url:        form.lpUrl,
          description,
          persona,
          panel_count:       submitPanels,
          reward_amount:     calcPanelPayout(careerLevels, 'main'),
          status:            'draft',
          assets:            form.focusAreas,
          image_urls:        form.imageUrls,
          estimated_minutes: form.estimatedMinutes,
        });
        if (error) throw error;

        if (freeTrialAvailable) {
          // 무료 체험: 크레딧 선차감 없이 active 전환 + 언락 비용(정상 의뢰 크레딧) 스냅샷
          const unlockCost = calcCredits(submitPanels, careerLevels, 'main');
          const { data: ftData, error: ftErr } = await supabase.rpc('create_free_trial_mission', {
            p_mission_id:  missionUuid,
            p_company_id:  company.id,
            p_unlock_cost: unlockCost,
          });
          if (ftErr || !ftData?.success) {
            await supabase.from('missions').delete().eq('id', missionUuid);
            throw new Error(
              ftData?.error === 'TRIAL_ALREADY_USED'
                ? '무료 체험은 1회만 가능합니다.'
                : '무료 체험 의뢰 등록 중 오류가 발생했습니다.'
            );
          }
        } else {
          // 크레딧 예약 — 성공 후에만 active 전환 (트리거 조기 발화 방지)
          const requiredCredits = calcCredits(form.panels, careerLevels, 'main');
          const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
            p_mission_id: missionUuid,
            p_company_id: company.id,
            p_credits:    requiredCredits,
          });
          if (creditErr || !creditData?.success) {
            await supabase.from('missions').delete().eq('id', missionUuid);
            throw new Error(
              creditData?.error === 'INSUFFICIENT_CREDITS'
                ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
                : '크레딧 처리 중 오류가 발생했습니다.'
            );
          }
          const { error: activateErr } = await supabase.from('missions').update({ status: 'active' }).eq('id', missionUuid);
          if (activateErr) {
            await supabase.from('missions').delete().eq('id', missionUuid);
            throw activateErr;
          }
        }
      }
      clearLocalDraft();
      navigate('/company');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const ph = INDUSTRY_PLACEHOLDERS[form.industry] || DEFAULT_PLACEHOLDERS;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 760, animation: 'fadeUp 0.5s ease both' }}>

      {/* ── 목록 뷰 ── */}
      {view === 'list' && (
        <div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>MAIN MISSION</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>마케팅 소재 종합 진단</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              랜딩페이지, 광고 소재, 배너 등을 실제 타겟 패널이 종합적으로 진단합니다.
            </p>
          </div>

          <Card style={{ marginBottom: 24, padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { icon: '🖼', title: '이미지 최대 3장', desc: '랜딩페이지, 광고 소재, 배너 등 최대 3장 업로드' },
                { icon: '📐', title: '영역 어노테이션', desc: '패널이 이미지 위에 직접 영역을 지정해 피드백 제공' },
                { icon: '📊', title: '5대 지표 정량 평가', desc: '명확성 / 관련성 / 가치 / 차별화 / 신뢰 항목별 점수' },
                { icon: '❓', title: '추가 질문 설정', desc: '최대 5개의 커스텀 질문을 추가로 설정 가능' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 작성 중이던 의뢰 복원 배너 (새로고침/크래시 후) */}
          {restorable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px', marginBottom: 16, background: 'rgba(16,54,125,0.06)', border: '1px solid rgba(16,54,125,0.25)', borderRadius: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>✏️</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>작성 중이던 의뢰가 있습니다</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {restorable.form?.product ? `“${restorable.form.product}” ` : ''}이어서 작성하거나 새로 시작할 수 있습니다.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn size="sm" onClick={restoreLocalDraft}>이어서 작성 →</Btn>
                <Btn size="sm" variant="secondary" onClick={discardLocalDraft}>새로 시작</Btn>
              </div>
            </div>
          )}

          {/* 버튼 + 탭 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Btn size="sm" onClick={() => { resetForm(); setView('form'); }}>+ 새 의뢰 등록하기</Btn>
          </div>
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
            {[['all','전체'],['active','진행'],['completed','완료'],['draft','임시 저장'],['cancelled','취소']].map(([v, l]) => (
              <button key={v} onClick={() => { setListFilter(v); setListPage(1); }} style={{
                padding: '7px 14px', marginBottom: -1, fontSize: 13,
                fontWeight: listFilter === v ? 700 : 500, background: 'transparent',
                color: listFilter === v ? 'var(--text)' : 'var(--text-3)',
                borderBottom: listFilter === v ? '2px solid var(--text)' : '2px solid transparent',
                border: 'none', borderRadius: 0, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>

          {loadingList ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>로딩 중...</div>
          ) : (() => {
            const filtered = listFilter === 'all' ? missions : missions.filter(m => m.status === listFilter);
            const paged = filtered.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);
            if (missions.length === 0) return (
              <Card style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 의뢰가 없습니다</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>
                  마케팅 소재를 등록하고 실제 패널의 진단을 받아보세요.
                </div>
              </Card>
            );
            return (
              <div style={{ display: 'grid', gap: 14 }}>
                {filtered.length === 0 ? (
                  <Card style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    해당 조건의 의뢰가 없습니다.
                  </Card>
                ) : (<>
                  {paged.map(m => {
                  const isDraft = m.status === 'draft';
                  const filled = m.filled_count ?? 0;
                  const isLive = m.status === 'active' && filled >= 1;
                  const statusBadgeType = isDraft ? 'gold'
                    : m.status === 'active' ? (filled === 0 ? 'gray' : 'green')
                    : m.status === 'completed' ? 'blue' : 'red';
                  const statusBadgeLabel = isDraft ? '임시 저장'
                    : m.status === 'active' ? (filled === 0 ? '매칭 대기' : '진행 중')
                    : m.status === 'completed' ? '완료' : '취소';
                  return (
                    <Card key={m.id} style={{ cursor: 'pointer', border: isDraft ? '1px dashed #f59e0b' : undefined }}
                      onClick={() => {
                        if (isDraft) openDraftOrActiveForEdit(m.id);
                        else if (m.status === 'active') {
                          if (activeToastTimerRef.current) clearTimeout(activeToastTimerRef.current);
                          setActiveToast('피드백은 의뢰 완료 후 확인할 수 있습니다.');
                          activeToastTimerRef.current = setTimeout(() => setActiveToast(null), 2500);
                        } else if (m.status === 'cancelled' && !m.company_notified_at) {
                          if (activeToastTimerRef.current) clearTimeout(activeToastTimerRef.current);
                          setActiveToast('피드백 검토 완료 후 피드백 결과에서 확인할 수 있습니다.');
                          activeToastTimerRef.current = setTimeout(() => setActiveToast(null), 2500);
                        } else {
                          navigate(`/company/results?id=${m.id}`, { replace: true });
                        }
                      }}>
                      <div className="mc-row">
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
                            <Badge type={statusBadgeType}>{statusBadgeLabel}</Badge>
                            {isLive && (
                              <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                                🔒 수정 잠금
                              </span>
                            )}
                            {m.is_free_trial && <Badge type="gold">🎁 체험 의뢰</Badge>}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{m.title || '마케팅 소재 종합 진단'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {new Date(m.created_at).toLocaleDateString('ko-KR')} · {filled}/{m.panel_count || 0}명 응답
                          </div>
                        </div>
                        <div className="mc-right">
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>피드백 수집</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                            {filled}<span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}> / {m.panel_count || 0}</span>
                          </div>
                          <div style={{ width: 80, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${m.panel_count ? Math.min((filled / m.panel_count) * 100, 100) : 0}%`, height: '100%', background: isLive ? '#ef4444' : 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {new Date(m.created_at).toLocaleDateString('ko-KR')} 등록
                          </div>
                          {isDraft && (
                            <button onClick={e => { e.stopPropagation(); openDraftOrActiveForEdit(m.id); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', background: 'rgba(16,54,125,0.07)', color: 'var(--text-2)', cursor: 'pointer' }}>
                              이어 작성하기 →
                            </button>
                          )}
                          {m.status === 'active' && filled === 0 && (
                            <button onClick={e => { e.stopPropagation(); openDraftOrActiveForEdit(m.id); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: '#F1F5F9', color: 'var(--text-2)', cursor: 'pointer', transition: 'background 0.12s' }}>
                              수정
                            </button>
                          )}
                          {m.status === 'active' && filled >= 1 && (
                            <button onClick={e => { e.stopPropagation(); setTerminateTarget(m); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', transition: 'background 0.12s' }}>
                              의뢰 조기 종료
                            </button>
                          )}
                          {(isDraft || m.status === 'completed' || m.status === 'cancelled') && (
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(m.id); }}
                              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                  <Pagination page={listPage} total={filtered.length} onPage={setListPage} />
                </>)}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 등록 폼 뷰 ── */}
      {view === 'form' && (
        <>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>{effectiveEditMode ? 'EDIT MISSION' : 'NEW MISSION'}</div>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>{effectiveEditMode ? '의뢰 수정' : '마케팅 소재 종합 진단 등록'}</h1>
          </div>

          {/* 무료 체험 배너 */}
          {freeTrialAvailable && (
            <div style={{
              padding: '18px 22px', marginBottom: 16, borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(16,54,125,0.10), rgba(16,54,125,0.04))',
              border: '1.5px solid var(--accent)',
            }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
                🎁 무료 체험 의뢰 · 크레딧 차감 없음
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                첫 의뢰는 무료로 전문가 패널 검증을 받아보세요. 결과 화면에서 <strong>5축 점수와 피드백 2건</strong>이 무료 공개되며,
                나머지 피드백은 크레딧 충전 후 잠금 해제할 수 있습니다. (패널 10명 · 주니어·미들)
              </div>
            </div>
          )}

          {/* 뷰어 차단 배너 */}
          {teamRole === 'viewer' && (
            <div style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.07)', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
              🔒 열람 전용 권한입니다. 의뢰 등록은 편집자(Editor) 이상만 가능합니다.
            </div>
          )}

          {/* NDA 안내 배너 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', marginBottom: 10,
            background: '#fff', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
            평가 참가 패널은 기업의 정보를 외부에 발설할 수 없습니다.
          </div>
          {/* 패널 매칭 안내 배너 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', marginBottom: 28,
            background: '#fff', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
            의뢰 조건에 맞는 패널이 자동으로 매칭됩니다.
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STEPS.length - 1 ? 'flex-end' : 'center', gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--surface)',
                  color: i <= step ? '#fff' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 700, border: '1px solid',
                  borderColor: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.2s',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === step ? 'var(--text)' : 'var(--text-3)', fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>

          <Card>
            {/* Step 0: 서비스 정보 & 타겟 페르소나 */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>서비스 정보 & 타겟 페르소나</h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>검증할 서비스와 서비스 타겟에 대해 설정합니다.</p>
                {/* 산업군 선택 */}
                <div>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>산업군</span>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setIndustryOpen(o => !o)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: form.industry ? 'var(--text)' : 'var(--text-3)', textAlign: 'left',
                      }}
                    >
                      <span>{form.industry || '산업군을 선택하세요'}</span>
                      <span style={{ transition: 'transform 0.2s', transform: industryOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', color: 'var(--text-3)', fontSize: 11 }}>▼</span>
                    </button>
                    {industryOpen && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: 14, background: 'var(--bg)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {INDUSTRIES.map(ind => (
                            <button
                              key={ind} type="button"
                              onClick={() => { set('industry', ind); setIndustryCustomMode(false); setIndustryOpen(false); }}
                              style={{
                                padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                                background: form.industry === ind ? 'var(--accent)' : 'var(--surface-2)',
                                color: form.industry === ind ? '#fff' : 'var(--text-2)',
                                border: '1px solid ' + (form.industry === ind ? 'var(--accent)' : 'var(--border)'),
                                transition: 'all 0.12s',
                              }}
                            >{ind}</button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setIndustryCustomMode(m => !m)}
                            style={{
                              padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                              background: industryCustomMode ? 'var(--blue)' : 'var(--surface-2)',
                              color: industryCustomMode ? '#fff' : 'var(--text-2)',
                              border: '1px solid ' + (industryCustomMode ? 'var(--blue)' : 'var(--border)'),
                              transition: 'all 0.12s',
                            }}
                          >✏️ 직접 쓰기</button>
                        </div>
                        {industryCustomMode && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <input
                              value={industryCustomInput}
                              onChange={e => setIndustryCustomInput(e.target.value)}
                              placeholder="산업군을 직접 입력하세요"
                              style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && industryCustomInput.trim()) {
                                  set('industry', industryCustomInput.trim());
                                  setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput('');
                                }
                              }}
                            />
                            <Btn size="sm" onClick={() => {
                              if (industryCustomInput.trim()) {
                                set('industry', industryCustomInput.trim());
                                setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput('');
                              }
                            }}>확인</Btn>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <label style={lbl}>
                  <span style={lblTxt}>검증할 서비스명(의뢰명)</span>
                  <input value={form.product} onChange={e => set('product', e.target.value)} placeholder={ph.product} />
                </label>
                <label style={lbl}>
                  <span style={lblTxt}>랜딩페이지 URL (선택)</span>
                  <input value={form.lpUrl} onChange={e => set('lpUrl', e.target.value)} placeholder="https://your-landing-page.com" />
                </label>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text-2)' }}>타겟 페르소나</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 연령대 듀얼 슬라이더 */}
                    <div style={lbl}>
                      <span style={lblTxt}>연령대</span>
                      <div style={{ marginTop: 8, padding: '14px 16px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{form.personaAgeMin}세</span>
                          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>~</span>
                          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{form.personaAgeMax}세</span>
                        </div>
                        <DualRangeSlider min={AGE_MIN} max={AGE_MAX} step={5}
                          valueMin={form.personaAgeMin} valueMax={form.personaAgeMax}
                          onChangeMin={(v) => set('personaAgeMin', v)} onChangeMax={(v) => set('personaAgeMax', v)} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                          <span>10세</span><span>40세</span><span>70세</span>
                        </div>
                      </div>
                    </div>
                    {/* 월 소득 수준 듀얼 슬라이더 + 특수 타겟 체크박스 */}
                    <div style={lbl}>
                      <span style={lblTxt}>월 소득 수준</span>
                      <div style={{ marginTop: 8, padding: '14px 16px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
                          {incomeOverride ? (
                            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{personaIncomeStr}</span>
                          ) : (
                            <>
                              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{incomeHandleLabel(form.personaIncomeMin)}</span>
                              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>~</span>
                              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{incomeHandleLabel(form.personaIncomeMax)}</span>
                            </>
                          )}
                        </div>
                        <div style={{ opacity: incomeOverride ? 0.4 : 1, pointerEvents: incomeOverride ? 'none' : 'auto', transition: 'opacity 0.15s' }}>
                          <DualRangeSlider min={INCOME_MIN_IDX} max={INCOME_MAX_IDX} step={1}
                            valueMin={form.personaIncomeMin} valueMax={form.personaIncomeMax}
                            onChangeMin={(v) => set('personaIncomeMin', v)} onChangeMax={(v) => set('personaIncomeMax', v)} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                            <span>100만</span><span>500만</span><span>1,000만+</span>
                          </div>
                        </div>
                        {/* 특수 타겟 체크박스 — 선택 시 슬라이더 리셋·비활성 */}
                        <div style={{ display: 'flex', gap: 18, marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                          {[{ key: 'personaIncomeHigh', label: '1억 이상' }, { key: 'personaIncomeBiz', label: '기업 고객' }].map(({ key, label }) => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', userSelect: 'none' }}>
                              <input type="checkbox" checked={form[key]} onChange={() => toggleIncomeFlag(key)}
                                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                              {label}
                            </label>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>
                          {incomeOverride ? personaIncomeStr : (personaIncomeStr ? `월 ${personaIncomeStr}` : '소득 무관 (전체)')}
                        </div>
                      </div>
                    </div>
                    <label style={lbl}>
                      <span style={lblTxt}>직군/역할</span>
                      <input value={form.personaRole} onChange={e => set('personaRole', e.target.value)} placeholder={ph.personaRole} />
                    </label>
                    <label style={lbl}>
                      <span style={lblTxt}>타겟 상세 (선택)</span>
                      <textarea value={form.personaContext} onChange={e => set('personaContext', e.target.value)}
                        placeholder={ph.personaContext}
                        rows={3} style={{ resize: 'vertical' }} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: 소재 업로드 */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>소재 & 검증 범위</h2>
                <label style={lbl}>
                  <span style={lblTxt}>검증 포커스 (복수 선택)</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {FOCUS.map(f => (
                      <button key={f} onClick={() => toggleFocus(f)} style={{
                        padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
                        background: form.focusAreas.includes(f) ? 'var(--accent)' : 'var(--surface-2)',
                        color: form.focusAreas.includes(f) ? '#FFFFFF' : 'var(--text-2)',
                        border: '1px solid ' + (form.focusAreas.includes(f) ? 'var(--accent)' : 'var(--border)'),
                        transition: 'all 0.15s', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { if (!form.focusAreas.includes(f)) e.currentTarget.style.background = 'var(--bg-3)'; }}
                      onMouseLeave={e => { if (!form.focusAreas.includes(f)) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      >
                        {f}
                      </button>
                    ))}
                    {/* 커스텀 기타 항목 — focusAreas에 있지만 FOCUS 배열에 없는 항목들 */}
                    {form.focusAreas.filter(f => !FOCUS.includes(f)).map(f => (
                      <button key={f} onClick={() => toggleFocus(f)} style={{
                        padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
                        background: 'var(--accent)', color: '#FFFFFF',
                        border: '1px solid var(--accent)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {f}
                        <span style={{ fontSize: 10, opacity: 0.8 }}>×</span>
                      </button>
                    ))}
                    {/* 기타 추가 버튼 */}
                    {!focusCustomMode ? (
                      <button onClick={() => setFocusCustomMode(true)} style={{
                        padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500,
                        background: 'var(--surface-2)', color: 'var(--text-3)',
                        border: '1px dashed var(--border)', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-3)'; }}
                      >
                        ✏️ 기타
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          autoFocus
                          value={focusCustomInput}
                          onChange={e => setFocusCustomInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = focusCustomInput.trim();
                              if (val && !form.focusAreas.includes(val)) toggleFocus(val);
                              setFocusCustomInput('');
                              setFocusCustomMode(false);
                            } else if (e.key === 'Escape') {
                              setFocusCustomInput('');
                              setFocusCustomMode(false);
                            }
                          }}
                          placeholder="직접 입력 후 Enter"
                          style={{
                            padding: '5px 10px', borderRadius: 'var(--radius)', fontSize: 12,
                            border: '1px solid var(--accent)', outline: 'none',
                            width: 160, color: 'var(--text)',
                          }}
                        />
                        <button onClick={() => {
                          const val = focusCustomInput.trim();
                          if (val && !form.focusAreas.includes(val)) toggleFocus(val);
                          setFocusCustomInput('');
                          setFocusCustomMode(false);
                        }} style={{
                          padding: '5px 10px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                          background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                        }}>
                          추가
                        </button>
                        <button onClick={() => { setFocusCustomInput(''); setFocusCustomMode(false); }} style={{
                          padding: '5px 8px', borderRadius: 'var(--radius)', fontSize: 12,
                          background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)', cursor: 'pointer',
                        }}>
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                </label>

                {/* 이미지 업로드 */}
                <label style={lbl}>
                  <span style={lblTxt}>검증 이미지 업로드 (선택 · 최대 {MAX_IMAGES}장 · 20MB 이하)</span>
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                    padding: '20px', textAlign: 'center',
                    background: form.imageUrls.length >= MAX_IMAGES ? 'var(--surface-2)' : 'var(--surface)',
                  }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={uploading || form.imageUrls.length >= MAX_IMAGES}
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || form.imageUrls.length >= MAX_IMAGES}
                    >
                      {uploading ? '업로드 중...' : '이미지 선택'}
                    </Btn>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                      {form.imageUrls.length >= MAX_IMAGES
                        ? '최대 장수에 도달했습니다.'
                        : '이미지를 업로드하면 패널이 영역을 드래그해 항목별 피드백을 남깁니다.'}
                    </div>
                    {uploadError && (
                      <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{uploadError}</div>
                    )}
                  </div>

                  {form.imageUrls.length > 0 && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      {form.imageUrls.map((url, i) => (
                        <div key={url} style={{ position: 'relative' }}>
                          <img
                            src={url}
                            alt={`업로드 ${i + 1}`}
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                          />
                          <button
                            onClick={() => removeImage(url)}
                            style={{
                              position: 'absolute', top: -6, right: -6,
                              width: 20, height: 20, borderRadius: '50%',
                              background: 'var(--red)', color: '#fff',
                              border: 'none', fontSize: 13, lineHeight: 1,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </label>

                <label style={lbl}>
                  <span style={lblTxt}>패널에게 전달할 브리핑</span>
                  <textarea value={form.briefText} onChange={e => set('briefText', e.target.value)}
                    placeholder={ph.briefText}
                    rows={4} style={{ resize: 'vertical' }} />
                </label>
              </div>
            )}

            {/* Step 2: 질문 설정 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>질문 설정</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      패널에게 추가로 물을 질문을 최대 5개 선택하세요. 선택하지 않으면 기본 5대 지표 피드백만 수집됩니다.
                    </p>
                  </div>
                  <div style={{
                    flexShrink: 0,
                    fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 700,
                    padding: '4px 12px', borderRadius: 20,
                    background: totalLPSelected >= 5 ? 'var(--accent)' : 'var(--surface)',
                    color: totalLPSelected >= 5 ? '#fff' : 'var(--text-2)',
                    border: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>
                    {totalLPSelected}/5 선택됨
                  </div>
                </div>

                {/* 서술형 한도 안내 */}
                {textLPSelected >= 2 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--red)' }}>
                    서술형 질문은 최대 2개까지 선택할 수 있습니다.
                  </div>
                )}

                {/* 내 커스텀 질문 그룹 (DB 저장 LP 질문) */}
                {customLPQs.length > 0 && (() => {
                  const custSelected = customLPQs.filter(q => selectedQuestions.some(s => s.id === q.id));
                  const isOpen = !!expandedTmpl['__custom_lp__'];
                  return (
                    <div style={{ border: '2px solid var(--accent)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedTmpl(prev => ({ ...prev, '__custom_lp__': !isOpen }))}
                        style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', cursor: 'pointer', userSelect: 'none', gap: 10 }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>✏️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>내 커스텀 질문</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>질문 템플릿 페이지에서 저장한 마케팅 소재 종합 진단용 질문</div>
                        </div>
                        {custSelected.length > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginRight: 4 }}>
                            {custSelected.length}개 선택
                          </span>
                        )}
                        <span style={{ color: 'var(--text-3)', fontSize: 11, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {customLPQs.map((q, qi) => {
                            const isChecked = selectedQuestions.some(s => s.id === q.id);
                            const disabled  = !isChecked && !canAddLPQ(q);
                            return (
                              <div
                                key={q.id}
                                onClick={() => !disabled && toggleLPQuestion(q)}
                                style={{
                                  display: 'flex', gap: 12, alignItems: 'flex-start',
                                  padding: '11px 16px',
                                  background: 'var(--surface)',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  opacity: disabled ? 0.4 : 1,
                                  borderBottom: qi < customLPQs.length - 1 ? '1px solid var(--border)' : 'none',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <div style={{
                                  width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                  border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isChecked ? 'var(--accent)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{q.text}</div>
                                  <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>
                                      {TYPE_LABEL[q.type]}
                                    </span>
                                    {q.type === 'radio' && q.options?.length > 0 && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.options.join(' / ')}</span>
                                    )}
                                    {q.type === 'scale' && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>1 — 5점</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 템플릿 아코디언 (섹션 구분) */}
                {(() => {
                  const groups = [];
                  let curLabel = undefined;
                  lpTemplates.forEach(tmpl => {
                    const label = tmpl.sectionLabel || null;
                    if (label !== curLabel) { curLabel = label; groups.push({ label, items: [] }); }
                    groups[groups.length - 1].items.push(tmpl);
                  });
                  return groups.map((group, gi) => (
                    <div key={gi}>
                      {group.label && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: gi === 0 ? 0 : 10, marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {group.label}
                          </div>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {group.items.map(tmpl => {
                  const isOpen = !!expandedTmpl[tmpl.id];
                  const selectedInTmpl = tmpl.questions.filter(q => selectedQuestions.some(s => s.id === q.id));
                  return (
                    <div key={tmpl.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedTmpl(prev => ({ ...prev, [tmpl.id]: !isOpen }))}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '12px 16px',
                          background: 'var(--surface)',
                          cursor: 'pointer', userSelect: 'none', gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{tmpl.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{tmpl.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{tmpl.description}</div>
                        </div>
                        {selectedInTmpl.length > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginRight: 4 }}>
                            {selectedInTmpl.length}개 선택
                          </span>
                        )}
                        <span style={{
                          color: 'var(--text-3)', fontSize: 11,
                          transition: 'transform 0.2s',
                          display: 'inline-block',
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                        }}>▶</span>
                      </div>

                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {tmpl.questions.map((q, qi) => {
                            const isChecked = selectedQuestions.some(s => s.id === q.id);
                            const disabled  = !isChecked && !canAddLPQ(q);
                            return (
                              <div
                                key={q.id}
                                onClick={() => !disabled && toggleLPQuestion(q)}
                                style={{
                                  display: 'flex', gap: 12, alignItems: 'flex-start',
                                  padding: '11px 16px',
                                  background: 'var(--surface)',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  opacity: disabled ? 0.4 : 1,
                                  borderBottom: qi < tmpl.questions.length - 1 ? '1px solid var(--border)' : 'none',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <div style={{
                                  width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                  border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isChecked ? 'var(--accent)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{q.text}</div>
                                  <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{
                                      fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600,
                                      background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type],
                                    }}>
                                      {TYPE_LABEL[q.type]}
                                    </span>
                                    {q.type === 'radio' && q.options.length > 0 && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                        {q.options.join(' / ')}
                                      </span>
                                    )}
                                    {q.type === 'scale' && (
                                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>1 — 5점</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                      </div>
                    </div>
                  ));
                })()}

                {/* 질문 만들기 */}
                <div style={{ marginTop: 14, border: `1px solid ${localCustomQs.length > 0 ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px 14px 10px', transition: 'border-color 0.2s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>질문 만들기</span>
                    {localCustomQs.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>+{localCustomQs.length}개 추가됨</span>
                    )}
                  </div>
                  <textarea value={newQText} onChange={e => setNewQText(e.target.value)} rows={2}
                    placeholder="질문을 입력하세요"
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[['radio', '옵션형'], ['scale', '점수형'], ['text', '서술형']].map(([t, label]) => (
                      <button key={t} onClick={() => setNewQType(t)} style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${newQType === t ? 'var(--accent)' : 'var(--border)'}`,
                        background: newQType === t ? 'var(--accent)' : 'var(--surface)',
                        color: newQType === t ? '#fff' : 'var(--text-2)',
                      }}>{label}</button>
                    ))}
                  </div>
                  {newQType === 'radio' && (
                    <div style={{ marginBottom: 8 }}>
                      {newQOptions.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <input value={opt} onChange={e => setNewQOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                            placeholder={`옵션 ${i + 1}`}
                            style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                          {newQOptions.length > 2 && (
                            <button onClick={() => setNewQOptions(prev => prev.filter((_, j) => j !== i))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16 }}>×</button>
                          )}
                        </div>
                      ))}
                      {newQOptions.length < 6 && (
                        <button onClick={() => setNewQOptions(prev => [...prev, ''])}
                          style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
                          + 옵션 추가
                        </button>
                      )}
                    </div>
                  )}
                  {newQType === 'scale' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <input value={newQScaleMin} onChange={e => setNewQScaleMin(e.target.value)}
                        placeholder="1점 라벨 (예: 매우 아니다)"
                        style={{ flex: 1, minWidth: 140, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {[1,2,3,4,5].map(n => <span key={n} style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, border: '1px solid var(--accent)', color: 'var(--text-2)' }}>{n}</span>)}
                      </span>
                      <input value={newQScaleMax} onChange={e => setNewQScaleMax(e.target.value)}
                        placeholder="5점 라벨 (예: 매우 그렇다)"
                        style={{ flex: 1, minWidth: 140, fontFamily: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }} />
                    </div>
                  )}
                  {newQType === 'text' && textLPSelected >= 2 && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>서술형 질문은 최대 2개까지만 추가할 수 있습니다.</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Btn size="sm" onClick={handleAddLocalQ}
                      disabled={!newQText.trim() || totalLPSelected >= 5 || (newQType === 'text' && textLPSelected >= 2)}>추가</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setShowSaveModal(true)} disabled={!newQText.trim()}>템플릿에 저장 →</Btn>
                  </div>
                  {localCustomQs.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>✓</span>
                        추가된 질문 목록
                      </div>
                      {localCustomQs.map((q, i) => (
                        <div key={q.id} style={{
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          padding: '10px 12px', background: 'var(--surface)',
                          borderRadius: 'var(--radius)', border: '1px solid var(--accent)',
                          borderLeft: '3px solid var(--accent)', marginBottom: 6,
                        }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)', borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                            <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>{TYPE_LABEL[q.type]}</span>
                              {q.type === 'radio' && q.options?.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>}
                              {q.type === 'scale' && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'} · 1~5 · {q.options?.[1] || '매우 그렇다'}</span>}
                            </div>
                          </div>
                          <button onClick={() => setLocalCustomQs(prev => prev.filter(lq => lq.id !== q.id))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 선택된 질문 미리보기 */}
                {allLPSelected.length > 0 && (
                  <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 10, letterSpacing: '0.05em' }}>선택된 질문 ({allLPSelected.length}개)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {allLPSelected.map((q, i) => (
                        <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, flex: 1 }}>{q.text}</span>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                            background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type],
                          }}>
                            {TYPE_LABEL[q.type]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {allLPSelected.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
                    위 템플릿에서 질문을 선택하거나, 건너뛰기하면 기본 5대 지표 피드백만 수집됩니다.
                  </div>
                )}
              </div>
            )}

            {/* Step 3: 패널 설정 */}
            {step === 3 && (
              <PanelTargetStep
                ref={panelStepRef}
                plan={companyPlan}
                panelCount={form.panels}
                onPanelCount={(n) => set('panels', n)}
                careerLevels={careerLevels}
                onCareerLevels={setCareerLevels}
                missionType="main"
                creditBalance={creditBalance}
                addonBalance={creditAddon}
                companyId={companyId}
                onCreditBalanceUpdate={(newBal) => { setCreditAddon(a => a + Math.max(0, newBal - (creditBalance || 0))); setCreditBalance(newBal); }}
                onSaveDraft={saveDraft}
                freeTrialAvailable={freeTrialAvailable}
                chargeOnSubmit={creditsChargedOnSubmit}
              />
            )}

            {/* Step 4: 검토 & 제출 */}
            {step === 4 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>최종 검토</h2>
                {[
                  ['제품/서비스', form.product || '—'],
                  ['LP URL', form.lpUrl || '—'],
                  ['타겟 페르소나', `${form.personaAgeMin}~${form.personaAgeMax}세, ${personaIncomeStr || '소득 무관'}, ${form.personaRole || '—'}`],
                  ['패널 수', `${form.panels}명`],
                  ['커리어 레벨', careerLevels.map(k => CAREER_LEVELS.find(c => c.key === k)?.label).filter(Boolean).join(', ') || '—'],
                  ['예상 크레딧', `${calcCredits(form.panels, careerLevels, 'main')} 크레딧`],
                  ['검증 포커스', form.focusAreas.join(', ') || '—'],
                  ...(allLPSelected.length > 0 ? [['추가 질문', `${allLPSelected.length}개 선택`]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 140, color: 'var(--text-3)', fontSize: 13, flexShrink: 0 }}>{k}</span>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
                {form.imageUrls.length > 0 && (
                  <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 140, color: 'var(--text-3)', fontSize: 13, flexShrink: 0 }}>업로드 이미지</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {form.imageUrls.map((url, i) => (
                        <img key={url} src={url} alt={`이미지 ${i + 1}`}
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 24, padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  ⚡ 의뢰 등록 후 패널이 매칭되어 피드백을 시작합니다. Purit Filter를 통과한 피드백만 전달됩니다.
                </div>
                <div style={{ marginTop: 10, padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', lineHeight: 1.75 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠️ 수정 가능 시점 안내 (제출 전 반드시 확인)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <span style={{ display: 'block', marginBottom: 4 }}>
                      ✅ <strong>제출 직후 ~ 첫 피드백 수신 전</strong>: 대시보드 의뢰 카드에서 수정 가능
                    </span>
                    <span style={{ display: 'block', color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
                      🔒 <strong>첫 피드백 수신 즉시</strong>: 수정 영구 잠금 — 의뢰 조기 종료만 가능
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: '#ef4444' }}>
                      ※ 조기 종료 시 사용된 크레딧은 환불되지 않습니다.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => {
              if (step > 0) { setStep(s => s - 1); }
              else if (shouldBlockNav) { setShowDraftModal(true); }
              else if (effectiveEditMode) navigate('/company');
              else setView('list');
            }} size="md">
              {step === 0 ? (effectiveEditMode ? '취소' : '목록으로') : '이전'}
            </Btn>
            {submitError && (
              <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 8 }}>
                {submitError}
              </div>
            )}
            <Btn
              onClick={() => {
                if (!freeTrialAvailable && creditsChargedOnSubmit && step === STEPS.length - 2 && creditBalance != null && calcCredits(form.panels, careerLevels, 'main') > creditBalance) {
                  panelStepRef.current?.openCreditModal();
                  return;
                }
                step < STEPS.length - 1 ? setStep(s => s + 1) : setShowSubmitConfirm(true);
              }}
              size="md"
              disabled={teamRole === 'viewer' || submitting || uploading || !stepValid || (!freeTrialAvailable && creditsChargedOnSubmit && step === STEPS.length - 1 && creditBalance != null && calcCredits(form.panels, careerLevels, 'main') > creditBalance)}
            >
              {step === STEPS.length - 1 ? (submitting ? '처리 중...' : effectiveEditMode ? '수정 완료 →' : '의뢰 제출 →') : '다음 →'}
            </Btn>
          </div>
        </>
      )}

      {showSaveModal && (
        <ConfirmModal
          title="질문 템플릿에 저장"
          desc={"이 질문을 템플릿에 추가하겠습니까?\n저장된 질문은 이후 의뢰 등록 시 자동으로 표시됩니다."}
          confirmLabel={savingToTemplate ? '저장 중…' : '저장'}
          onConfirm={handleSaveTmpl}
          onCancel={() => { setShowSaveModal(false); setSaveTmplError(''); }}
          errorMsg={saveTmplError}
        />
      )}

      {showSubmitConfirm && (() => {
        const credits = calcCredits(form.panels, careerLevels, 'main');
        const remaining = creditBalance != null ? creditBalance - credits : null;
        // active 의뢰 수정: 등록 시 이미 크레딧이 예약돼 제출 시 추가 차감 없음 (D-128)
        const isActiveEdit = !creditsChargedOnSubmit && !freeTrialAvailable;
        return (
          <ConfirmModal
            title={isActiveEdit ? '수정 내용을 저장할까요?' : '의뢰를 제출할까요?'}
            desc={
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75 }}>
                {freeTrialAvailable ? (
                  <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, marginBottom: 12, textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, color: '#B45309', marginBottom: 6 }}>⚠️ 무료 체험 의뢰 — 제출 전 확인</div>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      <li><strong>최초 1회</strong> 의뢰 등록 무료 체험 중입니다.</li>
                      <li>결과는 패널 <strong>10명 중 2명 분만 공개</strong> 되고,<br /><strong>나머지 8명은 잠금</strong>됩니다.</li>
                      <li>전체 피드백은 <strong>크레딧 충전이나 구독 후</strong> 잠금 해제할 수 있습니다.</li>
                    </ul>
                  </div>
                ) : isActiveEdit ? (
                  <div style={{ padding: '14px 16px', background: 'rgba(16,54,125,0.06)', border: '1px solid rgba(16,54,125,0.22)', borderRadius: 8, marginBottom: 12, textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>✏️ 진행 중인 의뢰 수정</div>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      <li>등록 시 크레딧이 이미 예약되어 <strong>추가로 차감되지 않습니다.</strong></li>
                      <li>수정한 내용으로 의뢰가 갱신됩니다.</li>
                    </ul>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 12 }}>
                      <span>예상 소모 크레딧</span>
                      <strong style={{ color: 'var(--text)' }}>{Math.ceil(credits)} cr</strong>
                    </div>
                    {remaining != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 12 }}>
                        <span>제출 후 잔여 크레딧</span>
                        <strong style={{ color: remaining < 0 ? '#ef4444' : 'var(--text)' }}>{Math.floor(remaining)} cr</strong>
                      </div>
                    )}
                    {needsAddonConfirm(credits, creditBalance, creditAddon) && (() => {
                      const sp = splitCredits(creditBalance, creditAddon);
                      const useAddon = addonUsageFor(credits, creditBalance, creditAddon);
                      return (
                        <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, marginBottom: 12, textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, color: '#B45309', marginBottom: 6 }}>💳 추가 크레딧 사용 안내</div>
                          <div style={{ lineHeight: 1.7 }}>
                            이번 의뢰는 <strong>{Math.ceil(credits)}cr</strong>이 필요합니다.<br />
                            월간 크레딧 <strong>{sp.monthly}cr</strong>로는 부족해 <strong style={{ color: '#B45309' }}>추가(충전) 크레딧 {Math.ceil(useAddon)}cr</strong>이 함께 사용됩니다.<br />
                            계속 진행하시겠습니까?
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
                <div style={{ padding: '10px 14px', background: 'rgba(16,54,125,0.06)', borderRadius: 8, marginBottom: 12, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>💡 고품질 피드백을 받으려면</div>
                  <div>브리핑과 검증 포인트를 <strong>구체적으로 작성할수록</strong><br />패널이 핵심을 짚은 피드백을 제공합니다.<br />제출 전 소재 설명을 다시 한번 확인하세요.</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  ※ 첫 피드백 수신 후에는 의뢰 내용을 수정할 수 없습니다.
                </div>
              </div>
            }
            confirmLabel={isActiveEdit ? '수정 완료' : '제출하기'}
            cancelLabel="다시 확인"
            onConfirm={() => { setShowSubmitConfirm(false); handleSubmit(); }}
            onCancel={() => setShowSubmitConfirm(false)}
          />
        );
      })()}

      {terminateTarget && (
        <ConfirmModal
          title="의뢰를 조기 종료할까요?"
          desc="⚠️ 조기 종료 시 잔여 크레딧은 환불되지 않습니다. 이미 수집된 피드백 결과는 계속 확인 가능합니다."
          confirmLabel="조기 종료 (크레딧 환불 불가)"
          cancelLabel="유지"
          danger
          errorMsg={terminateError}
          onConfirm={handleTerminate}
          onCancel={() => { setTerminateTarget(null); setTerminateError(''); }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="의뢰를 삭제할까요?"
          desc={"이 의뢰를 목록에서 삭제합니다."}
          confirmLabel="삭제"
          cancelLabel="취소"
          danger
          errorMsg={deleteError}
          onConfirm={handleDeleteMission}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}

      {showDraftModal && ReactDOM.createPortal(
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '28px 24px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>작성 중인 내용이 있습니다</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
              의뢰 등록을 완료하지 않았습니다.<br />임시 저장하고 나가시겠습니까?
            </p>
            {draftSaveError && (
              <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 4 }}>
                {draftSaveError}
              </div>
            )}
            <Btn onClick={async () => {
              setDraftSaveError('');
              try {
                await saveDraft();
              } catch {
                setDraftSaveError('임시 저장에 실패했습니다. 다시 시도해 주세요.');
                return;
              }
              navigationGuard.unregister();
              setShowDraftModal(false);
              const dest = pendingNavPath;
              setPendingNavPath(null);
              if (dest && dest !== location.pathname) navigate(dest);
              else if (effectiveEditMode) navigate('/company');
              else setView('list');
            }} disabled={savingDraft}>
              {savingDraft ? '저장 중...' : '임시 저장 후 나가기'}
            </Btn>
            <Btn variant="secondary" onClick={() => {
              navigationGuard.unregister();
              clearLocalDraft();  // 자발적 폐기 → localStorage 자동저장본도 제거 (배너 재등장 방지)
              setShowDraftModal(false);
              const dest = pendingNavPath;
              setPendingNavPath(null);
              if (dest && dest !== location.pathname) navigate(dest);
              else if (effectiveEditMode) navigate('/company');
              else setView('list');
            }}>저장 없이 나가기</Btn>
            <Btn variant="ghost" onClick={() => { setShowDraftModal(false); setPendingNavPath(null); }}>계속 작성하기</Btn>
          </div>
        </div>,
        document.body
      )}
      {activeToast && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 28, left: 28, zIndex: 9999,
          background: '#fff', borderLeft: '4px solid var(--accent)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
          padding: '14px 20px', fontSize: 13, color: 'var(--text)',
          maxWidth: 300, lineHeight: 1.6,
        }}>
          {activeToast}
        </div>,
        document.body
      )}
    </div>
  );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 8 };
const lblTxt = { fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' };
