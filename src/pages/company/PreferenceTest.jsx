import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { Card, Btn, Badge, ConfirmModal, StatusTabs } from '../../components/ui';
import PanelTargetStep, { calcCredits, calcPanelPayout } from '../../components/ui/PanelTargetStep';
import { splitCredits, needsAddonConfirm, addonUsageFor } from '../../lib/credits';
import { supabase } from '../../lib/supabase';
import { resolveCompany } from '../../lib/resolveCompany';
import { navigationGuard } from '../../lib/navigationGuard';
import { QUESTION_TEMPLATES, TYPE_LABEL, TYPE_COLOR } from '../../lib/templates';
import { compressImage } from '../../lib/imageUtils';
import { ASSET_TYPES, SUB_CUSTOM_MAXLEN, resolveAssetType } from '../../lib/subMissionMeta';

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

// 검증 유형(ASSET_TYPES)은 src/lib/subMissionMeta.js 단일 출처에서 import

const STEPS = ['소재 입력', '질문 설정', '패널 설정', '검토'];

const CAREER_LABEL = { junior: '주니어', middle: '미들', senior: '시니어', clevel: '헤드' };

const INDUSTRIES = [
  '뷰티/코스메틱', '헬스/피트니스', '식품/음료', '패션/의류',
  'SaaS/소프트웨어', '교육/에듀테크', '금융/핀테크', '여행/숙박',
  '부동산/인테리어', '의료/헬스케어', '반려동물', '게임/엔터테인먼트',
  '이커머스/리테일', '자동차/모빌리티', '미디어/콘텐츠', 'B2B 서비스',
  'HR/채용', '법률/컨설팅', '물류/배송', '환경/에너지',
];

