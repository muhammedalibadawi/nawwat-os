import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FoundationSubnav } from '@/components/commerceFoundation/FoundationSubnav';
import {
  describeMarginEngineStatus,
  getChannelPriceBookById,
  getChannelPricingRulesByPriceBook,
  getPricingSimulatorPreview,
  loadPricingSimulatorContext,
} from '@/services/commerceFoundationService';
import type {
  ChannelPriceBook,
  ChannelPriceBookDetail,
  ChannelPriceBookLine,
  ChannelPricingRule,
  ChannelPricingRuleType,
  CommercialContractListItem,
  PricingSimulatorInput,
  PricingSimulatorPreview,
} from '@/types/commerceFoundation';

const RULE_TYPE_LABELS: Record<ChannelPricingRuleType, string> = {
  min_price_override: 'حد أدنى بديل',
  target_margin_pct: 'هامش مستهدف',
  max_discount_pct: 'أقصى خصم',
  merchant_of_record: 'Merchant of Record',
  flow_type: 'اتجاه التدفق',
};

const INITIAL_SIMULATOR_INPUT: PricingSimulatorInput = {
  channel_account_id: null,
  contract_id: null,
  price_book_id: null,
  canonical_sku_id: null,
  quantity: 1,
  requested_discount_pct: 0,
  shipping_charge_to_customer: 0,
  unit_cogs_override: null,
};

const CommercePricingScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [contracts, setContracts] = useState<CommercialContractListItem[]>([]);
  const [books, setBooks] = useState<ChannelPriceBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<ChannelPriceBookDetail | null>(null);
  const [rules, setRules] = useState<ChannelPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [simulatorInput, setSimulatorInput] = useState<PricingSimulatorInput>(INITIAL_SIMULATOR_INPUT);
  const [preview, setPreview] = useState<PricingSimulatorPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [navigationPrefillApplied, setNavigationPrefillApplied] = useState(false);
  const engine = describeMarginEngineStatus();
  const requestedContractId = searchParams.get('contractId');
  const requestedVersionId = searchParams.get('versionId');

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user?.tenant_id) {
        if (active) {
          setContracts([]);
          setBooks([]);
          setSelectedBookId(null);
          setSelectedBook(null);
          setRules([]);
          setSimulatorInput(INITIAL_SIMULATOR_INPUT);
          setPreview(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const context = await loadPricingSimulatorContext(user.tenant_id);
        if (!active) return;
        setContracts(context.contracts);
        setBooks(context.price_books);
        const defaultBookId = context.price_books.find((book) => book.is_default)?.id ?? context.price_books[0]?.id ?? null;
        setSelectedBookId((current) =>
          current && context.price_books.some((book) => book.id === current) ? current : defaultBookId
        );
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'فشل تحميل طبقة التسعير');
        setContracts([]);
        setBooks([]);
        setSelectedBookId(null);
        setSelectedBook(null);
        setRules([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.tenant_id]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user?.tenant_id || !selectedBookId) {
        if (active) {
          setSelectedBook(null);
          setDetailError(null);
          setDetailLoading(false);
        }
        return;
      }

      setDetailLoading(true);
      setDetailError(null);
      try {
        const data = await getChannelPriceBookById(user.tenant_id, selectedBookId);
        if (active) setSelectedBook(data);
      } catch (e: unknown) {
        if (active) {
          setSelectedBook(null);
          setDetailError(e instanceof Error ? e.message : 'فشل تحميل تفاصيل دفتر السعر');
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedBookId, user?.tenant_id]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user?.tenant_id || !selectedBookId) {
        if (active) {
          setRules([]);
          setRulesError(null);
          setRulesLoading(false);
        }
        return;
      }

      setRulesLoading(true);
      setRulesError(null);
      try {
        const data = await getChannelPricingRulesByPriceBook(user.tenant_id, selectedBookId);
        if (active) setRules(data);
      } catch (e: unknown) {
        if (active) {
          setRules([]);
          setRulesError(e instanceof Error ? e.message : 'فشل تحميل قواعد التسعير');
        }
      } finally {
        if (active) setRulesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedBookId, user?.tenant_id]);

  const filteredBooks = useMemo(() => {
    if (!simulatorInput.channel_account_id) return books;
    return books.filter((book) => book.channel_account_id === simulatorInput.channel_account_id);
  }, [books, simulatorInput.channel_account_id]);

  const filteredContracts = useMemo(
    () =>
      contracts.filter((contract) => {
        if (!contract.current_version) return false;
        if (!simulatorInput.channel_account_id) return true;
        return contract.channel_account_id === simulatorInput.channel_account_id || contract.channel_account_id == null;
      }),
    [contracts, simulatorInput.channel_account_id]
  );
  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === simulatorInput.contract_id) ?? null,
    [contracts, simulatorInput.contract_id]
  );
  const selectedCurrentVersion = selectedContract?.current_version ?? null;
  const selectedContractOptionalFieldWarnings = useMemo(() => {
    if (!selectedCurrentVersion) return [];

    const shippingTerm = selectedCurrentVersion.terms.find((term) => term.term_group === 'shipping_responsibility');
    const returnTerm = selectedCurrentVersion.terms.find((term) => term.term_group === 'return_expiry');
    const settlementTerm = selectedCurrentVersion.terms.find((term) => term.term_group === 'settlement');

    const shippingConfig = (shippingTerm?.term_config ?? {}) as Record<string, unknown>;
    const returnConfig = (returnTerm?.term_config ?? {}) as Record<string, unknown>;
    const settlementConfig = (settlementTerm?.term_config ?? {}) as Record<string, unknown>;
    const warnings: string[] = [];

    if (!shippingTerm) {
      warnings.push('لا يوجد term للشحن: merchant shipping burden سيبقى fallback-only.');
    } else if (
      (shippingConfig.responsible_party === 'merchant' || shippingConfig.responsible_party === 'split') &&
      typeof shippingConfig.estimated_merchant_outbound_shipping !== 'number'
    ) {
      warnings.push('estimated_merchant_outbound_shipping غير موجود: عبء شحن التاجر سيظهر كفرضية وليس قيمة دقيقة.');
    }

    if (!returnTerm) {
      warnings.push('لا يوجد term للإرجاع/الانقضاء: return reserve preview سيستخدم fallback (0 bp).');
    } else if (
      typeof returnConfig.return_reserve_rate_bp !== 'number' &&
      typeof returnConfig.reserve_rate_bp !== 'number'
    ) {
      warnings.push('return_reserve_rate_bp غير موجود: return reserve preview سيستخدم fallback (0 bp).');
    }

    if (!settlementTerm) {
      warnings.push('لا يوجد term للتسوية: settlement adjustment preview سيستخدم fallback (0 bp).');
    } else if (
      typeof settlementConfig.settlement_adjustment_rate_bp !== 'number' &&
      typeof settlementConfig.payout_holdback_rate_bp !== 'number'
    ) {
      warnings.push('settlement_adjustment_rate_bp / payout_holdback_rate_bp غير موجودين: settlement adjustment preview سيستخدم fallback (0 bp).');
    }

    return warnings;
  }, [selectedCurrentVersion]);
  const selectedContractLegacyAliasWarnings = useMemo(() => {
    if (!selectedCurrentVersion) return [];
    const returnTerm = selectedCurrentVersion.terms.find((term) => term.term_group === 'return_expiry');
    const settlementTerm = selectedCurrentVersion.terms.find((term) => term.term_group === 'settlement');
    const returnConfig = (returnTerm?.term_config ?? {}) as Record<string, unknown>;
    const settlementConfig = (settlementTerm?.term_config ?? {}) as Record<string, unknown>;
    const warnings: string[] = [];

    if (
      typeof returnConfig.return_reserve_rate_bp !== 'number' &&
      (typeof returnConfig.reserve_rate_bp === 'number' || typeof returnConfig.return_reserve_bp === 'number')
    ) {
      warnings.push('Legacy alias in current term_config: reserve_rate_bp/return_reserve_bp (canonical is return_reserve_rate_bp).');
    }
    if (
      typeof settlementConfig.settlement_adjustment_rate_bp !== 'number' &&
      typeof settlementConfig.payout_holdback_rate_bp === 'number'
    ) {
      warnings.push('Legacy alias in current term_config: payout_holdback_rate_bp (canonical is settlement_adjustment_rate_bp).');
    }

    return warnings;
  }, [selectedCurrentVersion]);

  useEffect(() => {
    if (navigationPrefillApplied || loading || !requestedContractId) return;
    const contract = contracts.find((row) => row.id === requestedContractId);
    if (!contract || !contract.current_version) {
      setNavigationPrefillApplied(true);
      return;
    }
    if (requestedVersionId && contract.current_version.id !== requestedVersionId) {
      setNavigationPrefillApplied(true);
      return;
    }

    const scopedBooks = contract.channel_account_id
      ? books.filter((book) => book.channel_account_id === contract.channel_account_id)
      : books;
    const nextBookId = scopedBooks.find((book) => book.is_default)?.id ?? scopedBooks[0]?.id ?? null;
    setSelectedBookId(nextBookId);
    setSimulatorInput((current) => ({
      ...current,
      channel_account_id: contract.channel_account_id,
      contract_id: contract.id,
      price_book_id: nextBookId,
      canonical_sku_id: null,
    }));
    setNavigationPrefillApplied(true);
  }, [books, contracts, loading, navigationPrefillApplied, requestedContractId, requestedVersionId]);

  useEffect(() => {
    if (loading) return;
    if (!selectedBookId || !filteredBooks.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(filteredBooks.find((book) => book.is_default)?.id ?? filteredBooks[0]?.id ?? null);
    }
  }, [filteredBooks, loading, selectedBookId]);

  useEffect(() => {
    const book = books.find((row) => row.id === selectedBookId) ?? null;
    setSimulatorInput((current) => ({
      ...current,
      price_book_id: book?.id ?? null,
      canonical_sku_id: current.price_book_id === book?.id ? current.canonical_sku_id : null,
    }));
  }, [books, selectedBookId]);

  useEffect(() => {
    const lineId = selectedBook?.lines[0]?.canonical_sku_id ?? null;
    setSimulatorInput((current) => {
      if (!selectedBook?.lines.length) return current.canonical_sku_id == null ? current : { ...current, canonical_sku_id: null };
      if (current.canonical_sku_id && selectedBook.lines.some((line) => line.canonical_sku_id === current.canonical_sku_id)) {
        return current;
      }
      return { ...current, canonical_sku_id: lineId };
    });
  }, [selectedBook]);

  useEffect(() => {
    setSimulatorInput((current) => {
      if (filteredContracts.length === 0) return current.contract_id == null ? current : { ...current, contract_id: null };
      if (current.contract_id && filteredContracts.some((contract) => contract.id === current.contract_id)) return current;
      return { ...current, contract_id: filteredContracts[0].id };
    });
  }, [filteredContracts]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user?.tenant_id || !simulatorInput.contract_id || !simulatorInput.price_book_id || !simulatorInput.canonical_sku_id) {
        if (active) {
          setPreview(null);
          setPreviewError(null);
          setPreviewLoading(false);
        }
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const data = await getPricingSimulatorPreview(user.tenant_id, simulatorInput);
        if (active) setPreview(data);
      } catch (e: unknown) {
        if (active) {
          setPreview(null);
          setPreviewError(e instanceof Error ? e.message : 'فشل تحميل المعاينة');
        }
      } finally {
        if (active) setPreviewLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    simulatorInput.canonical_sku_id,
    simulatorInput.contract_id,
    simulatorInput.price_book_id,
    simulatorInput.quantity,
    simulatorInput.requested_discount_pct,
    simulatorInput.shipping_charge_to_customer,
    simulatorInput.unit_cogs_override,
    user?.tenant_id,
  ]);

  const simulatorReady = Boolean(
    simulatorInput.contract_id && simulatorInput.price_book_id && simulatorInput.canonical_sku_id
  );

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-6 pb-10 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-[1.65rem] font-black text-white">تسعير القناة ودفاتر الأسعار</h1>
        <p className="mt-1 text-sm font-bold text-content-3">
          قراءة فعلية لبيانات <code className="rounded bg-black/30 px-1">channel_price_books</code> و
          <code className="mx-1 rounded bg-black/30 px-1">channel_price_book_lines</code> و
          <code className="rounded bg-black/30 px-1">channel_pricing_rules</code> مع simulator scaffold للقراءة فقط.
        </p>
      </div>
      <FoundationSubnav />

      <section className="rounded-[20px] border border-border bg-surface-card p-5">
        <h2 className="text-xs font-black uppercase tracking-wide text-cyan-200">حالة طبقة التسعير</h2>
        <p className="mt-2 text-xs font-bold leading-6 text-content-3">{engine.note}</p>
      </section>

      {loading && (
        <div className="rounded-[20px] border border-white/10 bg-white/5 p-8 text-sm font-bold text-content-3">
          جاري تحميل طبقة التسعير...
        </div>
      )}

      {error && (
        <div className="rounded-[20px] border border-red-400/30 bg-red-500/10 p-5 text-sm font-bold text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && books.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-purple-400/30 bg-purple-500/5 p-8">
          <p className="text-sm font-black text-purple-100">لا توجد دفاتر أسعار قناة بعد</p>
          <p className="mt-2 text-xs font-bold leading-6 text-content-3">
            الشاشة جاهزة للقراءة، لكن هذا الـ tenant لا يحتوي بعد على بيانات فعلية في
            <code className="mx-1 rounded bg-black/30 px-1">channel_price_books</code>.
          </p>
        </div>
      )}

      {!loading && !error && books.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {filteredBooks.map((book) => {
              const active = book.id === selectedBookId;
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBookId(book.id)}
                  className={`w-full rounded-[20px] border p-4 text-right transition ${
                    active
                      ? 'border-cyan-300/40 bg-cyan-500/10 ring-1 ring-cyan-300/30'
                      : 'border-border bg-surface-card hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{book.name}</p>
                      <p className="mt-1 text-xs font-bold text-content-3">{book.channel_name ?? 'قناة غير معرّفة'}</p>
                    </div>
                    {book.is_default && (
                      <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-100">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-content-3">
                    <Metric label="العملة" value={book.currency} />
                    <Metric label="الأسطر" value={String(book.line_count)} />
                    <Metric label="من" value={formatDateAr(book.effective_from)} />
                    <Metric label="إلى" value={formatDateAr(book.effective_to)} />
                  </div>
                </button>
              );
            })}

            {filteredBooks.length === 0 && (
              <div className="rounded-[20px] border border-dashed border-amber-400/30 bg-amber-500/5 p-5">
                <p className="text-sm font-black text-amber-100">لا توجد دفاتر أسعار للقناة المختارة</p>
              </div>
            )}
          </aside>

          <div className="space-y-4">
            {detailLoading && (
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-8 text-sm font-bold text-content-3">
                جاري تحميل تفاصيل دفتر السعر...
              </div>
            )}

            {detailError && (
              <div className="rounded-[20px] border border-red-400/30 bg-red-500/10 p-5 text-sm font-bold text-red-200">
                {detailError}
              </div>
            )}

            {!detailLoading && !detailError && selectedBook && (
              <>
                <section className="rounded-[20px] border border-border bg-surface-card p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">{selectedBook.name}</h2>
                      <p className="mt-1 text-sm font-bold text-content-3">
                        {selectedBook.channel_name ?? 'قناة غير معرّفة'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-bold text-content-3 md:min-w-[320px]">
                      <Metric label="العملة" value={selectedBook.currency} />
                      <Metric label="عدد الأسطر" value={String(selectedBook.line_count)} />
                      <Metric label="من" value={formatDateAr(selectedBook.effective_from)} />
                      <Metric label="إلى" value={formatDateAr(selectedBook.effective_to)} />
                    </div>
                  </div>
                </section>

                <section className="rounded-[20px] border border-border bg-surface-card p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-white">خطوط التسعير</h3>
                    <span className="text-xs font-bold text-content-3">{selectedBook.lines.length} line(s)</span>
                  </div>

                  {selectedBook.lines.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-5 text-xs font-bold text-content-3">
                      لا توجد خطوط تسعير مرتبطة بهذا الدفتر بعد.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead className="border-b border-border bg-white/5 text-xs font-black text-content-3">
                          <tr>
                            <th className="p-3">SKU</th>
                            <th className="p-3">الصنف</th>
                            <th className="p-3">سعر الأساس</th>
                            <th className="p-3">سعر القناة</th>
                            <th className="p-3">حد أدنى</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBook.lines.map((line) => (
                            <PriceBookLineRow key={line.id} line={line} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-[20px] border border-border bg-surface-card p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-white">قواعد التسعير</h3>
                    <span className="text-xs font-bold text-content-3">{rules.length} rule(s)</span>
                  </div>

                  {rulesLoading && <div className="text-sm font-bold text-content-3">جاري تحميل القواعد...</div>}
                  {rulesError && <div className="text-sm font-bold text-red-200">{rulesError}</div>}

                  {!rulesLoading && !rulesError && rules.length === 0 && (
                    <div className="rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 p-5 text-xs font-bold text-content-3">
                      لا توجد قواعد مرتبطة بهذا الدفتر بعد.
                    </div>
                  )}

                  {!rulesLoading && !rulesError && rules.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead className="border-b border-border bg-white/5 text-xs font-black text-content-3">
                          <tr>
                            <th className="p-3">القاعدة</th>
                            <th className="p-3">النطاق</th>
                            <th className="p-3">القيمة</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3">الفعالية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map((rule) => (
                            <PricingRuleRow key={rule.id} rule={rule} currency={selectedBook.currency} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-[20px] border border-border bg-surface-card p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white">Pricing Simulator Scaffold</h3>
                      <p className="mt-1 text-xs font-bold leading-6 text-content-3">
                        read model فوق current contract version وterms وprice books وlines وrules.
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-black text-cyan-100">
                      Read only
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                    <div className="space-y-4">
                      {(requestedContractId || selectedContract) && (
                        <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/5 p-3 text-xs font-bold leading-6 text-content-3">
                          <p>
                            Contract in setup:{' '}
                            <span className="text-white">
                              {selectedContract ? `${selectedContract.contract_code} - ${selectedContract.name}` : 'غير محدد'}
                            </span>
                          </p>
                          <p>
                            Version in preview:{' '}
                            <span className="text-white">
                              {selectedCurrentVersion ? `v${selectedCurrentVersion.version_number}` : 'لا توجد current version'}
                            </span>
                          </p>
                        </div>
                      )}
                      {selectedContractOptionalFieldWarnings.length > 0 && (
                        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                          <p className="text-xs font-black text-amber-100">Preview fallback / missing optional fields</p>
                          <ul className="mt-2 list-disc space-y-1 pr-5 text-xs font-bold text-amber-100/90">
                            {selectedContractOptionalFieldWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedContractLegacyAliasWarnings.length > 0 && (
                        <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
                          <p className="text-xs font-black text-purple-100">Legacy alias detected (non-blocking)</p>
                          <ul className="mt-2 list-disc space-y-1 pr-5 text-xs font-bold text-purple-100/90">
                            {selectedContractLegacyAliasWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <InputBlock label="Channel account">
                        <select
                          value={simulatorInput.channel_account_id ?? ''}
                          onChange={(event) => {
                            const nextChannelId = event.target.value || null;
                            const nextBooks = nextChannelId
                              ? books.filter((book) => book.channel_account_id === nextChannelId)
                              : books;
                            const nextBookId = nextBooks.find((book) => book.is_default)?.id ?? nextBooks[0]?.id ?? null;
                            setSelectedBookId(nextBookId);
                            setSimulatorInput((current) => ({
                              ...current,
                              channel_account_id: nextChannelId,
                              contract_id: null,
                              price_book_id: nextBookId,
                              canonical_sku_id: null,
                            }));
                          }}
                          className="w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm font-bold text-white outline-none"
                        >
                          <option value="">كل القنوات</option>
                          {Array.from(new Map(books.map((book) => [book.channel_account_id, book.channel_name ?? 'قناة غير معرّفة']))).map(
                            ([channelAccountId, channelName]) => (
                              <option key={channelAccountId} value={channelAccountId}>
                                {channelName}
                              </option>
                            )
                          )}
                        </select>
                      </InputBlock>

                      <InputBlock label="Commercial contract">
                        <select
                          value={simulatorInput.contract_id ?? ''}
                          onChange={(event) =>
                            setSimulatorInput((current) => ({ ...current, contract_id: event.target.value || null }))
                          }
                          className="w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm font-bold text-white outline-none"
                          disabled={filteredContracts.length === 0}
                        >
                          <option value="">{filteredContracts.length === 0 ? 'لا توجد عقود current version' : 'اختر العقد'}</option>
                          {filteredContracts.map((contract) => (
                            <option key={contract.id} value={contract.id}>
                              {contract.contract_code} - {contract.name}
                            </option>
                          ))}
                        </select>
                      </InputBlock>

                      <InputBlock label="Price book">
                        <select
                          value={selectedBookId ?? ''}
                          onChange={(event) => setSelectedBookId(event.target.value || null)}
                          className="w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm font-bold text-white outline-none"
                          disabled={filteredBooks.length === 0}
                        >
                          <option value="">{filteredBooks.length === 0 ? 'لا توجد دفاتر أسعار' : 'اختر دفتر السعر'}</option>
                          {filteredBooks.map((book) => (
                            <option key={book.id} value={book.id}>
                              {book.name}
                            </option>
                          ))}
                        </select>
                      </InputBlock>

                      <InputBlock label="SKU / line">
                        <select
                          value={simulatorInput.canonical_sku_id ?? ''}
                          onChange={(event) =>
                            setSimulatorInput((current) => ({ ...current, canonical_sku_id: event.target.value || null }))
                          }
                          className="w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm font-bold text-white outline-none"
                          disabled={!selectedBook || selectedBook.lines.length === 0}
                        >
                          <option value="">{!selectedBook?.lines.length ? 'لا توجد خطوط قابلة للمعاينة' : 'اختر SKU'}</option>
                          {selectedBook?.lines.map((line) => (
                            <option key={line.id} value={line.canonical_sku_id}>
                              {line.sku ?? 'SKU'} - {line.item_name_ar || line.item_name || 'Line'}
                            </option>
                          ))}
                        </select>
                      </InputBlock>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <NumberField
                          label="الكمية"
                          value={simulatorInput.quantity}
                          onChange={(value) => setSimulatorInput((current) => ({ ...current, quantity: Math.max(1, value ?? 1) }))}
                        />
                        <NumberField
                          label="خصم مطلوب %"
                          value={simulatorInput.requested_discount_pct}
                          onChange={(value) =>
                            setSimulatorInput((current) => ({ ...current, requested_discount_pct: Math.max(0, value ?? 0) }))
                          }
                        />
                        <NumberField
                          label="شحن على العميل"
                          value={simulatorInput.shipping_charge_to_customer}
                          onChange={(value) =>
                            setSimulatorInput((current) => ({ ...current, shipping_charge_to_customer: Math.max(0, value ?? 0) }))
                          }
                        />
                        <NumberField
                          label="COGS override / unit"
                          value={simulatorInput.unit_cogs_override}
                          onChange={(value) => setSimulatorInput((current) => ({ ...current, unit_cogs_override: value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {!simulatorReady && (
                        <div className="rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 p-6 text-sm font-bold text-purple-100">
                          اختر العقد ودفتر السعر وSKU حتى يظهر preview.
                        </div>
                      )}

                      {simulatorReady && previewLoading && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm font-bold text-content-3">
                          جاري بناء المعاينة...
                        </div>
                      )}

                      {simulatorReady && previewError && (
                        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                          {previewError}
                        </div>
                      )}

                      {simulatorReady && !previewLoading && !previewError && !preview && (
                        <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-6 text-sm font-bold text-amber-100">
                          لا تتوفر بيانات كافية لإخراج preview.
                        </div>
                      )}

                      {preview && (
                        <>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                            <Metric label="Expected payout" value={formatMoney(preview.outputs.expected_payout_preview, preview.currency)} />
                            <Metric label="True net margin" value={formatMoney(preview.outputs.true_net_margin_preview, preview.currency)} />
                            <Metric label="Order gross" value={formatMoney(preview.outputs.order_gross, preview.currency)} />
                            <Metric label="Commission impact" value={formatMoney(preview.outputs.commission_total, preview.currency)} />
                            <Metric label="Payment fee impact" value={formatMoney(preview.outputs.payment_fee_total, preview.currency)} />
                            <Metric label="Fees due separately" value={formatMoney(preview.outputs.fees_due_separately, preview.currency)} />
                            <Metric label="True net margin %" value={formatPercent(preview.outputs.true_net_margin_pct)} />
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            <section className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs font-bold leading-6 text-content-3">
                              <h4 className="text-sm font-black text-white">Context</h4>
                              <p className="mt-3">العقد: <span className="text-white">{preview.contract.contract_code} - {preview.contract.name}</span></p>
                              <p>دفتر السعر: <span className="text-white">{preview.price_book.name}</span></p>
                              <p>القناة: <span className="text-white">{preview.price_book.channel_name ?? '-'}</span></p>
                              <p>SKU: <span className="text-white">{preview.line.sku ?? '-'}</span></p>
                              <p>الصنف: <span className="text-white">{preview.line.item_name_ar || preview.line.item_name || '-'}</span></p>
                              <p>Merchant of record: <span className="text-white">{formatContextEnum(preview.merchant_of_record)}</span></p>
                              <p>Flow type: <span className="text-white">{formatContextEnum(preview.flow_type)}</span></p>
                              <p>Payout deduction: <span className="text-white">{formatMoney(preview.outputs.payout_deduction_total, preview.currency)}</span></p>
                            </section>

                            <section className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs font-bold leading-6 text-content-3">
                              <h4 className="text-sm font-black text-white">Price context</h4>
                              <p className="mt-3">Base selling price: <span className="text-white">{formatMoney(preview.price_context.base_selling_price, preview.currency)}</span></p>
                              <p>Channel list price: <span className="text-white">{formatMoney(preview.price_context.channel_list_price, preview.currency)}</span></p>
                              <p>Candidate unit price: <span className="text-white">{formatMoney(preview.price_context.candidate_unit_price, preview.currency)}</span></p>
                              <p>Final unit price: <span className="text-white">{formatMoney(preview.outputs.final_unit_price, preview.currency)}</span></p>
                              <p>Floor price: <span className="text-white">{formatMoney(preview.price_context.floor_price, preview.currency)}</span></p>
                              <p>Floor price applied: <span className="text-white">{formatMoney(preview.outputs.floor_price_applied, preview.currency)}</span></p>
                              <p>Effective discount: <span className="text-white">{formatPercent(preview.outputs.effective_discount_pct)}</span></p>
                            </section>

                            <section className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs font-bold leading-6 text-content-3">
                              <h4 className="text-sm font-black text-white">Cost basis</h4>
                              <p className="mt-3">Unit cost used: <span className="text-white">{formatMoney(preview.cost_basis.unit_cost, preview.currency)}</span></p>
                              <p>Total cost basis: <span className="text-white">{formatMoney(preview.cost_basis.total_cost, preview.currency)}</span></p>
                              <p>Cost source: <span className="text-white">{formatCostSource(preview.cost_basis.source)}</span></p>
                              <p>Quantity: <span className="text-white">{String(preview.price_context.quantity)}</span></p>
                              <p>Merchandise subtotal: <span className="text-white">{formatMoney(preview.outputs.merchandise_subtotal, preview.currency)}</span></p>
                              <p>Shipping to customer: <span className="text-white">{formatMoney(preview.inputs.shipping_charge_to_customer, preview.currency)}</span></p>
                              <p>Merchant-borne modeled fees: <span className="text-white">{formatMoney(preview.outputs.estimated_channel_fees, preview.currency)}</span></p>
                            </section>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            <ChargeSummaryCard title="Commission summary" summary={preview.commission_summary} currency={preview.currency} />
                            <ChargeSummaryCard title="Payment fee summary" summary={preview.payment_fee_summary} currency={preview.currency} />
                          </div>

                          <ReserveAdjustmentPreviewSection preview={preview} />

                          <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h4 className="text-sm font-black text-white">Applied rule summary</h4>
                              <span className="text-xs font-bold text-content-3">{preview.applied_rules.length} rule(s)</span>
                            </div>
                            {preview.applied_rules.length === 0 ? (
                              <p className="text-xs font-bold text-content-3">لا توجد قواعد فعالة مطابقة لهذه المعاينة.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm">
                                  <thead className="border-b border-border bg-white/5 text-xs font-black text-content-3">
                                    <tr>
                                      <th className="p-3">القاعدة</th>
                                      <th className="p-3">النطاق</th>
                                      <th className="p-3">القيمة</th>
                                      <th className="p-3">الأثر</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {preview.applied_rules.map((rule) => (
                                      <tr key={rule.rule_id} className="border-t border-border/60">
                                        <td className="p-3 font-black text-white">{RULE_TYPE_LABELS[rule.rule_type]}</td>
                                        <td className="p-3 text-xs font-bold text-content-3">{rule.scope === 'sku' ? 'SKU' : 'دفتر السعر'}</td>
                                        <td className="p-3 text-xs font-bold text-white">{rule.value_label}</td>
                                        <td className="p-3 text-xs font-bold text-content-3">{rule.effect_summary}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </section>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <ListCard title="Assumptions" items={preview.assumptions} />
                            <ListCard title="TODO for tightening" items={preview.todos} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}

      <section className="rounded-[20px] border border-dashed border-cyan-400/25 bg-cyan-500/5 p-5">
        <h2 className="text-sm font-black text-cyan-100">التالي على نفس المسار</h2>
        <p className="mt-2 text-xs font-bold leading-6 text-content-3">
          البنية الآن أصبحت: دفاتر أسعار + خطوط + قواعد + simulator scaffold. الخطوة التالية المنطقية هي tightening لحساب
          expected payout أو true net margin بدل الاكتفاء بالمعاينة العامة الحالية.
        </p>
      </section>
    </div>
  );
};

function InputBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-content-3">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-content-3">{label}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
        className="w-full rounded-xl border border-border bg-black/20 px-3 py-2 text-sm font-bold text-white outline-none"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-bold text-content-3">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ReserveAdjustmentPreviewSection({ preview }: { preview: PricingSimulatorPreview }) {
  const rl = preview.reserve_layer;
  return (
    <section className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-black text-amber-100">Reserve / adjustment preview</h4>
        <span className="text-[10px] font-black uppercase tracking-wide text-amber-200/80">Read-only · not settlement</span>
      </div>
      <p className="text-xs font-bold leading-6 text-content-3">
        طبقة معاينة فوق نفس الـ expected payout الحالي: عبء الشحن للتاجر، احتياطي الإرجاع/الصلاحية، وتعديل التسوية
        (عند توفر حقول اختيارية على الـ term_config).
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-bold leading-6 text-content-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-white">Merchant shipping burden</p>
          <p className="mt-2">
            Party: <span className="text-white">{rl.shipping_burden.responsible_party ?? '—'}</span>
          </p>
          <p>
            Customer collects: <span className="text-white">{formatMoney(rl.shipping_burden.customer_shipping_collected, preview.currency)}</span>
          </p>
          <p>
            Modeled merchant outbound: <span className="text-white">{formatMoney(rl.shipping_burden.modeled_merchant_shipping_cost, preview.currency)}</span>
          </p>
          <p>
            Burden preview: <span className="text-white">{formatMoney(rl.shipping_burden.merchant_burden_preview, preview.currency)}</span>
          </p>
          <p className="mt-2 text-[11px] leading-5">{rl.shipping_burden.basis_label}</p>
          {rl.shipping_burden.todos.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-200/90">
              {rl.shipping_burden.todos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-bold leading-6 text-content-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-white">Return / expiry reserve</p>
          <p className="mt-2">
            Rate (bp): <span className="text-white">{rl.return_reserve.reserve_rate_bp_applied ?? '—'}</span>
          </p>
          <p>
            Reserve preview: <span className="text-white">{formatMoney(rl.return_reserve.reserve_amount_preview, preview.currency)}</span>
          </p>
          {rl.return_reserve.source_term_label && (
            <p>
              Term label: <span className="text-white">{rl.return_reserve.source_term_label}</span>
            </p>
          )}
          <p className="mt-2 text-[11px] leading-5">{rl.return_reserve.basis_label}</p>
          {rl.return_reserve.todos.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-200/90">
              {rl.return_reserve.todos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-bold leading-6 text-content-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-white">Settlement adjustment</p>
          <p className="mt-2">
            Payout cycle / delay (days):{' '}
            <span className="text-white">
              {rl.settlement_adjustment.payout_cycle_days ?? '—'} / {rl.settlement_adjustment.payout_delay_days ?? '—'}
            </span>
          </p>
          <p>
            Timing drag (preview): <span className="text-white">{formatMoney(rl.settlement_adjustment.timing_drag_amount_preview, preview.currency)}</span>
          </p>
          <p>
            Adjustment rate (bp of payout): <span className="text-white">{rl.settlement_adjustment.adjustment_rate_bp_applied ?? '—'}</span>
          </p>
          <p>
            Adjustment preview: <span className="text-white">{formatMoney(rl.settlement_adjustment.adjustment_amount_preview, preview.currency)}</span>
          </p>
          <p className="mt-2 text-[11px] leading-5">{rl.settlement_adjustment.basis_label}</p>
          {rl.settlement_adjustment.todos.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-200/90">
              {rl.settlement_adjustment.todos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-white/15 bg-black/25 p-3 text-sm font-black text-white">
        Net after read-only reserves: {formatMoney(rl.net_preview_after_read_only_reserves, preview.currency)}
      </div>
    </section>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm font-black text-white">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-3 text-xs font-bold text-content-3">لا توجد عناصر.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs font-bold leading-6 text-content-3">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChargeSummaryCard({
  title,
  summary,
  currency,
}: {
  title: string;
  summary: PricingSimulatorPreview['commission_summary'];
  currency: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-white">{title}</h4>
          <p className="mt-1 text-xs font-bold text-content-3">{summary.summary_text || 'No summary text on current contract version.'}</p>
        </div>
        <div className="text-right text-xs font-bold leading-6 text-content-3">
          <p>Total: <span className="text-white">{formatMoney(summary.total_modeled_amount, currency)}</span></p>
          <p>Deducted: <span className="text-white">{formatMoney(summary.deducted_from_payout_amount, currency)}</span></p>
          <p>Due later: <span className="text-white">{formatMoney(summary.due_separately_amount, currency)}</span></p>
          <p>Not merchant-borne: <span className="text-white">{formatMoney(summary.not_merchant_borne_amount, currency)}</span></p>
          <p>Unmodeled: <span className="text-white">{String(summary.unmodeled_term_count)}</span></p>
        </div>
      </div>

      {summary.items.length === 0 ? (
        <p className="mt-4 text-xs font-bold text-content-3">No normalized terms matched this group.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-border bg-white/5 text-xs font-black text-content-3">
              <tr>
                <th className="p-3">Term</th>
                <th className="p-3">Bearer</th>
                <th className="p-3">Basis</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Treatment</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item) => (
                <tr key={item.term_id} className="border-t border-border/60">
                  <td className="p-3 text-xs font-bold text-white">
                    <div>{item.label}</div>
                    {item.note && <div className="mt-1 text-[11px] font-bold text-content-3">{item.note}</div>}
                  </td>
                  <td className="p-3 text-xs font-bold text-content-3">{formatBearer(item.bearer)}</td>
                  <td className="p-3 text-xs font-bold text-content-3">{item.basis_label}</td>
                  <td className="p-3 text-xs font-bold text-white">{formatMoney(item.amount, currency)}</td>
                  <td className="p-3 text-xs font-bold text-content-3">{formatChargeTreatment(item.treatment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PriceBookLineRow({ line }: { line: ChannelPriceBookLine }) {
  return (
    <tr className="border-t border-border/60">
      <td className="p-3 font-mono text-xs text-cyan-100">{line.sku ?? '-'}</td>
      <td className="p-3 font-bold text-white">{line.item_name_ar || line.item_name || '-'}</td>
      <td className="p-3 text-xs font-bold text-content-3">{formatMoney(line.base_selling_price, line.currency)}</td>
      <td className="p-3 font-black text-white">{formatMoney(line.list_price, line.currency)}</td>
      <td className="p-3 text-xs font-bold text-content-3">{formatMoney(line.floor_price, line.currency)}</td>
    </tr>
  );
}

function PricingRuleRow({ rule, currency }: { rule: ChannelPricingRule; currency: string }) {
  return (
    <tr className="border-t border-border/60">
      <td className="p-3 font-black text-white">{RULE_TYPE_LABELS[rule.rule_type]}</td>
      <td className="p-3 text-xs font-bold text-content-3">
        {rule.scope === 'sku' ? `SKU: ${rule.item_name_ar || rule.item_name || rule.sku || 'SKU'}` : 'دفتر السعر'}
      </td>
      <td className="p-3 text-xs font-bold text-white">{formatRuleValue(rule, currency)}</td>
      <td className="p-3 text-xs font-bold text-content-3">{rule.is_active ? 'Active' : 'Inactive'}</td>
      <td className="p-3 text-xs font-bold text-content-3">{formatDateRange(rule.effective_from, rule.effective_to)}</td>
    </tr>
  );
}

function formatRuleValue(rule: ChannelPricingRule, currency: string): string {
  switch (rule.rule_type) {
    case 'min_price_override':
      return formatMoney(rule.numeric_value, currency);
    case 'target_margin_pct':
    case 'max_discount_pct':
      return rule.numeric_value == null ? '-' : `${rule.numeric_value}%`;
    case 'merchant_of_record':
    case 'flow_type':
      return formatContextEnum(rule.text_value);
    default:
      return rule.text_value || '-';
  }
}

function formatContextEnum(value: string | null): string {
  const labels: Record<string, string> = {
    merchant: 'التاجر',
    channel: 'القناة',
    channel_collects_then_payout: 'القناة تجمع ثم تدفع',
    merchant_collects_then_fees_due: 'التاجر يجمع ثم تخصم الرسوم',
    split_settlement: 'تسوية مشتركة',
    manual_reconciliation: 'تسوية يدوية',
  };
  return value ? labels[value] ?? value : '-';
}

function formatBearer(value: string | null): string {
  const labels: Record<string, string> = {
    merchant: 'Merchant',
    channel: 'Channel',
    customer: 'Customer',
    split: 'Split',
  };
  return value ? labels[value] ?? value : '-';
}

function formatChargeTreatment(value: PricingSimulatorPreview['commission_summary']['items'][number]['treatment']): string {
  const labels: Record<string, string> = {
    deducted_from_payout: 'Deducted from payout',
    due_separately: 'Due separately',
    not_merchant_borne: 'Not merchant-borne',
    not_modeled: 'Not modeled',
  };
  return labels[value] ?? value;
}

function formatCostSource(value: PricingSimulatorPreview['cost_basis']['source']): string {
  const labels: Record<string, string> = {
    override: 'Manual override',
    item_cost: 'Item cost',
    zero_fallback: 'Zero fallback',
  };
  return labels[value] ?? value;
}

function formatDateAr(input: string | null): string {
  if (!input) return '-';
  try {
    return new Date(input).toLocaleDateString('ar-AE');
  } catch {
    return '-';
  }
}

function formatDateRange(from: string | null, to: string | null): string {
  return `${formatDateAr(from)} -> ${formatDateAr(to)}`;
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return '-';
  try {
    return new Intl.NumberFormat('ar-AE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function formatPercent(value: number | null): string {
  if (value == null) return '-';
  return `${value.toFixed(2)}%`;
}

export default CommercePricingScreen;
