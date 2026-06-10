import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import { Card, Btn } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../lib/imageUtils';

// 이미지 파일만 canvas 압축 가능 — PDF/DOC/DOCX는 그대로 업로드
const isImageFile = (f) => f.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(f.name);

const ACCENT = '#10367D';
const BORDER = '#E2E8F0';
const T1     = '#0F172A';
const T2     = '#475569';
const T3     = '#94A3B8';

const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/.+/i;
const URL_RE      = /^https?:\/\/.+/i;

function UploadZone({ file, onFile, accept = '.pdf,.jpg,.jpeg,.png', label = '파일 업로드' }) {
  const inputRef = useRef(null);
  const [drag, setDrag]   = useState(false);
  const handleDrop = e => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
  };
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${drag ? ACCENT : BORDER}`, borderRadius: 10,
        padding: '16px 14px', background: drag ? 'rgba(16,54,125,0.04)' : '#fff',
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Upload size={14} color={ACCENT} />
          <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600 }}>{file.name}</span>
          <button type="button"
            onClick={e => { e.stopPropagation(); onFile(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 0, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div>
          <Upload size={20} color={T3} style={{ margin: '0 auto 6px' }} />
          <div style={{ fontSize: 13, color: T2 }}>{label}</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>클릭하거나 파일을 여기에 끌어놓으세요</div>
        </div>
      )}
    </div>
  );
}

export default function VerifyDocs() {
  const navigate = useNavigate();

  const [certFile,      setCertFile]      = useState(null);
  const [expYears,      setExpYears]      = useState('');
  const [linkedinUrl,   setLinkedinUrl]   = useState('');
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [portfolioText, setPortfolioText] = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [existing,      setExisting]      = useState(null); // 재제출 시 기존 제출 내역 프리필용

  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  // 기존 제출 내역 로드 → 링크·연차 프리필 (재제출 시 빈 폼 방지) + 거절 사유 표시
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('panels')
        .select('status, rejection_reason, health_insurance_url, linkedin_url, portfolio_url, portfolio_file_url, experience_years')
        .eq('user_id', user.id)
        .single();
      if (!data) return;
      setExisting(data);
      if (data.linkedin_url)             setLinkedinUrl(data.linkedin_url);
      if (data.portfolio_url)            setPortfolioText(data.portfolio_url);
      if (data.experience_years != null) setExpYears(String(data.experience_years));
    })();
  }, []);

  const handleCertFile = (f) => {
    if (f && f.size > MAX_FILE_SIZE) {
      setError('파일 크기가 20MB를 초과합니다. 20MB 이하의 파일을 선택해 주세요.');
      return;
    }
    if (f) setError('');
    setCertFile(f);
  };

  const handlePortfolioFile = (f) => {
    if (f && f.size > MAX_FILE_SIZE) {
      setError('포트폴리오 파일 크기가 20MB를 초과합니다. 20MB 이하의 파일을 선택해 주세요.');
      return;
    }
    if (f) setError('');
    setPortfolioFile(f);
  };

  const handleSubmit = async () => {
    setError('');
    if (!certFile && !existing?.health_insurance_url) {
      setError('건강보험 자격득실 확인서를 첨부해 주세요.'); return;
    }
    // 연차 입력 검증 (자격득실 확인서 기준 본인 계산값)
    const yearsNum = parseInt(expYears, 10);
    if (expYears === '' || Number.isNaN(yearsNum) || yearsNum < 2 || yearsNum > 50) {
      setError('본인 연차를 2 이상 50 이하의 숫자로 입력해 주세요.'); return;
    }
    // 경력 인증: LinkedIn / 포트폴리오 링크 / 포트폴리오 파일 중 최소 1개 필수 (기존 제출분 포함)
    const hasExistingCareer = !!(existing?.linkedin_url || existing?.portfolio_url || existing?.portfolio_file_url);
    if (!linkedinUrl.trim() && !portfolioText.trim() && !portfolioFile && !hasExistingCareer) {
      setError('경력 인증을 위해 LinkedIn 프로필, 포트폴리오 링크, 포트폴리오 파일 중 하나 이상을 제출해 주세요.'); return;
    }
    if (linkedinUrl.trim() && !LINKEDIN_RE.test(linkedinUrl.trim())) {
      setError('올바른 LinkedIn URL을 입력해 주세요. (예: https://linkedin.com/in/홍길동)'); return;
    }
    if (portfolioText.trim() && !URL_RE.test(portfolioText.trim())) {
      setError('올바른 포트폴리오 URL 형식을 입력해 주세요. (예: https://...)'); return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let healthInsuranceUrl = null;
      let portfolioFileUrl   = null;

      if (certFile) {
        const certUp = isImageFile(certFile) ? await compressImage(certFile) : certFile;
        const ext  = certFile.name.split('.').pop();
        const path = `${user.id}/health_insurance.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('panel-verification-docs').upload(path, certUp, { upsert: true });
        if (!uploadErr) {
          healthInsuranceUrl = path;
        } else {
          setError('건강보험 파일 업로드에 실패했습니다. 파일을 확인 후 다시 시도해 주세요.');
          return;
        }
      }

      if (portfolioFile) {
        const portUp = isImageFile(portfolioFile) ? await compressImage(portfolioFile) : portfolioFile;
        const ext  = portfolioFile.name.split('.').pop();
        const path = `${user.id}/portfolio.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('panel-verification-docs').upload(path, portUp, { upsert: true });
        if (!uploadErr) {
          portfolioFileUrl = path;
        } else {
          setError('포트폴리오 파일 업로드에 실패했습니다. 파일을 확인 후 다시 시도해 주세요.');
          return;
        }
      }

      const { data: rpcOk, error: rpcErr } = await supabase.rpc('save_panel_verification_docs', {
        p_user_id:              user.id,
        p_health_insurance_url: healthInsuranceUrl || null,
        p_linkedin_url:         linkedinUrl.trim() || null,
        p_portfolio_url:        portfolioText.trim() || null,  // 포트폴리오 링크
        p_portfolio_file_url:   portfolioFileUrl || null,      // 포트폴리오 파일 경로
        p_experience_years:     yearsNum,                      // 자격득실 확인서 기준 본인 연차
      });

      if (rpcErr) { setError('저장 중 오류가 발생했습니다. 다시 시도해 주세요.'); return; }
      // RPC는 status가 pending/rejected가 아니면(active/suspended/banned) FALSE 반환 → 에러 없이 조용히 실패하므로 반환값도 확인 (082 상태 가드)
      if (rpcOk === false) { setError('현재 상태에서는 서류를 제출할 수 없습니다. 관리자에게 문의해 주세요.'); return; }
      navigate('/panel');
    } catch {
      setError('오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
    <div style={{ width: '100%', maxWidth: 560 }}>
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T1, marginBottom: 6 }}>경력 인증 서류 제출</div>
        <div style={{ fontSize: 14, color: T2 }}>심사 승인을 위해 아래 서류를 제출해 주세요.</div>
      </div>

      {/* 반려 시 거절 사유 안내 — 무엇을 보완해 재제출할지 표시 */}
      {existing?.status === 'rejected' && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
            📝 서류가 반려되었습니다. 아래 사유를 확인하고 보완하여 재제출해 주세요.
          </div>
          {existing.rejection_reason && (
            <div style={{ fontSize: 13.5, color: '#78350F', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {existing.rejection_reason}
            </div>
          )}
        </div>
      )}

      {/* 건강보험 자격득실 확인서 */}
      <Card style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4 }}>
          연차 인증 (건강보험 자격득실 확인서) <span style={{ color: '#E53E3E', fontSize: 13 }}>*</span>
        </div>
        <div style={{ fontSize: 13, color: T2, marginBottom: 4 }}>
          토스 · 카카오톡에서 30초 발급 가능합니다.
        </div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>
          PDF 또는 이미지, 20MB 이하 (이미지는 자동 압축)
        </div>
        <UploadZone
          file={certFile} onFile={handleCertFile}
          accept=".pdf,.jpg,.jpeg,.png"
          label="자격득실 확인서 업로드"
        />
        {existing?.health_insurance_url && !certFile && (
          <div style={{ fontSize: 12, color: ACCENT, marginTop: 8 }}>
            ✓ 기존 제출 파일이 있습니다. 변경할 경우에만 새 파일을 업로드하세요.
          </div>
        )}

        {/* 본인 연차 입력 — 자격득실 확인서 기준 자가 계산 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 6 }}>
            본인 연차 (자격득실 확인서 기준) <span style={{ color: '#E53E3E', fontSize: 13 }}>*</span>
          </div>
          <div style={{ fontSize: 12, color: T3, marginBottom: 8 }}>
            확인서의 직장가입자 취득·상실 이력으로 총 근무 기간을 확인한 뒤, 아래 방식으로 본인 연차를 계산해 입력해 주세요. 어드민 확인 후 확정됩니다.
          </div>
          <div style={{
            background: 'rgba(16,54,125,0.04)', border: `1px solid ${BORDER}`,
            borderRadius: 9, padding: '11px 13px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 5 }}>
              계산법 = 근무 연 수 + 1
            </div>
            <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.7 }}>
              · 예) <strong>4년 2개월</strong> 근무 → <strong>5년차</strong>로 입력<br />
              · 예) <strong>1년 8개월</strong> 근무 → <strong>2년차</strong>로 입력<br />
              · 개월 수는 버리고, 만으로 채운 근무 연 수에 1을 더합니다.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={2}
              max={50}
              placeholder="예: 5"
              value={expYears}
              onChange={e => setExpYears(e.target.value)}
              style={{
                width: 120, padding: '11px 13px', borderRadius: 9,
                border: `1px solid ${BORDER}`, fontSize: 14,
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.10)'; }}
              onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
            />
            <span style={{ fontSize: 14, color: T2 }}>년차</span>
          </div>
        </div>
      </Card>

      {/* 경력 인증 */}
      <Card style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4 }}>
          경력 인증 <span style={{ color: '#E53E3E', fontSize: 13 }}>*</span>
        </div>
        <div style={{ fontSize: 13, color: T2, marginBottom: 16 }}>
          아래 항목 중 하나 이상을 제출해 주세요. (여러 개 동시 제출 가능)
        </div>

        {/* LinkedIn URL */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 6 }}>LinkedIn 프로필 (선택)</div>
          <input
            type="url"
            placeholder="https://linkedin.com/in/홍길동"
            value={linkedinUrl}
            onChange={e => setLinkedinUrl(e.target.value)}
            style={{
              width: '100%', padding: '11px 13px', borderRadius: 9,
              border: `1px solid ${BORDER}`, fontSize: 14,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.10)'; }}
            onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* 포트폴리오 / 이력서 링크 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 6 }}>포트폴리오 / 이력서 링크 (선택)</div>
          <input
            type="url"
            placeholder="https://notion.so/내_포트폴리오"
            value={portfolioText}
            onChange={e => setPortfolioText(e.target.value)}
            style={{
              width: '100%', padding: '11px 13px', borderRadius: 9,
              border: `1px solid ${BORDER}`, fontSize: 14,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = '0 0 0 3px rgba(16,54,125,0.10)'; }}
            onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* 포트폴리오 / 이력서 파일 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 6 }}>포트폴리오 / 이력서 파일 (선택)</div>
          <div style={{ fontSize: 12, color: T3, marginBottom: 8 }}>
            PDF · 문서 · 이미지, 20MB 이하 (이미지는 자동 압축)
          </div>
          <UploadZone
            file={portfolioFile} onFile={handlePortfolioFile}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            label="파일로 업로드"
          />
          {existing?.portfolio_file_url && !portfolioFile && (
            <div style={{ fontSize: 12, color: ACCENT, marginTop: 8 }}>
              ✓ 기존 제출 파일이 있습니다. 변경할 경우에만 새 파일을 업로드하세요.
            </div>
          )}
        </div>
      </Card>

      {/* 에러 */}
      {error && (
        <div style={{
          fontSize: 13, color: '#C53030', background: '#FFF5F5',
          border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {/* 제출 버튼 */}
      <Btn
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 10 }}
      >
        {submitting ? '제출 중...' : (existing?.status === 'rejected' ? '서류 재제출하기 →' : '서류 제출하기 →')}
      </Btn>

      <div style={{ fontSize: 12, color: T3, textAlign: 'center', marginTop: 12 }}>
        서류 검토 후 어드민이 심사를 완료하면 미션 참여가 가능합니다.
      </div>
    </div>
    </div>
  );
}
