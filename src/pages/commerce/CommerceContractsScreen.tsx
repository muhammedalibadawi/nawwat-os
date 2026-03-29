import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FoundationSubnav } from '@/components/commerceFoundation/FoundationSubnav';
import { fetchCrmContacts } from '@/services/crmService';
import {
  createCommercialContract,
  createCommercialContractVersion,
  getCommercialContractById,
  listCommercialContracts,
  promoteCommercialContractVersionToCurrent,
} from '@/services/commerceFoundationService';
import type {
  CommercialContractListItem,
  ContractCommissionTierBand,
  ContractCommissionTierMode,
  CommercialContractVersionWithTerms,
  CommercialContractVersionTermGroup,
  CommercialContractVersionTermRow,
  CreateCommercialContractInput,
  CreateCommercialContractVersionInput,
  CreateCommercialContractVersionTermInput,
} from '@/types/commerceFoundation';
import type { CrmContactRow } from '@/types/crm';

const TERM_GROUP_LABELS: Record<CommercialContractVersionTermGroup, string> = {
  commission: 'العمولة',
  payment_fee: 'رسوم الدفع',
  shipping_responsibility: 'الشحن',
  return_expiry: 'الإرجاع/الانقضاء',
  settlement: 'التسوية',
};

type TierBandDraft = { min_order_amount: string; max_order_amount: string; rate_bp: string };
type ContractsLayoutTab = 'contracts' | 'versions' | 'pricing';