export default function PreferenceTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const panelStepRef = useRef(null);

  const [view, setView] = useState('list');
  const [createStep, setCreateStep] = useState(0);
  const [missionUuid, setMissionUuid] = useState(() => crypto.randomUUID());

  // Step 0
  const [missionTitle, setMissionTitle] = useState('');
  const [assetType, setAssetType] = useState('');
  const [assetTypeCustom, setAssetTypeCustom] = useState('');  // assetType==='custom'(기타) 직접입력값
  // Step 1
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [variantAImage, setVariantAImage] = useState(null);
  const [variantBImage, setVariantBImage] = useState(null);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Step 2
  const [productDescription, setProductDescription] = useState('');
  const [industry,            setIndustry]            = useState('');
  const [industryOpen,        setIndustryOpen]        = useState(false);
  const [industryCustomMode,  setIndustryCustomMode]  = useState(false);
  const [industryCustomInput, setIndustryCustomInput] = useState('');
  // Step 3
  const [panelSize, setPanelSize] = useState(10);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [expandedTmpl, setExpandedTmpl] = useState({});
  const [customTemplateQs, setCustomTemplateQs] = useState([]);
  const [localCustomQs, setLocalCustomQs] = useState([]);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState('text');
  const [newQOptions, setNewQOptions] = useState(['', '']);
  const [newQScaleMin, setNewQScaleMin] = useState('');
  const [newQScaleMax, setNewQScaleMax] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingToTemplate, setSavingToTemplate] = useState(false);
  const [saveTmplError, setSaveTmplError] = useState('');

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [companyPlan, setCompanyPlan] = useState(null);
  const [careerLevels, setCareerLevels] = useState(['junior']);
  const [creditBalance, setCreditBalance] = useState(null);
  const [creditAddon, setCreditAddon] = useState(0);
  const [teamRole, setTeamRole] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [editIsDraft, setEditIsDraft] = useState(true);  // 수정 대상이 draft(true)면 제출 시 크레딧 예약, active(false)면 이미 예약돼 재차감 금지
  const [listFilter, setListFilter] = useState('active');
  const [listPage, setListPage] = useState(1);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [terminateError, setTerminateError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [activeToast, setActiveToast] = useState(null);
  const activeToastTimerRef = useRef(null);
  const [pendingNavPath, setPendingNavPath] = useState(null);
  // 새로고침/크래시 대비 localStorage 자동저장 → 재진입 시 "이어서 작성" 배너로 복원
  const [restorable, setRestorable] = useState(null);

  const fileInputARef = useRef(null);
  const fileInputBRef = useRef(null);

  useEffect(() => {
    load();
    // draft 이어쓰기 진입
    if (location.state?.editMode && location.state?.missionId) {
      const mid = location.state.missionId;
      setDraftId(mid);
      setView('create');
      supabase.from('missions').select('*').eq('id', mid).single().then(({ data: ms }) => {
        if (!ms) return;
        setEditIsDraft(ms.status === 'draft');
        let parsed = {};
        try { parsed = JSON.parse(ms.description || '{}'); } catch {}
        if (parsed.missionTitle) setMissionTitle(parsed.missionTitle);
        else if (ms.title && !ms.title.includes('임시 저장')) setMissionTitle(ms.title);
        if (parsed.variantA) setVariantA(parsed.variantA);
        if (parsed.variantB) setVariantB(parsed.variantB);
        if (parsed.variantAImage) setVariantAImage(parsed.variantAImage);
        if (parsed.variantBImage) setVariantBImage(parsed.variantBImage);
        if (parsed.productDescription) setProductDescription(parsed.productDescription);
        if (parsed.industry) setIndustry(parsed.industry);
        if (Array.isArray(parsed.selectedQuestions)) {
          // 저장 시 합쳐진 질문을 local-(인라인 생성)/그 외로 다시 분리 복원 ('추가된 질문 목록' 취소 UI 복구)
          const isLocal = q => typeof q.id === 'string' && q.id.startsWith('local-');
          setLocalCustomQs(parsed.selectedQuestions.filter(isLocal));
          setSelectedQuestions(parsed.selectedQuestions.filter(q => !isLocal(q)));
        }
        if (Array.isArray(parsed.careerLevels)) setCareerLevels(parsed.careerLevels);
        if (parsed.panelSize) setPanelSize(parsed.panelSize);
        if (parsed.assetType) setAssetType(parsed.assetType);
        if (parsed.assetTypeCustom) setAssetTypeCustom(parsed.assetTypeCustom);
      });
    }
  }, []);

  function resetForm() {
    setMissionUuid(crypto.randomUUID());
    setCreateStep(0);
    setMissionTitle(''); setAssetType(''); setAssetTypeCustom('');
    setVariantA(''); setVariantB(''); setVariantAImage(null); setVariantBImage(null);
    setProductDescription('');
    setIndustry(''); setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput('');
    setPanelSize(10); setCareerLevels(['junior']);
    setSelectedQuestions([]); setLocalCustomQs([]); setExpandedTmpl({});
    setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
    setDraftId(null);
    setEditIsDraft(true);
  }

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { company: co, teamRole: tr } = await resolveCompany(user.id);
      setCompanyId(co?.id);
      setCompanyPlan(co?.plan?.toLowerCase() || 'starter');
      if (co != null) { setCreditBalance(co.credit_balance ?? 0); setCreditAddon(co.addon_credits ?? 0); }
      setTeamRole(tr);
      if (co) {
        const { data: missionsData } = await supabase
          .from('missions').select('id, title, status, panel_count, filled_count, created_at, company_notified_at')
          .eq('company_id', co.id).eq('type', 'preference').eq('dismissed', false)
          .order('created_at', { ascending: false });
        setMissions(missionsData || []);
        const { data: ctData } = await supabase
          .from('question_templates')
          .select('template_questions(id, question_text, question_type, options, question_order)')
          .eq('company_id', co.id).eq('category', '광고소재').eq('is_default', false);
        const flatQs = (ctData || []).flatMap(t =>
          (t.template_questions || []).sort((a, b) => a.question_order - b.question_order)
        );
        setCustomTemplateQs(flatQs.map(q => ({
          id: q.id, text: q.question_text, type: q.question_type || 'text',
          options: Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })(),
        })));
      }
      setLoading(false);
    } catch (err) {
      console.error('[PreferenceTest load]', err);
      setLoading(false);
    }
  }

  const shouldBlockNav = view === 'create' && Boolean(missionTitle || variantA || variantB || productDescription);
  // 신규 등록·draft 활성화에서만 크레딧 차감 → active 의뢰 수정은 부족 게이트/경고 비활성
  const creditsChargedOnSubmit = !draftId || editIsDraft;

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
  const draftKey = companyId ? `purit_form_draft_preference_${companyId}` : null;
  const clearLocalDraft = () => { if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} } };

  // 자동저장: 신규 작성(create) 모드에서 내용이 있을 때만 (draft 이어쓰기·active 수정은 DB가 진실 원천이라 제외)
  useEffect(() => {
    if (!draftKey || draftId || view !== 'create') return;
    if (!(missionTitle || variantA || variantB || productDescription)) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        missionTitle, assetType, assetTypeCustom, variantA, variantB, variantAImage, variantBImage,
        productDescription, industry, panelSize, selectedQuestions, localCustomQs,
        careerLevels, createStep, missionUuid, savedAt: Date.now(),
      }));
    } catch {}
  }, [draftKey, draftId, view, missionTitle, assetType, assetTypeCustom, variantA, variantB, variantAImage, variantBImage,
      productDescription, industry, panelSize, selectedQuestions, localCustomQs, careerLevels, createStep, missionUuid]);

  // 복원 감지: 신규 진입(수정·템플릿 진입 아님) 시 저장본이 있으면 배너로 제안
  useEffect(() => {
    if (!draftKey || location.state?.editMode) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const parsed = JSON.parse(raw); if (parsed?.missionTitle != null || parsed?.variantA != null) setRestorable(parsed); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function restoreLocalDraft() {
    const d = restorable;
    if (!d) return;
    if (d.missionTitle != null) setMissionTitle(d.missionTitle);
    if (d.assetType != null) setAssetType(d.assetType);
    if (d.assetTypeCustom != null) setAssetTypeCustom(d.assetTypeCustom);
    if (d.variantA != null) setVariantA(d.variantA);
    if (d.variantB != null) setVariantB(d.variantB);
    if (d.variantAImage !== undefined) setVariantAImage(d.variantAImage);
    if (d.variantBImage !== undefined) setVariantBImage(d.variantBImage);
    if (d.productDescription != null) setProductDescription(d.productDescription);
    if (d.industry != null) setIndustry(d.industry);
    if (d.panelSize != null) setPanelSize(d.panelSize);
    if (Array.isArray(d.selectedQuestions)) setSelectedQuestions(d.selectedQuestions);
    if (Array.isArray(d.localCustomQs)) setLocalCustomQs(d.localCustomQs);
    if (Array.isArray(d.careerLevels)) setCareerLevels(d.careerLevels);
    if (typeof d.createStep === 'number') setCreateStep(d.createStep);
    if (d.missionUuid) setMissionUuid(d.missionUuid);
    setDraftId(null); setEditIsDraft(true);
    setRestorable(null);
    setView('create');
  }
  function discardLocalDraft() {
    clearLocalDraft();
    setRestorable(null);
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
    const { error } = await supabase.from('missions').update({ status: 'cancelled' }).eq('id', terminateTarget.id);
    if (error) {
      setTerminateError('종료 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      return;
    }
    setMissions(prev => prev.map(m => m.id === terminateTarget.id ? { ...m, status: 'cancelled' } : m));
    supabase.rpc('notify_early_termination', { p_mission_id: terminateTarget.id })
      .then(({ error: ne }) => { if (ne) console.warn('[notify_early_termination]', ne.message); });
    setTerminateError('');
    setTerminateTarget(null);
  }

  async function saveDraft() {
    if (!companyId) return;
    if (draftId && !editIsDraft) return;  // active 의뢰 수정 중에는 임시저장(=status를 draft로 되돌림) 금지
    setSavingDraft(true);
    try {
      const desc = JSON.stringify({
        missionTitle,
        variantA, variantB, variantAImage, variantBImage,
        productDescription, industry, assetType, assetTypeCustom,
        selectedQuestions: [...selectedQuestions, ...localCustomQs],
        careerLevels, panelSize,
      });
      const payload = {
        company_id: companyId,
        title: missionTitle.trim() || `소재 비교 (임시 저장)`,
        type: 'preference', status: 'draft',
        description: desc, panel_count: panelSize,
        reward_amount: calcPanelPayout(careerLevels, 'sub'), assets: [],
      };
      if (draftId) {
        await supabase.from('missions').update(payload).eq('id', draftId);
      } else {
        const newId = missionUuid;
        await supabase.from('missions').insert({ id: newId, ...payload });
        setDraftId(newId);
        clearLocalDraft();  // DB draft가 진실 원천이 되므로 localStorage 자동저장본 제거 (배너 중복 방지)
      }
    } catch (e) {
      console.error('[PreferenceTest] 임시 저장 실패:', e.message);
      setSavingDraft(false);
      throw e;
    }
    setSavingDraft(false);
  }

  function openDraftOrActiveForEdit(missionId) {
    setDraftId(missionId);
    supabase.from('missions').select('*').eq('id', missionId).single().then(({ data: ms }) => {
      if (!ms) return;
      setEditIsDraft(ms.status === 'draft');
      let parsed = {};
      try { parsed = JSON.parse(ms.description || '{}'); } catch {}
      if (parsed.missionTitle) setMissionTitle(parsed.missionTitle);
      else if (ms.title && !ms.title.includes('임시 저장')) setMissionTitle(ms.title);
      if (parsed.variantA) setVariantA(parsed.variantA);
      if (parsed.variantB) setVariantB(parsed.variantB);
      if (parsed.variantAImage) setVariantAImage(parsed.variantAImage);
      if (parsed.variantBImage) setVariantBImage(parsed.variantBImage);
      if (parsed.productDescription) setProductDescription(parsed.productDescription);
      if (parsed.industry) setIndustry(parsed.industry);
      if (Array.isArray(parsed.selectedQuestions)) {
        // 저장 시 합쳐진 질문을 local-(인라인 생성)/그 외로 다시 분리 복원 ('추가된 질문 목록' 취소 UI 복구)
        const isLocal = q => typeof q.id === 'string' && q.id.startsWith('local-');
        setLocalCustomQs(parsed.selectedQuestions.filter(isLocal));
        setSelectedQuestions(parsed.selectedQuestions.filter(q => !isLocal(q)));
      }
      if (Array.isArray(parsed.careerLevels)) setCareerLevels(parsed.careerLevels);
      if (parsed.panelSize) setPanelSize(parsed.panelSize);
      if (parsed.assetType) setAssetType(parsed.assetType);
      if (parsed.assetTypeCustom) setAssetTypeCustom(parsed.assetTypeCustom);
      setView('create');
    }).catch(e => console.error('[PreferenceTest] 이어쓰기 로드 실패:', e.message));
  }

  function parseOptions(opts) {
    if (Array.isArray(opts)) return opts;
    try { return JSON.parse(opts || '[]'); } catch { return []; }
  }

  const allSelected = [...selectedQuestions, ...localCustomQs];
  const totalSelected = allSelected.length;
  const textSelected = allSelected.filter(q => q.type === 'text').length;
  const canAddQ = (q) => totalSelected < 5 && !(q.type === 'text' && textSelected >= 2);

  const toggleQuestion = (q) => {
    const isSelected = selectedQuestions.some(s => s.id === q.id);
    if (isSelected) {
      setSelectedQuestions(prev => prev.filter(s => s.id !== q.id));
    } else if (canAddQ(q)) {
      setSelectedQuestions(prev => [...prev, q]);
    }
  };

  function handleAddLocalQ() {
    if (!newQText.trim()) return;
    if (!canAddQ({ type: newQType })) return;
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
        .eq('company_id', companyId).eq('category', '광고소재').eq('is_default', false)
        .maybeSingle();
      if (!tmpl) {
        const { data: newT, error: tErr } = await supabase
          .from('question_templates')
          .insert({ company_id: companyId, name: '내 커스텀 질문', category: '광고소재', icon: '✏️', description: '직접 만든 질문 모음', is_default: false })
          .select().single();
        if (tErr) throw tErr;
        tmpl = newT;
      }
      const { data: newQ, error: qErr } = await supabase.from('template_questions').insert({
        template_id: tmpl.id,
        question_text: newQText.trim(),
        question_type: newQType,
        options,
        question_order: customTemplateQs.length + 1,
      }).select().single();
      if (qErr) throw qErr;
      const saved = { id: newQ.id, text: newQ.question_text, type: newQ.question_type, options: parseOptions(newQ.options) };
      setCustomTemplateQs(prev => [...prev, saved]);
      setLocalCustomQs(prev => [...prev, { ...saved, id: `local-${Date.now()}` }]);
      setNewQText(''); setNewQType('text'); setNewQOptions(['', '']); setNewQScaleMin(''); setNewQScaleMax('');
      setSaveTmplError('');
      setShowSaveModal(false);
    } catch (e) {
      console.error('[PreferenceTest] 템플릿 저장 실패:', e.message);
      setSaveTmplError('템플릿 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSavingToTemplate(false);
    }
  }

  async function handleImageUpload(variant, file) {
    if (!file || !companyId) return;
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('이미지 파일이 20MB를 초과합니다.');
      return;
    }
    setUploadError('');
    const loadingSetter = variant === 'A' ? setUploadingA : setUploadingB;
    const imageSetter = variant === 'A' ? setVariantAImage : setVariantBImage;
    const fileName = variant === 'A' ? 'va' : 'vb';
    loadingSetter(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.type === 'image/png' ? 'png' : 'jpg';
      const path = `${companyId}/${missionUuid}/${fileName}.${ext}`;
      const { error } = await supabase.storage.from('mission-assets').upload(path, compressed, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('mission-assets').getPublicUrl(path);
      imageSetter(publicUrl);
    } catch (err) {
      console.error('[PreferenceTest] 이미지 업로드 실패:', err.message);
    } finally {
      loadingSetter(false);
    }
  }

  async function handleSubmit() {
    if (teamRole === 'viewer') return;
    if (!variantA.trim() || !variantB.trim() || !assetType || (assetType === 'custom' && !assetTypeCustom.trim()) || !companyId) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    const targetId = draftId || missionUuid;
    const descJson = JSON.stringify({
      missionTitle,
      variantA: variantA.trim(), variantB: variantB.trim(),
      variantAImage: variantAImage || null, variantBImage: variantBImage || null,
      productDescription: productDescription.trim(),
      industry: industry || null,
      assetType, assetTypeCustom,
      selectedQuestions: [...selectedQuestions, ...localCustomQs],
      careerLevels,
      panelSize,
    });
    try {
      const finalTitle = missionTitle.trim() || `소재 비교: ${resolveAssetType({ assetType, assetTypeCustom })?.label || assetType}`;
      // 크레딧 예약 먼저 — 성공 후에만 status='active' DB 반영 (트리거 조기 발화 방지)
      const requiredCredits = calcCredits(panelSize, careerLevels, 'sub');
      if (draftId) {
        // active 의뢰 수정은 이미 크레딧이 예약돼 있어 재예약 금지 (draft 활성화일 때만 예약)
        if (editIsDraft) {
          const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
            p_mission_id: draftId, p_company_id: companyId, p_credits: requiredCredits,
          });
          if (creditErr) throw creditErr;
          if (!creditData?.success) {
            throw new Error(
              creditData?.error === 'INSUFFICIENT_CREDITS'
                ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
                : '크레딧 처리 중 오류가 발생했습니다.'
            );
          }
        }
        const { error: mErr } = await supabase.from('missions').update({
          title: finalTitle,
          description: descJson, panel_count: panelSize,
          reward_amount: calcPanelPayout(careerLevels, 'sub'), status: 'active',
        }).eq('id', draftId);
        if (mErr) throw mErr;
      } else {
        const { error: mErr } = await supabase.from('missions').insert({
          id: targetId, company_id: companyId,
          title: finalTitle,
          type: 'preference', description: descJson,
          panel_count: panelSize, reward_amount: calcPanelPayout(careerLevels, 'sub'),
          status: 'draft', assets: [],
        });
        if (mErr) throw mErr;
        const { data: creditData, error: creditErr } = await supabase.rpc('reserve_mission_credits', {
          p_mission_id: targetId, p_company_id: companyId, p_credits: requiredCredits,
        });
        if (creditErr || !creditData?.success) {
          await supabase.from('missions').delete().eq('id', targetId);
          throw new Error(
            creditData?.error === 'INSUFFICIENT_CREDITS'
              ? `크레딧이 부족합니다. (보유: ${creditData.balance}, 필요: ${creditData.required})`
              : '크레딧 처리 중 오류가 발생했습니다.'
          );
        }
        const { error: activateErr } = await supabase.from('missions').update({ status: 'active' }).eq('id', targetId);
        if (activateErr) {
          await supabase.from('missions').delete().eq('id', targetId);
          throw activateErr;
        }
      }

      const { error: tErr } = await supabase.from('preference_tests').insert({
        company_id: companyId, asset_type: assetType,
        variant_a: variantA.trim(), variant_b: variantB.trim(),
        panel_size: panelSize, status: 'active', mission_id: targetId, template_id: null,
      });
      if (tErr) console.warn('[PreferenceTest] 서브테이블 등록 실패:', tErr.message);

      clearLocalDraft();
      setMissionUuid(crypto.randomUUID());
      navigate('/company');
      return true;
    } catch (err) {
      console.error('[PreferenceTest] 등록 실패:', err.message);
      setSubmitError(err.message || '의뢰 등록 중 오류가 발생했습니다.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>로딩 중…</div>;

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 900, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>PREFERENCE TEST</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>소재 비교 A/B</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>두 소재를 패널에게 제시하고, 어느 쪽이 더 전환에 기여하는지 측정합니다.</p>
          </div>
          {view !== 'list' && <Btn variant="ghost" onClick={() => {
            if (shouldBlockNav) setShowDraftModal(true);
            else setView('list');
          }}>← 목록</Btn>}
        </div>
      </div>

      {/* ── 생성 폼 (스텝 기반) ── */}
      {view === 'create' && (
        <div>
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
          {/* 스텝 인디케이터 */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STEPS.length - 1 ? 'flex-end' : 'center', gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < createStep ? 'var(--green)' : i === createStep ? 'var(--accent)' : 'var(--surface)',
                  color: i <= createStep ? '#fff' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 700, border: '1px solid',
                  borderColor: i < createStep ? 'var(--green)' : i === createStep ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.2s',
                }}>
                  {i < createStep ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === createStep ? 'var(--text)' : 'var(--text-3)', fontWeight: i === createStep ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>

          <Card>
            {/* Step 0: 소재 입력 (유형 + A/B + 제품 설명 통합) */}
            {createStep === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* 검증할 서비스명(의뢰명) */}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>검증할 서비스명(의뢰명)</div>
                  <input
                    type="text"
                    value={missionTitle}
                    onChange={e => setMissionTitle(e.target.value)}
                    placeholder="예) 우리 서비스 소재 A/B 비교"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ height: 1, background: 'var(--border)' }} />
                {/* 검증 유형 */}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>검증 유형</div>
                  <div className="grid-2col-480" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {ASSET_TYPES.map(t => (
                      <div key={t.key} onClick={() => setAssetType(t.key)} style={{
                        padding: '12px 14px', borderRadius: 'var(--radius)',
                        border: `1px solid ${assetType === t.key ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        background: 'var(--surface)',
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>{t.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
                      </div>
                    ))}
                    {/* 기타(직접입력) */}
                    <div onClick={() => setAssetType('custom')} style={{
                      padding: '12px 14px', borderRadius: 'var(--radius)',
                      border: `1px solid ${assetType === 'custom' ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: 'pointer', background: 'var(--surface)', transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>✏️</div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>기타</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>직접 입력</div>
                    </div>
                  </div>
                  {assetType === 'custom' && (
                    <input
                      type="text"
                      value={assetTypeCustom}
                      onChange={e => setAssetTypeCustom(e.target.value.slice(0, SUB_CUSTOM_MAXLEN))}
                      maxLength={SUB_CUSTOM_MAXLEN}
                      placeholder="검증 유형을 직접 입력하세요 (예: 가격 표시 방식)"
                      style={{ width: '100%', marginTop: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--border)' }} />

                {/* 소재 A/B 입력 */}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>소재 A / B 입력</div>
                  <div className="form-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[
                      ['A', variantA, setVariantA, variantAImage, setVariantAImage, uploadingA, fileInputARef, 'var(--blue)'],
                      ['B', variantB, setVariantB, variantBImage, setVariantBImage, uploadingB, fileInputBRef, 'var(--accent)'],
                    ].map(([label, val, setter, img, imgSetter, uploading, ref, color]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>소재 {label}</div>
                        <textarea
                          value={val}
                          onChange={e => setter(e.target.value)}
                          rows={5}
                          placeholder={`소재 ${label} 텍스트를 입력하세요\n(카피, 문구, 설명 등)`}
                          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, borderLeft: `3px solid ${color}`, marginBottom: 10 }}
                        />
                        <input type="file" accept="image/*" ref={ref} style={{ display: 'none' }}
                          onChange={e => { if (e.target.files[0]) handleImageUpload(label, e.target.files[0]); e.target.value = ''; }} />
                        {img ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img src={img} alt={`소재 ${label}`} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: `1px solid ${color}` }} />
                            <button onClick={() => imgSetter(null)} style={{
                              position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>×</button>
                          </div>
                        ) : (
                          <Btn variant="secondary" size="sm" disabled={uploading} onClick={() => ref.current?.click()}>
                            {uploading ? '업로드 중...' : '이미지 추가 (선택)'}
                          </Btn>
                        )}
                      </div>
                    ))}
                  </div>
                  {uploadError && (
                    <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{uploadError}</div>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--border)' }} />

                {/* 제품/타겟 설명 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>제품 / 타겟 설명</div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>패널에게 표시됩니다. 어떤 제품인지, 어떤 타겟을 대상으로 하는지 간단히 적어주세요.</p>
                    <textarea
                      value={productDescription}
                      onChange={e => setProductDescription(e.target.value)}
                      rows={3}
                      placeholder={"예) 제품명: 기능성 러닝화 / 타겟: 30-40대 직장인 러너"}
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>산업군</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <button type="button" onClick={() => setIndustryOpen(o => !o)} style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: industry ? 'var(--text)' : 'var(--text-3)', textAlign: 'left',
                      }}>
                        <span>{industry || '산업군을 선택하세요'}</span>
                        <span style={{ transition: 'transform 0.2s', transform: industryOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', color: 'var(--text-3)', fontSize: 11 }}>▼</span>
                      </button>
                      {industryOpen && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: 14, background: 'var(--bg)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {INDUSTRIES.map(ind => (
                              <button key={ind} type="button" onClick={() => { setIndustry(ind); setIndustryCustomMode(false); setIndustryOpen(false); }} style={{
                                padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                                background: industry === ind ? 'var(--accent)' : 'var(--surface-2)',
                                color: industry === ind ? '#fff' : 'var(--text-2)',
                                border: '1px solid ' + (industry === ind ? 'var(--accent)' : 'var(--border)'), transition: 'all 0.12s',
                              }}>{ind}</button>
                            ))}
                            <button type="button" onClick={() => setIndustryCustomMode(m => !m)} style={{
                              padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                              background: industryCustomMode ? 'var(--blue)' : 'var(--surface-2)',
                              color: industryCustomMode ? '#fff' : 'var(--text-2)',
                              border: '1px solid ' + (industryCustomMode ? 'var(--blue)' : 'var(--border)'), transition: 'all 0.12s',
                            }}>✏️ 직접 쓰기</button>
                          </div>
                          {industryCustomMode && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                              <input value={industryCustomInput} onChange={e => setIndustryCustomInput(e.target.value)}
                                placeholder="산업군을 직접 입력하세요"
                                style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                                onKeyDown={e => { if (e.key === 'Enter' && industryCustomInput.trim()) { setIndustry(industryCustomInput.trim()); setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput(''); } }} />
                              <Btn size="sm" onClick={() => { if (industryCustomInput.trim()) { setIndustry(industryCustomInput.trim()); setIndustryOpen(false); setIndustryCustomMode(false); setIndustryCustomInput(''); } }}>확인</Btn>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: 질문 설정 */}
            {createStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>질문 설정</div>
                    <div style={{
                      fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 700,
                      padding: '3px 10px', borderRadius: 20,
                      background: totalSelected >= 5 ? 'var(--accent)' : 'var(--surface)',
                      color: totalSelected >= 5 ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border)',
                    }}>{totalSelected}/5 선택됨</div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                    아래 15개 질문 중 최대 5개를 골라 패널에게 발송하세요. 그룹 헤더를 클릭하면 질문 목록이 펼쳐집니다.
                  </p>

                  {/* 내 커스텀 질문 그룹 */}
                  {customTemplateQs.length > 0 && (() => {
                    const custSelected = customTemplateQs.filter(q => selectedQuestions.some(s => s.id === q.id));
                    const isOpen = expandedTmpl['__custom__'];
                    return (
                      <div style={{ marginBottom: 8, border: '2px solid var(--accent)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedTmpl(prev => ({ ...prev, '__custom__': !isOpen }))}
                          style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', background: 'var(--surface)', cursor: 'pointer', userSelect: 'none', gap: 10 }}>
                          <span style={{ fontSize: 15 }}>✏️</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>내 커스텀 질문</span>
                          {custSelected.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{custSelected.length}개 선택</span>}
                          <span style={{ color: 'var(--text-3)', fontSize: 12, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {customTemplateQs.map((q, qi) => {
                              const isChecked = selectedQuestions.some(s => s.id === q.id);
                              const disabled = !isChecked && !canAddQ(q);
                              return (
                                <div key={q.id} onClick={() => !disabled && toggleQuestion(q)} style={{
                                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px',
                                  background: 'var(--surface)',
                                  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                                  borderBottom: qi < customTemplateQs.length - 1 ? '1px solid var(--border)' : 'none',
                                }}>
                                  <div style={{ width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2, border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`, background: isChecked ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                                    <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>{TYPE_LABEL[q.type]}</span>
                                      {q.type === 'radio' && q.options.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>}
                                      {q.type === 'scale' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'}</span>
                                          {[1,2,3,4,5].map(n => <span key={n} style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-sans)', border: '1px solid var(--accent)', color: 'var(--text-2)' }}>{n}</span>)}
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[1] || '매우 그렇다'}</span>
                                        </span>
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

                  {QUESTION_TEMPLATES.preference.map(tmpl => {
                    const isOpen = expandedTmpl[tmpl.id];
                    const groupCount = selectedQuestions.filter(q => tmpl.questions.some(tq => tq.id === q.id)).length;
                    return (
                      <div key={tmpl.id} style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div
                          onClick={() => setExpandedTmpl(prev => ({ ...prev, [tmpl.id]: !isOpen }))}
                          style={{
                            display: 'flex', alignItems: 'center', padding: '11px 14px',
                            background: 'var(--surface)',
                            cursor: 'pointer', userSelect: 'none', gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 15 }}>{tmpl.icon}</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{tmpl.name}</span>
                          {groupCount > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{groupCount}개 선택</span>
                          )}
                          <span style={{ color: 'var(--text-3)', fontSize: 12, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {tmpl.questions.map((q, qi) => {
                              const isChecked = selectedQuestions.some(s => s.id === q.id);
                              const disabled = !isChecked && !canAddQ(q);
                              return (
                                <div
                                  key={q.id}
                                  onClick={() => !disabled && toggleQuestion(q)}
                                  style={{
                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                    padding: '10px 14px',
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
                                    transition: 'all 0.12s',
                                  }}>
                                    {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                                    <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>
                                        {TYPE_LABEL[q.type]}
                                      </span>
                                      {q.type === 'radio' && q.options.length > 0 && (
                                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>
                                      )}
                                      {q.type === 'scale' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'}</span>
                                          {[1,2,3,4,5].map(n => (
                                            <span key={n} style={{
                                              width: 16, height: 16, borderRadius: '50%',
                                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-sans)',
                                              border: '1px solid var(--accent)',
                                              color: 'var(--text-2)',
                                            }}>{n}</span>
                                          ))}
                                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{q.options?.[1] || '매우 그렇다'}</span>
                                        </span>
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
                    {newQType === 'text' && textSelected >= 2 && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>서술형 질문은 최대 2개까지만 추가할 수 있습니다.</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <Btn size="sm" onClick={handleAddLocalQ}
                        disabled={!newQText.trim() || totalSelected >= 5 || (newQType === 'text' && textSelected >= 2)}>추가</Btn>
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
                            padding: '10px 12px',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--accent)',
                            borderLeft: '3px solid var(--accent)',
                            marginBottom: 6,
                          }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)', borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q.text}</span>
                              <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: TYPE_COLOR[q.type] + '22', color: TYPE_COLOR[q.type] }}>{TYPE_LABEL[q.type]}</span>
                                {q.type === 'radio' && q.options?.length > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>[{q.options.join(' / ')}]</span>
                                )}
                                {q.type === 'scale' && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.options?.[0] || '매우 아니다'} · 1~5 · {q.options?.[1] || '매우 그렇다'}</span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setLocalCustomQs(prev => prev.filter(lq => lq.id !== q.id))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: 패널 설정 */}
            {createStep === 2 && (
              <PanelTargetStep
                ref={panelStepRef}
                plan={companyPlan}
                panelCount={panelSize}
                onPanelCount={setPanelSize}
                careerLevels={careerLevels}
                onCareerLevels={setCareerLevels}
                missionType="sub"
                creditBalance={creditBalance}
                addonBalance={creditAddon}
                companyId={companyId}
                onCreditBalanceUpdate={(newBal) => { setCreditAddon(a => a + Math.max(0, newBal - (creditBalance || 0))); setCreditBalance(newBal); }}
                onSaveDraft={saveDraft}
                chargeOnSubmit={creditsChargedOnSubmit}
              />
            )}

            {/* Step 3: 검토 */}
            {createStep === 3 && (() => {
              const allQs = [...selectedQuestions, ...localCustomQs];
              const reqCredits = calcCredits(panelSize, careerLevels, 'sub');
              const notEnough = creditsChargedOnSubmit && creditBalance != null && reqCredits > creditBalance;
              const rows = [
                missionTitle.trim() && { label: '의뢰명', value: missionTitle.trim() },
                { label: '검증 유형', value: resolveAssetType({ assetType, assetTypeCustom })?.label || '-' },
                { label: '소재 A', value: variantA.trim() || '-' },
                { label: '소재 B', value: variantB.trim() || '-' },
                productDescription.trim() && { label: '제품/타겟 설명', value: productDescription.trim() },
                industry && { label: '산업군', value: industry },
              ].filter(Boolean);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>최종 검토</div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>아래 내용을 확인하고 의뢰를 제출하세요. 첫 피드백 수신 후에는 수정이 불가합니다.</p>
                  </div>
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', letterSpacing: '0.06em' }}>소재 입력</div>
                    {rows.map(r => (
                      <div key={r.label} style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 110, flexShrink: 0 }}>{r.label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>{r.value}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', padding: '10px 16px', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 110, flexShrink: 0 }}>추가 질문</div>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{allQs.length > 0 ? `${allQs.length}개 선택됨` : '없음'}</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', letterSpacing: '0.06em' }}>패널 설정</div>
                    {[
                      { label: '패널 수', value: `${panelSize}명` },
                      { label: '직급', value: careerLevels.map(c => CAREER_LABEL[c]).join(' · ') || '-' },
                      { label: '최대 예상 크레딧', value: `${reqCredits} 크레딧` },
                      creditBalance != null && { label: '보유 크레딧', value: `${creditBalance} 크레딧`, warn: notEnough },
                    ].filter(Boolean).map(r => (
                      <div key={r.label} style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 12, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 110, flexShrink: 0 }}>{r.label}</div>
                        <div style={{ fontSize: 13, fontWeight: r.label === '최대 예상 크레딧' ? 700 : 400, color: r.warn ? '#ef4444' : 'var(--text)' }}>{r.value}</div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                      실제 매칭된 패널의 직급 비율에 따라 소모량은 줄어들 수 있으며, 차액 크레딧은 완료 후 즉시 환불됩니다.
                    </div>
                  </div>
                  {notEnough && (
                    <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                      크레딧이 부족합니다. 플랜을 업그레이드하거나 추가 크레딧을 충전하세요.
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>

          {/* 네비게이션 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => {
              if (createStep > 0) setCreateStep(s => s - 1);
              else if (shouldBlockNav) setShowDraftModal(true);
              else setView('list');
            }}>
              {createStep === 0 ? '취소' : '이전'}
            </Btn>
            {createStep < STEPS.length - 1 ? (
              <Btn onClick={() => {
                if (creditsChargedOnSubmit && createStep === STEPS.length - 2 && creditBalance != null && calcCredits(panelSize, careerLevels, 'sub') > creditBalance) {
                  panelStepRef.current?.openCreditModal();
                  return;
                }
                setCreateStep(s => s + 1);
              }} disabled={
                createStep === 0 && (!assetType || (assetType === 'custom' && !assetTypeCustom.trim()) || !variantA.trim() || !variantB.trim() || !productDescription.trim() || !industry)
              }>
                다음 →
              </Btn>
            ) : (
              <Btn onClick={() => setShowSubmitConfirm(true)} disabled={teamRole === 'viewer' || submitting || !variantA.trim() || !variantB.trim() || (creditsChargedOnSubmit && creditBalance != null && calcCredits(panelSize, careerLevels, 'sub') > creditBalance)}>
                {submitting ? '등록 중…' : '의뢰 제출 →'}
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      {view === 'list' && (
        <>
        {restorable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px', marginBottom: 16, background: 'rgba(16,54,125,0.06)', border: '1px solid rgba(16,54,125,0.25)', borderRadius: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>✏️</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>작성 중이던 소재 비교가 있습니다</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                {restorable.missionTitle ? `“${restorable.missionTitle}” ` : ''}이어서 작성하거나 새로 시작할 수 있습니다.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" onClick={restoreLocalDraft}>이어서 작성 →</Btn>
              <Btn size="sm" variant="secondary" onClick={discardLocalDraft}>새로 시작</Btn>
            </div>
          </div>
        )}
        {missions.length === 0 ? (
          <Card style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 테스트가 없습니다</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>두 소재를 비교해 더 효과적인 카피를 찾아보세요.</div>
            <Btn onClick={() => { resetForm(); setView('create'); }}>+ 새 테스트</Btn>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <Btn size="sm" onClick={() => { resetForm(); setView('create'); }}>+ 새 테스트</Btn>
            </div>
            {/* 탭 */}
            <StatusTabs
              value={listFilter}
              onChange={(v) => { setListFilter(v); setListPage(1); }}
              tabs={[
                { key: 'all', label: '전체' }, { key: 'active', label: '진행' },
                { key: 'completed', label: '완료' }, { key: 'draft', label: '임시 저장' },
                { key: 'cancelled', label: '취소' },
              ]}
              style={{ marginBottom: 4 }}
            />
            {(() => {
              const filtered = listFilter === 'all' ? missions : missions.filter(m => m.status === listFilter);
              const paged = filtered.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);
              return (<>
                {paged.map(m => {
              const isDraft = m.status === 'draft';
              const filled = m.filled_count ?? 0;
              const isLive = m.status === 'active' && filled >= 1;
              const isFull = m.status === 'active' && m.panel_count > 0 && filled >= m.panel_count;
              const statusBadgeType = isDraft ? 'gold'
                : m.status === 'active' ? (filled === 0 ? 'gray' : isFull ? 'blue' : 'green')
                : m.status === 'completed' ? 'blue' : 'red';
              const statusBadgeLabel = isDraft ? '임시 저장'
                : m.status === 'active' ? (filled === 0 ? '매칭 대기' : isFull ? '검토 중' : '진행 중')
                : m.status === 'completed' ? '완료' : '취소';
              return (
                <Card key={m.id} style={{ cursor: 'pointer', border: isDraft ? '1px dashed #f59e0b' : undefined }}
                  onClick={() => {
                    if (isDraft) { openDraftOrActiveForEdit(m.id); }
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
                        <Badge type="blue">소재 비교</Badge>
                        {isLive && <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>🔒 수정 잠금</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{m.title || '소재 비교 A/B'}</div>
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
                        <div style={{ width: `${m.panel_count ? Math.min((filled / m.panel_count) * 100, 100) : 0}%`, height: '100%', background: (isLive && !isFull) ? '#ef4444' : 'var(--accent)', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(m.created_at).toLocaleDateString('ko-KR')} 등록</div>
                      {isDraft && (
                        <button onClick={e => { e.stopPropagation(); openDraftOrActiveForEdit(m.id); }}
                          style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', background: 'rgba(16,54,125,0.07)', color: 'var(--text-2)', cursor: 'pointer' }}>
                          이어 작성하기 →
                        </button>
                      )}
                      {m.status === 'active' && filled === 0 && (
                        <button onClick={e => { e.stopPropagation(); openDraftOrActiveForEdit(m.id); }}
                          style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: '#F1F5F9', color: 'var(--text-2)', cursor: 'pointer' }}>
                          수정
                        </button>
                      )}
                      {m.status === 'active' && filled >= 1 && !isFull && (
                        <button onClick={e => { e.stopPropagation(); setTerminateTarget(m); }}
                          style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
                          의뢰 조기 종료
                        </button>
                      )}
                      {isFull && (
                        <span style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: 'rgba(16,54,125,0.07)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          ✓ 수집 완료 · 검토 대기
                        </span>
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
              </>);
            })()}
          </div>
        )}
        </>
      )}

      {showSubmitConfirm && (() => {
        const credits = calcCredits(panelSize, careerLevels, 'sub');
        const remaining = creditBalance != null ? creditBalance - credits : null;
        // active 의뢰 수정: 등록 시 이미 크레딧이 예약돼 제출 시 추가 차감 없음 (D-128)
        const isActiveEdit = !creditsChargedOnSubmit;
        return (
          <ConfirmModal
            title={isActiveEdit ? '수정 내용을 저장할까요?' : '의뢰를 제출할까요?'}
            desc={
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75 }}>
                {isActiveEdit ? (
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
                <div style={{ padding: '10px 14px', background: 'rgba(16,54,125,0.06)', borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>💡 고품질 피드백을 받으려면</div>
                  <div>소재 A/B의 차이점과 검증하려는 맥락을 <strong>구체적으로 작성할수록</strong> 패널이 핵심을 짚은 비교 피드백을 제공합니다. 제출 전 제품 설명을 다시 한번 확인하세요.</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  ※ 첫 피드백 수신 후에는 의뢰 내용을 수정할 수 없습니다.
                </div>
              </div>
            }
            confirmLabel={isActiveEdit ? '수정 완료' : '제출하기'}
            cancelLabel="다시 확인"
            onConfirm={async () => { const ok = await handleSubmit(); if (ok) setShowSubmitConfirm(false); }}
            onCancel={() => { setShowSubmitConfirm(false); setSubmitError(''); }}
            errorMsg={submitError}
          />
        );
      })()}

      {terminateTarget && (
        <ConfirmModal
          title="의뢰를 조기 종료할까요?"
          width={450}
          desc={<div style={{ textAlign: 'left' }}><div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '13px 15px', background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, marginBottom: 13 }}><span style={{ fontSize: 17, lineHeight: 1.4 }}>⚠️</span><span style={{ fontSize: 14.5, fontWeight: 700, color: '#B45309', lineHeight: 1.45 }}>조기 종료 시 잔여 크레딧은 환불되지 않습니다.</span></div><div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>이미 수집된 피드백 결과는 <strong style={{ color: 'var(--text)' }}>'취소 탭'</strong>에서 계속 확인 가능합니다.</div></div>}
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

      {showDraftModal && ReactDOM.createPortal(
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '28px 24px', width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              if (dest && dest !== location.pathname) navigate(dest); else setView('list');
            }} disabled={savingDraft}>
              {savingDraft ? '저장 중...' : '임시 저장 후 나가기'}
            </Btn>
            <Btn variant="secondary" onClick={() => {
              navigationGuard.unregister();
              clearLocalDraft();  // 자발적 폐기 → localStorage 자동저장본도 제거 (배너 재등장 방지)
              setShowDraftModal(false);
              const dest = pendingNavPath;
              setPendingNavPath(null);
              if (dest && dest !== location.pathname) navigate(dest); else setView('list');
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
