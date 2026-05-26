import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, X, CheckCircle } from 'lucide-react';

const ACCENT   = '#10367D';
const BG       = '#F8FAFC';
const BORDER   = '#E2E8F0';
const T1       = '#0F172A';
const T2       = '#4B556D';
const T3       = '#8598AA';
const GREEN    = '#059669';
const GREEN_BG = 'rgba(5,150,105,0.07)';
const RED      = '#DC2626';
const RED_BG   = 'rgba(239,68,68,0.07)';

const MAX_TEXT = 500;

function UploadZone({ accept, label, hint, file, onFile, onClear }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? ACCENT : file ? GREEN : BORDER}`,
        borderRadius: 12,
        padding: '18px 20px',
        cursor: 'pointer',
        background: dragging ? 'rgba(16,54,125,0.04)' : file ? GREEN_BG : '#fff',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }}
      />

      {file ? (
        <>
          <FileText size={22} color={GREEN} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>
              {(file.size / 1024).toFixed(0)} KB · 클릭하여 파일 교체
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 4, flexShrink: 0, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </>
      ) : (
        <>
          <Upload size={20} color={T3} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T2 }}>{label}</div>
            <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>{hint}</div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionCard({ children, style }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: '28px 28px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  );
}

export default function PanelRegister() {
  const [certFile, setCertFile]           = useState(null);
  const [verifyMethod, setVerifyMethod]   = useState('linkedin');
  const [linkedinUrl, setLinkedinUrl]     = useState('');
  const [linkedinError, setLinkedinError] = useState('');
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [portfolioText, setPortfolioText] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [submitError, setSubmitError]     = useState('');

  const validateLinkedin = (url) => {
    if (!url.trim()) return '';
    try { new URL(url); } catch { return '올바른 URL 형식이 아닙니다.'; }
    if (!url.includes('linkedin.com/in/') && !url.includes('linkedin.com/pub/')) {
      return '링크드인 프로필 URL 형식이 맞지 않습니다. (linkedin.com/in/...)';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!certFile) {
      setSubmitError('건강보험 자격득실확인서를 업로드해 주세요.');
      return;
    }

    if (verifyMethod === 'linkedin' && linkedinUrl.trim()) {
      const err = validateLinkedin(linkedinUrl);
      if (err) { setLinkedinError(err); return; }
    }

    setSubmitting(true);
    // TODO: Supabase Storage 업로드 + panel_applications INSERT
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
  };

  // ── 제출 완료 화면 ──────────────────────────────────────
  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh', background: BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        <div style={{
          width: '100%', maxWidth: 460,
          background: '#fff', border: `1px solid ${BORDER}`,
          borderRadius: 20, padding: '52px 36px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle size={32} color={GREEN} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T1, marginBottom: 10 }}>
            신청이 완료되었습니다
          </div>
          <div style={{ fontSize: 14, color: T2, lineHeight: 1.75 }}>
            제출하신 서류를 검토 후 승인 여부를 이메일로 안내해 드립니다.<br />
            보통 <strong>1~3 영업일</strong> 내에 결과를 받아보실 수 있어요.
          </div>
          <Link to="/login" style={{
            display: 'inline-block', marginTop: 28,
            padding: '12px 32px', background: ACCENT, color: '#fff',
            borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  // ── 메인 폼 ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: BG,
      fontFamily: "'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '48px 24px 60px',
    }}>
      <Link to="/signup?role=panel" style={{
        position: 'fixed', top: 24, left: 28,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 14, color: T3, textDecoration: 'none', transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = T1}
      onMouseLeave={e => e.currentTarget.style.color = T3}
      >
        <ArrowLeft size={15} /> 이전으로
      </Link>

      <div style={{ maxWidth: 540, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em',
            fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic',
            color: T1, marginBottom: 8,
          }}>
            Purit
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T1, marginBottom: 8 }}>
            패널 가입 신청
          </div>
          <div style={{ fontSize: 14, color: T2, lineHeight: 1.6 }}>
            전문가 자격 검토 후 패널로 승인됩니다.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Section 1: 공적 경력 증명 (필수) ── */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T1 }}>공적 경력 증명</div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#fff',
                background: ACCENT, padding: '2px 8px', borderRadius: 99,
              }}>
                필수
              </span>
            </div>
            <div style={{ fontSize: 13, color: T3, marginBottom: 18 }}>
              건강보험 자격득실확인서
            </div>

            {/* 안내 박스 */}
            <div style={{
              background: 'rgba(16,54,125,0.05)',
              border: '1px solid rgba(16,54,125,0.14)',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 16,
              fontSize: 13, color: T2, lineHeight: 1.7,
            }}>
              💡 토스, 카카오톡에서 30초 만에 발급받은 자격득실확인서로 모든 직장 경력을 한 번에 인증하세요.
              <span style={{ color: T3 }}> (연차별 보상 티어 산정 기준)</span>
            </div>

            <UploadZone
              accept="image/*,application/pdf"
              label="파일 클릭 또는 드래그하여 업로드"
              hint="JPG · PNG · PDF · 최대 10MB"
              file={certFile}
              onFile={setCertFile}
              onClear={() => setCertFile(null)}
            />
          </SectionCard>

          {/* ── Section 2: 직무 역량 증명 (선택) ── */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T1 }}>직무 역량 증명</div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: T3,
                background: BG, border: `1px solid ${BORDER}`,
                padding: '2px 8px', borderRadius: 99,
              }}>
                선택
              </span>
            </div>
            <div style={{ fontSize: 13, color: T3, marginBottom: 20, lineHeight: 1.6 }}>
              마케팅 전문성을 보여줄 수 있는 자료를 선택해 주세요.
            </div>

            {/* 옵션 선택 탭 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {[
                { value: 'linkedin',  icon: '🔗', label: '링크드인 프로필' },
                { value: 'portfolio', icon: '📄', label: '포트폴리오 / 이력서' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setVerifyMethod(opt.value); setLinkedinError(''); }}
                  style={{
                    padding: '14px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: verifyMethod === opt.value
                      ? `2px solid ${ACCENT}`
                      : `1.5px solid ${BORDER}`,
                    background: verifyMethod === opt.value
                      ? 'rgba(16,54,125,0.06)'
                      : '#fff',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: verifyMethod === opt.value ? ACCENT : T1,
                  }}>
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>

            {/* ── 옵션 1: 링크드인 ── */}
            {verifyMethod === 'linkedin' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 10 }}>
                  링크드인 프로필로 1초 만에 직무 역량 인증하기
                </div>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/your-profile"
                  value={linkedinUrl}
                  onChange={e => {
                    setLinkedinUrl(e.target.value);
                    if (linkedinError) setLinkedinError('');
                  }}
                  onBlur={e => {
                    const err = validateLinkedin(e.target.value);
                    setLinkedinError(err);
                    e.target.style.borderColor = err ? RED : BORDER;
                    e.target.style.boxShadow = 'none';
                  }}
                  onFocus={e => {
                    setLinkedinError('');
                    e.target.style.borderColor = ACCENT;
                    e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.12)';
                  }}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    border: `1px solid ${linkedinError ? RED : BORDER}`,
                    fontSize: 14, fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
                {linkedinError && (
                  <div style={{ fontSize: 12, color: RED, marginTop: 6 }}>
                    {linkedinError}
                  </div>
                )}
                <div style={{ fontSize: 12, color: T3, marginTop: 8 }}>
                  프로필이 <strong>공개(Public)</strong> 상태여야 검토가 가능합니다.
                </div>
              </div>
            )}

            {/* ── 옵션 2: 포트폴리오 / 이력서 ── */}
            {verifyMethod === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 2 }}>
                    링크드인이 없으신가요? 이력서나 주요 프로젝트를 요약해 주세요.
                  </div>
                  <div style={{ fontSize: 12, color: T3, marginBottom: 14 }}>
                    아래 중 하나만 제출하셔도 됩니다.
                  </div>

                  {/* PDF 업로드 */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 8 }}>
                    이력서 / 포트폴리오 PDF
                  </div>
                  <UploadZone
                    accept="application/pdf"
                    label="PDF 파일 업로드"
                    hint="PDF · 최대 20MB"
                    file={portfolioFile}
                    onFile={setPortfolioFile}
                    onClear={() => setPortfolioFile(null)}
                  />
                </div>

                {/* 구분선 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                  <span style={{ fontSize: 12, color: T3, flexShrink: 0 }}>또는</span>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                </div>

                {/* 텍스트 입력 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T2 }}>
                      다룰 줄 아는 마케팅 툴 및 주요 성과
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: portfolioText.length > MAX_TEXT * 0.9 ? '#F59E0B' : T3,
                      transition: 'color 0.15s',
                    }}>
                      {portfolioText.length} / {MAX_TEXT}
                    </div>
                  </div>
                  <textarea
                    placeholder={`예) Google Analytics, Meta Ads Manager 운영 경험\n리타겟팅 캠페인으로 CVR 23% 개선\n월 5,000만원 규모 퍼포먼스 광고 집행 등`}
                    value={portfolioText}
                    maxLength={MAX_TEXT}
                    rows={5}
                    onChange={e => setPortfolioText(e.target.value)}
                    onFocus={e => {
                      e.target.style.borderColor = ACCENT;
                      e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.12)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = BORDER;
                      e.target.style.boxShadow = 'none';
                    }}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: `1px solid ${BORDER}`, fontSize: 14,
                      fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                      lineHeight: 1.7, boxSizing: 'border-box',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                </div>
              </div>
            )}
          </SectionCard>

          {/* 제출 에러 */}
          {submitError && (
            <div style={{
              background: RED_BG,
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '12px 14px',
              fontSize: 13, color: RED,
            }}>
              {submitError}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px 0',
              background: submitting ? '#94A3B8' : ACCENT,
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#0C2A62'; }}
            onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = ACCENT; }}
          >
            {submitting ? '제출 중...' : '가입 신청하기 →'}
          </button>

          {/* 로그인 링크 */}
          <div style={{ textAlign: 'center', fontSize: 13, color: T3, paddingBottom: 8 }}>
            이미 계정이 있으신가요?{' '}
            <Link to="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>
              로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