const CommerceContractsScreen: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<CommercialContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creatingContract, setCreatingContract] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [promotingVersionId, setPromotingVersionId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractVersions, setContractVersions] = useState<CommercialContractVersionWithTerms[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [crmContacts, setCrmContacts] = useState<CrmContactRow[]>([]);
  const [previewOptionalFieldErrors, setPreviewOptionalFieldErrors] = useState<string[]>([]);
  const [legacyAliasWarnings, setLegacyAliasWarnings] = useState<string[]>([]);
  const [prefillKey, setPrefillKey] = useState<string | null>(null);
  const [advancedTermConfigMode, setAdvancedTermConfigMode] = useState(false);
  const [baseCommissionConfig, setBaseCommissionConfig] = useState<Record<string, unknown>>({
    basis: 'tiered',
    bearer: 'merchant',
    rate_bp: null,
  });
  const [tierMode, setTierMode] = useState<ContractCommissionTierMode>('single_band');
  const [tierBands, setTierBands] = useState<TierBandDraft[]>([
    { min_order_amount: '0', max_order_amount: '', rate_bp: '500' },
  ]);
  const [tierValidationErrors, setTierValidationErrors] = useState<string[]>([]);
  const [activeLayoutTab, setActiveLayoutTab] = useState<ContractsLayoutTab>('contracts');

  const [contractForm, setContractForm] = useState<CreateCommercialContractInput>({
    contract_code: '',
    name: '',
    counterparty_contact_id: null,
    summary: '',
    notes: '',
  });
  const [versionForm, setVersionForm] = useState({
    version_number: '',
    set_as_current: true,
    commission_summary: '',
    payment_fee_summary: '',
    shipping_responsibility_summary: '',
    return_expiry_summary: '',
    settlement_terms_summary: '',
    term_group: 'commission' as CommercialContractVersionTermGroup,
    term_code: '',
    term_label: '',
    term_summary: '',
    term_sort_order: '0',
    term_is_active: true,
    estimated_merchant_outbound_shipping: '',
    return_reserve_rate_bp: '',
    settlement_adjustment_rate_bp: '',
    payout_holdback_rate_bp: '',
    term_config_json: '{\n  "basis": "percent_of_line",\n  "rate_bp": 500,\n  "bearer": "merchant"\n}',
  });

  const selectedContract = useMemo(
    () => rows.find((row) => row.id === selectedContractId) ?? null,
    [rows, selectedContractId]
  );

  function validateTierBandsForUi(
    drafts: TierBandDraft[],
    mode: ContractCommissionTierMode
  ): { errors: string[]; normalized: ContractCommissionTierBand[] } {
    const errors: string[] = [];
    if (drafts.length === 0) {
      errors.push('يجب إضافة band واحدة على الأقل.');
      return { errors, normalized: [] };
    }

    const normalized: ContractCommissionTierBand[] = [];
    for (let i = 0; i < drafts.length; i += 1) {
      const row = drafts[i];
      const min = Number(row.min_order_amount);
      const rate = Number(row.rate_bp);
      const maxRaw = row.max_order_amount.trim();
      const max = maxRaw === '' ? null : Number(maxRaw);

      if (!Number.isFinite(min) || min < 0) {
        errors.push(`Band #${i + 1}: min_order_amount يجب أن يكون رقمًا >= 0.`);
      }
      if (!Number.isFinite(rate) || !Number.isInteger(rate) || rate < 0 || rate > 10000) {
        errors.push(`Band #${i + 1}: rate_bp يجب أن يكون عددًا صحيحًا بين 0 و 10000.`);
      }
      if (max !== null && (!Number.isFinite(max) || max < 0)) {
        errors.push(`Band #${i + 1}: max_order_amount يجب أن يكون >= 0 أو فارغًا (open-ended).`);
      }
      if (Number.isFinite(min) && max !== null && Number.isFinite(max) && max <= min) {
        errors.push(`Band #${i + 1}: max_order_amount يجب أن يكون أكبر من min_order_amount.`);
      }

      if (
        Number.isFinite(min) &&
        Number.isFinite(rate) &&
        Number.isInteger(rate) &&
        rate >= 0 &&
        rate <= 10000 &&
        (max === null || Number.isFinite(max))
      ) {
        normalized.push({
          min_order_amount: min,
          max_order_amount: max,
          rate_bp: rate,
        });
      }
    }

    const sorted = [...normalized].sort((a, b) => a.min_order_amount - b.min_order_amount);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.max_order_amount == null) {
        errors.push('Open-ended band (max فارغ) يجب أن تكون band الأخيرة.');
        break;
      }
      if (curr.min_order_amount < prev.max_order_amount) {
        errors.push('لا يجوز تداخل bands. راجع الحدود بين bands المتجاورة.');
        break;
      }
    }
    if (mode === 'progressive' && sorted.length > 0 && sorted[0].min_order_amount !== 0) {
      errors.push('في وضع progressive يجب أن تبدأ أول band من 0.');
    }

    return { errors, normalized: sorted };
  }

  function parseOptionalNonNegativeNumber(label: string, raw: string): { value: number | null; error: string | null } {
    const trimmed = raw.trim();
    if (!trimmed) return { value: null, error: null };
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { value: null, error: `${label} يجب أن يكون رقمًا >= 0 أو فارغًا.` };
    }
    return { value: parsed, error: null };
  }

  function parseOptionalBp(label: string, raw: string): { value: number | null; error: string | null } {
    const trimmed = raw.trim();
    if (!trimmed) return { value: null, error: null };
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
      return { value: null, error: `${label} يجب أن يكون عددًا صحيحًا بين 0 و 10000 أو فارغًا.` };
    }
    return { value: parsed, error: null };
  }

  function normalizePreviewConfigFromCurrentTerm(
    termGroup: CommercialContractVersionTermGroup,
    cfg: Record<string, unknown>
  ): {
    estimated_merchant_outbound_shipping: string;
    return_reserve_rate_bp: string;
    settlement_adjustment_rate_bp: string;
    aliasWarnings: string[];
  } {
    const aliasWarnings: string[] = [];
    let returnReserve: number | null = null;
    if (typeof cfg.return_reserve_rate_bp === 'number') {
      returnReserve = cfg.return_reserve_rate_bp;
    } else if (typeof cfg.reserve_rate_bp === 'number') {
      returnReserve = cfg.reserve_rate_bp;
      aliasWarnings.push('Legacy alias detected: reserve_rate_bp (using canonical return_reserve_rate_bp).');
    } else if (typeof cfg.return_reserve_bp === 'number') {
      returnReserve = cfg.return_reserve_bp;
      aliasWarnings.push('Legacy alias detected: return_reserve_bp (using canonical return_reserve_rate_bp).');
    }

    let settlementAdjustment: number | null = null;
    if (typeof cfg.settlement_adjustment_rate_bp === 'number') {
      settlementAdjustment = cfg.settlement_adjustment_rate_bp;
    } else if (typeof cfg.payout_holdback_rate_bp === 'number') {
      settlementAdjustment = cfg.payout_holdback_rate_bp;
      aliasWarnings.push(
        'Legacy alias detected: payout_holdback_rate_bp (using canonical settlement_adjustment_rate_bp).'
      );
    }

    return {
      estimated_merchant_outbound_shipping:
        termGroup === 'shipping_responsibility' && typeof cfg.estimated_merchant_outbound_shipping === 'number'
          ? String(cfg.estimated_merchant_outbound_shipping)
          : '',
      return_reserve_rate_bp: termGroup === 'return_expiry' && returnReserve != null ? String(returnReserve) : '',
      settlement_adjustment_rate_bp:
        termGroup === 'settlement' && settlementAdjustment != null ? String(settlementAdjustment) : '',
      aliasWarnings,
    };
  }

  function sanitizeTermConfigToCanonicalKeys(
    termGroup: CommercialContractVersionTermGroup,
    raw: Record<string, unknown>
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...raw };
    if (termGroup === 'return_expiry') {
      if (typeof out.return_reserve_rate_bp !== 'number') {
        if (typeof out.reserve_rate_bp === 'number') out.return_reserve_rate_bp = out.reserve_rate_bp;
        if (typeof out.return_reserve_bp === 'number') out.return_reserve_rate_bp = out.return_reserve_bp;
      }
      delete out.reserve_rate_bp;
      delete out.return_reserve_bp;
    }
    if (termGroup === 'settlement') {
      if (typeof out.settlement_adjustment_rate_bp !== 'number' && typeof out.payout_holdback_rate_bp === 'number') {
        out.settlement_adjustment_rate_bp = out.payout_holdback_rate_bp;
      }
      delete out.payout_holdback_rate_bp;
    }
    if (termGroup === 'commission' && out.basis === 'tiered') {
      out.bearer = typeof out.bearer === 'string' ? out.bearer : 'merchant';
      out.tier_mode = out.tier_mode === 'progressive' ? 'progressive' : 'single_band';
      out.rate_bp = null;
    }
    return out;
  }

  useEffect(() => {
    let ok = true;
    async function load() {
      if (!user?.tenant_id) {
        if (ok) {
          setRows([]);
          setError(null);
          setLoading(false);
        }
        return;
      }

      if (ok) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await listCommercialContracts(user.tenant_id);
        if (!ok) return;
        setRows(data);
        if (!selectedContractId && data.length > 0) {
          setSelectedContractId(data[0].id);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'فشل تحميل العقود';
        if (ok) setError(msg);
      } finally {
        if (ok) setLoading(false);
      }
    }
    load();

    return () => {
      ok = false;
    };
  }, [user?.tenant_id, selectedContractId]);

  useEffect(() => {
    let ok = true;
    async function loadContacts() {
      if (!user?.tenant_id) {
        if (ok) setCrmContacts([]);
        return;
      }
      try {
        const rows = await fetchCrmContacts(user.tenant_id);
        if (ok) setCrmContacts(rows);
      } catch {
        if (ok) setCrmContacts([]);
      }
    }
    loadContacts();
    return () => {
      ok = false;
    };
  }, [user?.tenant_id]);

  useEffect(() => {
    const currentVersion = selectedContract?.current_version;
    const key = currentVersion?.id ?? `contract-${selectedContractId ?? 'none'}`;
    if (!currentVersion || prefillKey === key) return;
    const commissionTerm = currentVersion.terms.find((term) => term.term_group === 'commission');
    if (!commissionTerm) {
      setPrefillKey(key);
      return;
    }
    const cfg = (commissionTerm.term_config ?? {}) as unknown as Record<string, unknown>;
    setBaseCommissionConfig(cfg);
    if (cfg.tier_mode === 'progressive' || cfg.tier_mode === 'single_band') {
      setTierMode(cfg.tier_mode);
    } else {
      setTierMode('single_band');
    }
    const tiers = (cfg.tier_json as { tiers?: ContractCommissionTierBand[] } | null)?.tiers;
    if (Array.isArray(tiers) && tiers.length > 0) {
      setTierBands(
        tiers.map((tier) => ({
          min_order_amount: String(tier.min_order_amount),
          max_order_amount: tier.max_order_amount == null ? '' : String(tier.max_order_amount),
          rate_bp: String(tier.rate_bp),
        }))
      );
    }
    setVersionForm((current) => ({
      ...current,
      term_group: 'commission',
      term_code: current.term_code || commissionTerm.term_code,
      term_label: current.term_label || commissionTerm.label,
      term_summary: current.term_summary || (commissionTerm.summary ?? ''),
      term_config_json: JSON.stringify(cfg, null, 2),
    }));
    setPrefillKey(key);
  }, [prefillKey, selectedContract?.current_version, selectedContractId]);

  useEffect(() => {
    const currentVersion = selectedContract?.current_version;
    if (!currentVersion) return;
    const term = currentVersion.terms.find((row) => row.term_group === versionForm.term_group);
    if (!term) return;
    const cfg = (term.term_config ?? {}) as unknown as Record<string, unknown>;
    const normalized = normalizePreviewConfigFromCurrentTerm(versionForm.term_group, cfg);
    setLegacyAliasWarnings(normalized.aliasWarnings);

    if (versionForm.term_group === 'shipping_responsibility') {
      setVersionForm((current) => ({
        ...current,
        estimated_merchant_outbound_shipping: normalized.estimated_merchant_outbound_shipping,
      }));
    }
    if (versionForm.term_group === 'return_expiry') {
      setVersionForm((current) => ({
        ...current,
        return_reserve_rate_bp: normalized.return_reserve_rate_bp,
      }));
    }
    if (versionForm.term_group === 'settlement') {
      setVersionForm((current) => ({
        ...current,
        settlement_adjustment_rate_bp: normalized.settlement_adjustment_rate_bp,
        payout_holdback_rate_bp: '',
      }));
    }
  }, [selectedContract?.current_version, versionForm.term_group]);

  useEffect(() => {
    let ok = true;
    async function loadVersions() {
      if (!user?.tenant_id || !selectedContractId) {
        setContractVersions([]);
        return;
      }
      setVersionsLoading(true);
      try {
        const data = await getCommercialContractById(user.tenant_id, selectedContractId);
        if (!ok) return;
        setContractVersions(data?.versions ?? []);
      } catch {
        if (ok) setContractVersions([]);
      } finally {
        if (ok) setVersionsLoading(false);
      }
    }
    loadVersions();
    return () => {
      ok = false;
    };
  }, [user?.tenant_id, selectedContractId]);

  async function refreshContractsAndVersions(contractIdHint?: string | null) {
    if (!user?.tenant_id) return;
    const data = await listCommercialContracts(user.tenant_id);
    setRows(data);
    const resolvedId = contractIdHint ?? selectedContractId ?? data[0]?.id ?? null;
    setSelectedContractId(resolvedId);
    if (resolvedId) {
      const details = await getCommercialContractById(user.tenant_id, resolvedId);
      setContractVersions(details?.versions ?? []);
    } else {
      setContractVersions([]);
    }
  }

  async function handleCreateContract(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.tenant_id) return;
    setActionError(null);
    setActionMessage(null);
    setCreatingContract(true);
    try {
      const payload: CreateCommercialContractInput = {
        contract_code: contractForm.contract_code,
        name: contractForm.name,
        counterparty_contact_id: contractForm.counterparty_contact_id ?? null,
        summary: contractForm.summary || null,
        notes: contractForm.notes || null,
      };
      const created = await createCommercialContract(user.tenant_id, payload);
      await refreshContractsAndVersions(created.id);
      setActionMessage(`تم إنشاء العقد بنجاح: ${created.id}`);
      setContractForm((current) => ({
        ...current,
        contract_code: '',
        name: '',
        counterparty_contact_id: null,
      }));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'فشل إنشاء العقد');
    } finally {
      setCreatingContract(false);
    }
  }

  async function handleCreateVersion(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.tenant_id || !selectedContractId) return;
    setActionError(null);
    setActionMessage(null);
    setCreatingVersion(true);
    setTierValidationErrors([]);
    setPreviewOptionalFieldErrors([]);
    try {
      let parsedTermConfig: Record<string, unknown> = {};
      if (!advancedTermConfigMode && versionForm.term_group === 'commission') {
        const { errors, normalized } = validateTierBandsForUi(tierBands, tierMode);
        if (errors.length > 0) {
          setTierValidationErrors(errors);
          setCreatingVersion(false);
          return;
        }
        parsedTermConfig = {
          basis: 'tiered',
          rate_bp: null,
          bearer: typeof baseCommissionConfig.bearer === 'string' ? baseCommissionConfig.bearer : 'merchant',
          tier_mode: tierMode,
          tier_json: { tiers: normalized },
        };
      } else {
        try {
          parsedTermConfig = JSON.parse(versionForm.term_config_json) as Record<string, unknown>;
        } catch {
          throw new Error('term_config JSON غير صالح.');
        }
      }
      parsedTermConfig = sanitizeTermConfigToCanonicalKeys(versionForm.term_group, parsedTermConfig);

      const optionalFieldErrors: string[] = [];
      if (versionForm.term_group === 'shipping_responsibility') {
        const parsed = parseOptionalNonNegativeNumber(
          'estimated_merchant_outbound_shipping',
          versionForm.estimated_merchant_outbound_shipping
        );
        if (parsed.error) optionalFieldErrors.push(parsed.error);
        if (parsed.value != null) {
          parsedTermConfig.estimated_merchant_outbound_shipping = parsed.value;
        } else {
          delete parsedTermConfig.estimated_merchant_outbound_shipping;
        }
      }
      if (versionForm.term_group === 'return_expiry') {
        const parsed = parseOptionalBp('return_reserve_rate_bp', versionForm.return_reserve_rate_bp);
        if (parsed.error) optionalFieldErrors.push(parsed.error);
        if (parsed.value != null) {
          parsedTermConfig.return_reserve_rate_bp = parsed.value;
        } else {
          delete parsedTermConfig.return_reserve_rate_bp;
        }
      }
      if (versionForm.term_group === 'settlement') {
        const settlementAdj = parseOptionalBp('settlement_adjustment_rate_bp', versionForm.settlement_adjustment_rate_bp);
        if (settlementAdj.error) optionalFieldErrors.push(settlementAdj.error);
        if (settlementAdj.value != null) {
          parsedTermConfig.settlement_adjustment_rate_bp = settlementAdj.value;
        } else {
          delete parsedTermConfig.settlement_adjustment_rate_bp;
        }
      }
      if (optionalFieldErrors.length > 0) {
        setPreviewOptionalFieldErrors(optionalFieldErrors);
        setCreatingVersion(false);
        return;
      }

      const termPayload: CreateCommercialContractVersionTermInput = {
        term_group: versionForm.term_group,
        term_code: versionForm.term_code.trim() || `${versionForm.term_group}_1`,
        label: versionForm.term_label.trim() || `${TERM_GROUP_LABELS[versionForm.term_group]} term`,
        summary: versionForm.term_summary.trim() || null,
        term_config: parsedTermConfig as unknown as CreateCommercialContractVersionTermInput['term_config'],
        sort_order: Number.isFinite(Number(versionForm.term_sort_order)) ? Math.max(0, Number(versionForm.term_sort_order)) : 0,
        is_active: versionForm.term_is_active,
      };

      const payload: CreateCommercialContractVersionInput = {
        contract_id: selectedContractId,
        version_number: versionForm.version_number.trim() ? Number(versionForm.version_number) : undefined,
        set_as_current: versionForm.set_as_current,
        commission_summary: versionForm.commission_summary || null,
        payment_fee_summary: versionForm.payment_fee_summary || null,
        shipping_responsibility_summary: versionForm.shipping_responsibility_summary || null,
        return_expiry_summary: versionForm.return_expiry_summary || null,
        settlement_terms_summary: versionForm.settlement_terms_summary || null,
        terms: [termPayload],
      };

      const created = await createCommercialContractVersion(user.tenant_id, payload);
      await refreshContractsAndVersions(selectedContractId);
      setActionMessage(`تم إنشاء نسخة العقد بنجاح: ${created.id}`);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'فشل إنشاء نسخة العقد');
    } finally {
      setCreatingVersion(false);
    }
  }

  async function handlePromoteVersion(versionId: string) {
    if (!selectedContractId) return;
    setActionError(null);
    setActionMessage(null);
    setPromotingVersionId(versionId);
    try {
      await promoteCommercialContractVersionToCurrent(selectedContractId, versionId);
      await refreshContractsAndVersions(selectedContractId);
      setActionMessage('تمت ترقية النسخة إلى current بنجاح.');
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'فشلت ترقية النسخة.');
    } finally {
      setPromotingVersionId(null);
    }
  }

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-6 pb-10 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-[1.65rem] font-black text-white">عقود القنوات والتسوية</h1>
        <p className="mt-1 text-sm font-bold text-content-3">
          عرض فعلي لبيانات <code className="rounded bg-black/30 px-1">commercial_contracts</code> وإصداراتها عبر{' '}
          <code className="rounded bg-black/30 px-1">commercial_contract_versions</code>، مع شروط مهيكلة عند توفرها في{' '}
          <code className="rounded bg-black/30 px-1">commercial_contract_version_terms</code>.
        </p>
      </div>
      <FoundationSubnav />
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-card p-2">
        <button
          type="button"
          onClick={() => setActiveLayoutTab('contracts')}
          className={`rounded-lg px-3 py-2 text-xs font-black ${
            activeLayoutTab === 'contracts' ? 'bg-cyan-500/15 text-cyan-100' : 'bg-black/20 text-content-3'
          }`}
        >
          Contracts
        </button>
        <button
          type="button"
          onClick={() => setActiveLayoutTab('versions')}
          className={`rounded-lg px-3 py-2 text-xs font-black ${
            activeLayoutTab === 'versions' ? 'bg-cyan-500/15 text-cyan-100' : 'bg-black/20 text-content-3'
          }`}
        >
          Versions & Terms
        </button>
        <button
          type="button"
          onClick={() => setActiveLayoutTab('pricing')}
          className={`rounded-lg px-3 py-2 text-xs font-black ${
            activeLayoutTab === 'pricing' ? 'bg-cyan-500/15 text-cyan-100' : 'bg-black/20 text-content-3'
          }`}
        >
          Pricing Preview
        </button>
      </div>

      <section className="rounded-[20px] border border-border bg-surface-card p-5">
        <h2 className="text-sm font-black text-white">Authoring (minimal RPC flow)</h2>
        <p className="mt-2 text-xs font-bold leading-6 text-content-3">
          الكتابة تتم فقط عبر wrappers الحالية في <code className="rounded bg-black/30 px-1">commerceFoundationService</code>.
        </p>

        {actionMessage && <p className="mt-3 text-xs font-black text-emerald-200">{actionMessage}</p>}
        {actionError && <p className="mt-3 text-xs font-black text-red-300">{actionError}</p>}
        {legacyAliasWarnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
            {legacyAliasWarnings.map((warning) => (
              <p key={warning} className="text-[11px] font-black text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        )}

        {activeLayoutTab === 'contracts' && (
          <div className="mt-4">
            <form onSubmit={handleCreateContract} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-cyan-200">Create contract</h3>
            <div className="mt-3 grid gap-3">
              <TextField
                label="Contract code"
                value={contractForm.contract_code}
                onChange={(value) => setContractForm((current) => ({ ...current, contract_code: value }))}
                required
              />
              <TextField
                label="Name"
                value={contractForm.name}
                onChange={(value) => setContractForm((current) => ({ ...current, name: value }))}
                required
              />
              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-content-3">Counterparty contact (CRM)</span>
                <select
                  value={contractForm.counterparty_contact_id ?? ''}
                  onChange={(event) =>
                    setContractForm((current) => ({
                      ...current,
                      counterparty_contact_id: event.target.value || null,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  <option value="">— بدون جهة مقابلة —</option>
                  {crmContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.type ? ` (${contact.type})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Summary"
                value={contractForm.summary ?? ''}
                onChange={(value) => setContractForm((current) => ({ ...current, summary: value }))}
              />
              <TextField
                label="Notes"
                value={contractForm.notes ?? ''}
                onChange={(value) => setContractForm((current) => ({ ...current, notes: value }))}
              />
              <button
                type="submit"
                disabled={creatingContract}
                className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-60"
              >
                {creatingContract ? 'جاري الإنشاء...' : 'إنشاء عقد'}
              </button>
            </div>
            </form>
          </div>
        )}

        {activeLayoutTab === 'versions' && (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <form onSubmit={handleCreateVersion} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-cyan-200">Create version + term payload</h3>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-content-3">Target contract</span>
                <select
                  value={selectedContractId ?? ''}
                  onChange={(event) => setSelectedContractId(event.target.value || null)}
                  className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  <option value="">{rows.length ? 'اختر عقدًا' : 'لا توجد عقود'}</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.contract_code} - {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Version number (optional)"
                value={versionForm.version_number}
                onChange={(value) => setVersionForm((current) => ({ ...current, version_number: value }))}
              />
              <label className="flex items-center gap-2 text-xs font-bold text-content-3">
                <input
                  type="checkbox"
                  checked={versionForm.set_as_current}
                  onChange={(event) => setVersionForm((current) => ({ ...current, set_as_current: event.target.checked }))}
                />
                set_as_current
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-content-3">Term group</span>
                <select
                  value={versionForm.term_group}
                  onChange={(event) =>
                    setVersionForm((current) => ({ ...current, term_group: event.target.value as CommercialContractVersionTermGroup }))
                  }
                  className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  {Object.keys(TERM_GROUP_LABELS).map((key) => (
                    <option key={key} value={key}>
                      {TERM_GROUP_LABELS[key as CommercialContractVersionTermGroup]}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Term code"
                value={versionForm.term_code}
                onChange={(value) => setVersionForm((current) => ({ ...current, term_code: value }))}
              />
              <TextField
                label="Term label"
                value={versionForm.term_label}
                onChange={(value) => setVersionForm((current) => ({ ...current, term_label: value }))}
              />
              {(versionForm.term_group === 'shipping_responsibility' ||
                versionForm.term_group === 'return_expiry' ||
                versionForm.term_group === 'settlement') && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
                  <p className="text-[11px] font-black text-amber-100">Preview-affecting optional fields</p>
                  <p className="mt-1 text-[11px] font-bold leading-5 text-amber-100/90">
                    ترك هذه الحقول فارغة سيجعل CommercePricingScreen يستخدم fallback assumptions بدل values مباشرة من term_config.
                  </p>
                  <div className="mt-2 grid gap-2">
                    {versionForm.term_group === 'shipping_responsibility' && (
                      <TextField
                        label="estimated_merchant_outbound_shipping (optional)"
                        value={versionForm.estimated_merchant_outbound_shipping}
                        onChange={(value) =>
                          setVersionForm((current) => ({ ...current, estimated_merchant_outbound_shipping: value }))
                        }
                      />
                    )}
                    {versionForm.term_group === 'return_expiry' && (
                      <TextField
                        label="return_reserve_rate_bp (optional, 0..10000)"
                        value={versionForm.return_reserve_rate_bp}
                        onChange={(value) => setVersionForm((current) => ({ ...current, return_reserve_rate_bp: value }))}
                      />
                    )}
                    {versionForm.term_group === 'settlement' && (
                      <>
                        <TextField
                          label="settlement_adjustment_rate_bp (optional, 0..10000)"
                          value={versionForm.settlement_adjustment_rate_bp}
                          onChange={(value) =>
                            setVersionForm((current) => ({ ...current, settlement_adjustment_rate_bp: value }))
                          }
                        />
                        <p className="text-[11px] font-bold leading-5 text-content-3">
                          Canonical persistence uses <code className="rounded bg-black/30 px-1">settlement_adjustment_rate_bp</code> فقط.
                          أي alias legacy مثل <code className="rounded bg-black/30 px-1">payout_holdback_rate_bp</code> يُقرأ للتوافق
                          لكنه لا يُحفظ من هذه الواجهة.
                        </p>
                      </>
                    )}
                  </div>
                  {previewOptionalFieldErrors.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[11px] font-black text-red-300">
                      {previewOptionalFieldErrors.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {versionForm.term_group === 'commission' && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-black text-cyan-100">Tier settings (structured)</p>
                    <label className="flex items-center gap-2 text-[11px] font-bold text-content-3">
                      <input
                        type="checkbox"
                        checked={advancedTermConfigMode}
                        onChange={(event) => setAdvancedTermConfigMode(event.target.checked)}
                      />
                      Advanced JSON mode
                    </label>
                  </div>
                  {!advancedTermConfigMode ? (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black text-content-3">tier_mode</span>
                        <select
                          value={tierMode}
                          onChange={(event) => setTierMode(event.target.value as ContractCommissionTierMode)}
                          className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none"
                        >
                          <option value="single_band">single_band</option>
                          <option value="progressive">progressive</option>
                        </select>
                      </label>
                      <div className="mt-2 space-y-2">
                        {tierBands.map((band, index) => (
                          <div key={`band-${index}`} className="grid gap-2 sm:grid-cols-4">
                            <input
                              value={band.min_order_amount}
                              onChange={(event) =>
                                setTierBands((current) =>
                                  current.map((row, i) => (i === index ? { ...row, min_order_amount: event.target.value } : row))
                                )
                              }
                              placeholder="min"
                              className="rounded-lg border border-border bg-black/20 px-2 py-2 text-xs font-bold text-white outline-none"
                            />
                            <input
                              value={band.max_order_amount}
                              onChange={(event) =>
                                setTierBands((current) =>
                                  current.map((row, i) => (i === index ? { ...row, max_order_amount: event.target.value } : row))
                                )
                              }
                              placeholder="max (blank=open)"
                              className="rounded-lg border border-border bg-black/20 px-2 py-2 text-xs font-bold text-white outline-none"
                            />
                            <input
                              value={band.rate_bp}
                              onChange={(event) =>
                                setTierBands((current) =>
                                  current.map((row, i) => (i === index ? { ...row, rate_bp: event.target.value } : row))
                                )
                              }
                              placeholder="rate_bp"
                              className="rounded-lg border border-border bg-black/20 px-2 py-2 text-xs font-bold text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setTierBands((current) => current.filter((_, i) => i !== index))}
                              disabled={tierBands.length <= 1}
                              className="rounded-lg border border-white/20 px-2 py-2 text-[11px] font-black text-white disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setTierBands((current) => [...current, { min_order_amount: '', max_order_amount: '', rate_bp: '' }])
                          }
                          className="rounded-lg border border-white/20 px-2 py-2 text-[11px] font-black text-white"
                        >
                          + Add band
                        </button>
                      </div>
                      {tierValidationErrors.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] font-black text-red-300">
                          {tierValidationErrors.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black text-content-3">term_config JSON (fallback)</span>
                      <textarea
                        value={versionForm.term_config_json}
                        onChange={(event) => setVersionForm((current) => ({ ...current, term_config_json: event.target.value }))}
                        className="min-h-[130px] w-full rounded-lg border border-border bg-black/20 px-3 py-2 font-mono text-[11px] text-white outline-none"
                      />
                    </label>
                  )}
                </div>
              )}
              {versionForm.term_group !== 'commission' && (
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black text-content-3">term_config JSON</span>
                  <textarea
                    value={versionForm.term_config_json}
                    onChange={(event) => setVersionForm((current) => ({ ...current, term_config_json: event.target.value }))}
                    className="min-h-[130px] w-full rounded-lg border border-border bg-black/20 px-3 py-2 font-mono text-[11px] text-white outline-none"
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={creatingVersion || !selectedContractId}
                className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-60"
              >
                {creatingVersion ? 'جاري الإنشاء...' : 'إنشاء نسخة + term'}
              </button>
            </div>
            </form>
          </div>
        )}

        {activeLayoutTab === 'versions' && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="text-xs font-black uppercase tracking-wide text-cyan-200">Promote existing version to current</h3>
          {!selectedContractId ? (
            <p className="mt-2 text-xs font-bold text-content-3">اختر عقدًا من القائمة أعلاه.</p>
          ) : versionsLoading ? (
            <p className="mt-2 text-xs font-bold text-content-3">جاري تحميل النسخ...</p>
          ) : contractVersions.length === 0 ? (
            <p className="mt-2 text-xs font-bold text-content-3">لا توجد نسخ لهذا العقد.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {contractVersions.map((version) => {
                const isCurrent = selectedContract?.current_version?.id === version.id;
                return (
                  <div key={version.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs font-bold text-content-3">
                      v{version.version_number} {isCurrent ? '(current)' : ''}
                    </p>
                    <button
                      type="button"
                      disabled={isCurrent || promotingVersionId === version.id}
                      onClick={() => handlePromoteVersion(version.id)}
                      className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                    >
                      {promotingVersionId === version.id ? 'جاري...' : 'Promote'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        )}

        {activeLayoutTab === 'pricing' && (
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/5 p-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-cyan-200">Pricing Preview</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-content-3">
              استخدم روابط <code className="rounded bg-black/30 px-1">Simulate current version</code> في العقود أدناه لفتح
              محاكي التسعير على نفس contract/version بدون أي تغيير backend.
            </p>
          </div>
        )}
      </section>

      {loading && <p className="text-sm font-bold text-content-3">جاري التحميل...</p>}
      {error && <p className="text-sm font-bold text-red-300">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-amber-400/30 bg-amber-500/5 p-8">
          <p className="text-sm font-black text-amber-100">لا توجد عقود مسجلة لهذا التينانت بعد</p>
          <p className="mt-2 text-xs font-bold leading-6 text-content-3">
            السبب: النظام لم يجد صفوفًا في <code className="rounded bg-black/30 px-1">commercial_contracts</code> (أو لا توجد
            إصدارات حالية في <code className="rounded bg-black/30 px-1">commercial_contract_versions</code>) ضمن نطاق صلاحياتك و
            <code className="rounded bg-black/30 px-1">tenant_id</code>.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (activeLayoutTab === 'contracts' || activeLayoutTab === 'pricing') && (
        <div className="grid gap-4">
          {rows.map((row) => (
            <ContractCard key={row.id} contract={row} crmContacts={crmContacts} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommerceContractsScreen;

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black text-content-3">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none"
      />
    </label>
  );
}

function formatDateAr(input: string | null): string {
  if (!input) return '—';
  try {
    return new Date(input).toLocaleDateString('ar-AE');
  } catch {
    return '—';
  }
}

function formatDateTimeAr(input: string | null): string {
  if (!input) return '—';
  try {
    return new Date(input).toLocaleString('ar-AE');
  } catch {
    return '—';
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function joinParts(parts: Array<string | null>): string {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(' • ') : '—';
}

function formatBasis(value: string | null): string | null {
  const labels: Record<string, string> = {
    percent_of_line: 'نسبة من السطر',
    percent_of_order_net: 'نسبة من صافي الطلب',
    tiered: 'مدرج',
    percent_of_gmv: 'نسبة من إجمالي المبيعات',
    fixed_per_order: 'قيمة ثابتة لكل طلب',
    percent_of_payment: 'نسبة من عملية الدفع',
  };
  return value ? labels[value] ?? value : null;
}

function formatParty(value: string | null): string | null {
  const labels: Record<string, string> = {
    merchant: 'التاجر',
    channel: 'القناة',
    customer: 'العميل',
    split: 'مشترك',
    dynamic_by_region: 'ديناميكي حسب المنطقة',
    case_by_case: 'حالة بحالة',
    channel_collects_then_payout: 'القناة تجمع ثم تدفع',
    merchant_collects_then_fees_due: 'التاجر يجمع ثم تُخصم الرسوم',
    split_settlement: 'تسوية مشتركة',
    manual_reconciliation: 'تسوية يدوية',
  };
  return value ? labels[value] ?? value : null;
}

function describeCommercialContractTerm(term: CommercialContractVersionTermRow): string {
  const config = term.term_config as unknown as Record<string, unknown>;

  switch (term.term_group) {
    case 'commission':
      return joinParts([
        formatBasis(asString(config.basis)),
        asNumber(config.rate_bp) != null ? `${asNumber(config.rate_bp)} bp` : null,
        formatParty(asString(config.bearer)),
      ]);
    case 'payment_fee':
      return joinParts([
        formatBasis(asString(config.fee_type)),
        asNumber(config.rate_bp) != null ? `${asNumber(config.rate_bp)} bp` : null,
        asNumber(config.fixed_amount) != null ? `${asNumber(config.fixed_amount)} ${asString(config.currency) ?? ''}`.trim() : null,
        formatParty(asString(config.bearer)),
      ]);
    case 'shipping_responsibility':
      return joinParts([
        formatParty(asString(config.responsible_party)),
        asNumber(config.estimated_merchant_outbound_shipping) != null
          ? `تقدير شحن للتاجر ${asNumber(config.estimated_merchant_outbound_shipping)}`
          : null,
        asString(config.notes),
      ]);
    case 'return_expiry':
      return joinParts([
        asString(config.return_window),
        formatParty(asString(config.expiry_handling)),
        asNumber(config.restock_fee_bp) != null ? `${asNumber(config.restock_fee_bp)} bp restock` : null,
        asNumber(config.return_reserve_rate_bp) != null ? `احتياطي معاينة ${asNumber(config.return_reserve_rate_bp)} bp` : null,
        asString(config.notes),
      ]);
    case 'settlement':
      return joinParts([
        formatParty(asString(config.settlement_direction)),
        asNumber(config.payout_cycle_days) != null ? `دورة ${asNumber(config.payout_cycle_days)} يوم` : null,
        asNumber(config.payout_delay_days) != null ? `تأخير ${asNumber(config.payout_delay_days)} يوم` : null,
        asNumber(config.settlement_adjustment_rate_bp) != null
          ? `تعديل معاينة ${asNumber(config.settlement_adjustment_rate_bp)} bp`
          : null,
        asString(config.notes),
      ]);
    default:
      return term.summary ?? '—';
  }
}

function ContractCard({
  contract,
  crmContacts,
}: {
  contract: CommercialContractListItem;
  crmContacts: CrmContactRow[];
}) {
  const version = contract.current_version;
  const structuredTerms = version?.terms ?? [];
  const hasStructuredTerms = structuredTerms.length > 0;
  const hasAnyVersionText =
    Boolean(version?.commission_summary) ||
    Boolean(version?.payment_fee_summary) ||
    Boolean(version?.shipping_responsibility_summary) ||
    Boolean(version?.return_expiry_summary) ||
    Boolean(version?.settlement_terms_summary);
  const counterparty = contract.counterparty_contact_id
    ? crmContacts.find((contact) => contact.id === contract.counterparty_contact_id) ?? null
    : null;

  return (
    <section className="rounded-[20px] border border-border bg-surface-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-white">
            <span className="text-cyan-200/90">{contract.contract_code}</span>
            {' — '}
            {contract.name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-content-3">
            <span>الحالة: {contract.status}</span>
            <span>من: {formatDateAr(contract.effective_from)}</span>
            <span>إلى: {formatDateAr(contract.effective_to)}</span>
            <span>
              counterparty:{' '}
              {counterparty
                ? `${counterparty.name}${counterparty.type ? ` (${counterparty.type})` : ''}`
                : contract.counterparty_contact_id
                  ? contract.counterparty_contact_id
                  : '—'}
            </span>
          </div>

          {contract.summary && (
            <p className="mt-3 text-xs font-bold leading-6 text-content-3">
              <span className="text-white/90">ملخص العقد:</span> {contract.summary}
            </p>
          )}
          {contract.notes && (
            <p className="mt-2 text-xs font-bold leading-6 text-content-3">
              <span className="text-white/90">ملاحظات:</span> {contract.notes}
            </p>
          )}
          {version && (
            <div className="mt-3">
              <Link
                to={`/commerce/foundation/pricing?contractId=${contract.id}&versionId=${version.id}`}
                className="inline-flex rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-100"
              >
                Simulate current version
              </Link>
            </div>
          )}
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-black/20 p-4 sm:w-[320px]">
          {version ? (
            <>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-200">النسخة الحالية</p>
              <p className="mt-2 text-sm font-black text-white">v{version.version_number}</p>
              <p className="mt-1 text-xs font-bold text-content-3">آخر تحديث: {formatDateTimeAr(version.created_at)}</p>
              <p className="mt-3 text-[11px] font-bold text-content-3">
                شروط مهيكلة: <span className="text-white">{structuredTerms.length}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-wide text-purple-200">لا توجد نسخة حالية</p>
              <p className="mt-2 text-xs font-bold leading-6 text-content-3">
                سيتم عرض شروط العمولة والرسوم والشحن والإرجاع بعد تفعيل الإصدار الأول.
              </p>
            </>
          )}
        </div>
      </div>

      {version && hasStructuredTerms && (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-emerald-200">الشروط المهيكلة</h3>
            <span className="rounded-full border border-emerald-300/20 bg-black/20 px-2 py-1 text-[11px] font-black text-emerald-100">
              {structuredTerms.length} term(s)
            </span>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {structuredTerms.map((term) => (
              <div key={term.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">{term.label}</p>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-cyan-100">
                    {TERM_GROUP_LABELS[term.term_group]}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold leading-6 text-content-3">{describeCommercialContractTerm(term)}</p>
                {term.summary && <p className="mt-2 text-[11px] font-bold leading-6 text-white/80">{term.summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-xs font-black uppercase tracking-wide text-cyan-200">ملخص شروط الإصدار</h3>
        {version ? (
          hasAnyVersionText ? (
            <dl className="mt-3 grid gap-3 text-xs font-bold md:grid-cols-2">
              <div>
                <dt className="text-content-3">العمولة</dt>
                <dd className="mt-1 text-white/90">{version.commission_summary ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-content-3">رسوم الدفع</dt>
                <dd className="mt-1 text-white/90">{version.payment_fee_summary ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-content-3">مسؤولية الشحن</dt>
                <dd className="mt-1 text-white/90">{version.shipping_responsibility_summary ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-content-3">الإرجاع/الانقضاء</dt>
                <dd className="mt-1 text-white/90">{version.return_expiry_summary ?? '—'}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-content-3">شروط التسوية</dt>
                <dd className="mt-1 text-white/90">{version.settlement_terms_summary ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-xs font-bold leading-6 text-content-3">
              نسخة موجودة، لكن لا توجد ملخصات نصية للرسوم والعمولة والشروط حتى الآن.
            </p>
          )
        ) : (
          <p className="mt-3 text-xs font-bold leading-6 text-content-3">
            لا يمكن عرض ملخصات الشروط بدون وجود نسخة حالية مرتبطة بالعقد.
          </p>
        )}
      </div>
    </section>
  );
}
