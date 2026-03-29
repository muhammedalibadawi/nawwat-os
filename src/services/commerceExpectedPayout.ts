import type {
  ChannelPriceBookDetail,
  ChannelPriceBookLine,
  ChannelPricingRule,
  CommercialContractListItem,
  ContractCommissionTierMode,
  ContractCommissionTierBand,
  CommercialContractVersionTermRow,
  FeeBearer,
  PricingSimulatorAppliedRuleSummary,
  PricingSimulatorChargeGroupSummary,
  PricingSimulatorChargeItemSummary,
  PricingSimulatorCostBasisSource,
  PricingSimulatorInput,
  PricingSimulatorPreview,
  PricingSimulatorReserveLayerPreview,
} from '@/types/commerceFoundation';

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pushUnique(target: string[], message: string) {
  if (!target.includes(message)) {
    target.push(message);
  }
}

function isRuleEffective(rule: ChannelPricingRule, at: Date): boolean {
  const from = rule.effective_from ? new Date(rule.effective_from).getTime() : null;
  const to = rule.effective_to ? new Date(rule.effective_to).getTime() : null;
  const ts = at.getTime();
  if (from != null && ts < from) return false;
  if (to != null && ts > to) return false;
  return true;
}

function pickPreferredRule(
  rules: ChannelPricingRule[],
  ruleType: ChannelPricingRule['rule_type']
): ChannelPricingRule | null {
  const candidates = rules.filter((rule) => rule.rule_type === ruleType);
  if (candidates.length === 0) return null;

  const skuScoped = candidates.filter((rule) => rule.scope === 'sku');
  const source = skuScoped.length > 0 ? skuScoped : candidates;
  return source[source.length - 1] ?? null;
}

function buildRuleValueLabel(rule: ChannelPricingRule, currency: string): string {
  switch (rule.rule_type) {
    case 'min_price_override':
      return rule.numeric_value == null ? '-' : `${rule.numeric_value} ${currency}`;
    case 'target_margin_pct':
    case 'max_discount_pct':
      return rule.numeric_value == null ? '-' : `${rule.numeric_value}%`;
    default:
      return rule.text_value ?? '-';
  }
}

function commissionBasisLabel(basis: string | null): string {
  switch (basis) {
    case 'percent_of_line':
      return '% of discounted merchandise';
    case 'percent_of_order_net':
      return '% of order net';
    case 'tiered':
      return 'tiered commission';
    default:
      return 'commission rule';
  }
}

function paymentFeeBasisLabel(feeType: string | null): string {
  switch (feeType) {
    case 'percent_of_gmv':
      return '% of merchandise subtotal';
    case 'percent_of_payment':
      return '% of collected payment';
    case 'fixed_per_order':
      return 'fixed per order';
    default:
      return 'payment fee';
  }
}

function pickAppliedTierBandForAmount(
  tiers: ContractCommissionTierBand[] | null,
  baseAmount: number
): ContractCommissionTierBand | null {
  if (!tiers || tiers.length === 0) return null;
  for (const tier of tiers) {
    const minOk = baseAmount >= tier.min_order_amount;
    const maxOk = tier.max_order_amount == null ? true : baseAmount < tier.max_order_amount;
    if (minOk && maxOk) {
      return tier;
    }
  }
  return null;
}

function computeProgressiveTieredCommission(
  tiers: ContractCommissionTierBand[] | null,
  baseAmount: number
): { amount: number; appliedBands: Array<{ from: number; to: number | null; portion: number; rate_bp: number }> } | null {
  if (!tiers || tiers.length === 0) return null;
  if (baseAmount <= 0) return { amount: 0, appliedBands: [] };

  let remaining = baseAmount;
  let total = 0;
  const appliedBands: Array<{ from: number; to: number | null; portion: number; rate_bp: number }> = [];

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const start = tier.min_order_amount;
    if (baseAmount <= start) break;

    const end = tier.max_order_amount;
    const cappedEnd = end == null ? baseAmount : Math.min(end, baseAmount);
    const width = Math.max(0, cappedEnd - start);
    if (width <= 0) continue;

    const portion = Math.min(width, remaining);
    if (portion <= 0) continue;

    total += portion * (tier.rate_bp / 10000);
    appliedBands.push({ from: start, to: end, portion, rate_bp: tier.rate_bp });
    remaining -= portion;
  }

  const covered = appliedBands.reduce((sum, row) => sum + row.portion, 0);
  if (Math.abs(covered - baseAmount) > 1e-6) {
    return null;
  }
  return { amount: total, appliedBands };
}

function resolveTreatment(
  amount: number | null,
  bearer: FeeBearer | null,
  flowType: PricingSimulatorPreview['flow_type'],
  assumptions: string[]
): PricingSimulatorChargeItemSummary['treatment'] {
  if (amount == null) {
    return 'not_modeled';
  }
  if (bearer == null) {
    pushUnique(assumptions, 'Missing fee bearer is treated as merchant-borne in the preview.');
    return flowType === 'merchant_collects_then_fees_due' ? 'due_separately' : 'deducted_from_payout';
  }
  if (bearer === 'merchant') {
    return flowType === 'merchant_collects_then_fees_due' ? 'due_separately' : 'deducted_from_payout';
  }
  return 'not_merchant_borne';
}

function finalizeChargeGroup(
  summaryText: string | null,
  items: PricingSimulatorChargeItemSummary[]
): PricingSimulatorChargeGroupSummary {
  return {
    summary_text: summaryText,
    total_modeled_amount: items.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    deducted_from_payout_amount: items.reduce(
      (sum, item) => sum + (item.treatment === 'deducted_from_payout' ? item.amount ?? 0 : 0),
      0
    ),
    due_separately_amount: items.reduce(
      (sum, item) => sum + (item.treatment === 'due_separately' ? item.amount ?? 0 : 0),
      0
    ),
    not_merchant_borne_amount: items.reduce(
      (sum, item) => sum + (item.treatment === 'not_merchant_borne' ? item.amount ?? 0 : 0),
      0
    ),
    unmodeled_term_count: items.filter((item) => !item.modeled).length,
    items,
  };
}

function buildCommissionItem(
  term: CommercialContractVersionTermRow,
  merchandiseSubtotal: number,
  flowType: PricingSimulatorPreview['flow_type'],
  assumptions: string[]
): PricingSimulatorChargeItemSummary {
  const config = term.term_config as unknown as Record<string, unknown>;
  const basis = typeof config.basis === 'string' ? config.basis : null;
  const bearer = typeof config.bearer === 'string' ? (config.bearer as FeeBearer) : null;
  const rateBp = coerceNumber(config.rate_bp);
  const tierMode =
    (typeof config.tier_mode === 'string' ? config.tier_mode : 'single_band') as ContractCommissionTierMode;
  const tierJson = (config.tier_json ?? null) as { tiers?: ContractCommissionTierBand[] } | null;

  if (bearer === 'split') {
    pushUnique(assumptions, 'Split-bearer commission is not allocated yet in the preview.');
    return {
      term_id: term.id,
      term_code: term.term_code,
      label: term.label,
      term_group: 'commission',
      bearer,
      basis_label: commissionBasisLabel(basis),
      amount: null,
      modeled: false,
      treatment: 'not_modeled',
      note: 'Split bearer is not modeled yet.',
    };
  }

  if (basis === 'tiered') {
    if (tierMode === 'progressive') {
      const progressive = computeProgressiveTieredCommission(tierJson?.tiers ?? null, merchandiseSubtotal);
      if (!progressive) {
        pushUnique(
          assumptions,
          'Progressive tiered commission requires contiguous tier coverage from zero to current merchandise subtotal.'
        );
        return {
          term_id: term.id,
          term_code: term.term_code,
          label: term.label,
          term_group: 'commission',
          bearer,
          basis_label: commissionBasisLabel(basis),
          amount: null,
          modeled: false,
          treatment: 'not_modeled',
          note: 'Progressive tier configuration does not fully cover current merchandise subtotal.',
        };
      }
      const appliedSummary =
        progressive.appliedBands.length > 0
          ? progressive.appliedBands
              .map((row) => `${row.from}-${row.to == null ? 'open' : row.to}: ${row.portion} @ ${row.rate_bp}bp`)
              .join(' | ')
          : 'no portions';
      return {
        term_id: term.id,
        term_code: term.term_code,
        label: term.label,
        term_group: 'commission',
        bearer,
        basis_label: commissionBasisLabel(basis),
        amount: progressive.amount,
        modeled: true,
        treatment: resolveTreatment(progressive.amount, bearer, flowType, assumptions),
        note: `Tier mode progressive applied bands: ${appliedSummary}.`,
      };
    }

    const appliedTier = pickAppliedTierBandForAmount(tierJson?.tiers ?? null, merchandiseSubtotal);
    if (!appliedTier) {
      pushUnique(
        assumptions,
        'Tiered commission requires at least one band matching the current merchandise subtotal.'
      );
      return {
        term_id: term.id,
        term_code: term.term_code,
        label: term.label,
        term_group: 'commission',
        bearer,
        basis_label: commissionBasisLabel(basis),
        amount: null,
        modeled: false,
        treatment: 'not_modeled',
        note: 'No matching tier band found for current merchandise subtotal.',
      };
    }
    const tierAmount = merchandiseSubtotal * (appliedTier.rate_bp / 10000);
    return {
      term_id: term.id,
      term_code: term.term_code,
      label: term.label,
      term_group: 'commission',
      bearer,
      basis_label: commissionBasisLabel(basis),
      amount: tierAmount,
      modeled: true,
      treatment: resolveTreatment(tierAmount, bearer, flowType, assumptions),
      note: `Tier mode single_band applied: ${appliedTier.min_order_amount} to ${
        appliedTier.max_order_amount == null ? 'open-ended' : appliedTier.max_order_amount
      } @ ${appliedTier.rate_bp} bp on merchandise subtotal.`,
    };
  }

  if (basis == null) {
    pushUnique(assumptions, 'Commission term missing basis is treated as not modeled.');
    return {
      term_id: term.id,
      term_code: term.term_code,
      label: term.label,
      term_group: 'commission',
      bearer,
      basis_label: commissionBasisLabel(basis),
      amount: null,
      modeled: false,
      treatment: 'not_modeled',
      note: 'Missing commission basis.',
    };
  }

  if (rateBp == null) {
    return {
      term_id: term.id,
      term_code: term.term_code,
      label: term.label,
      term_group: 'commission',
      bearer,
      basis_label: commissionBasisLabel(basis),
      amount: null,
      modeled: false,
      treatment: 'not_modeled',
      note: 'Missing rate basis points.',
    };
  }

  if (basis === 'percent_of_order_net') {
    pushUnique(
      assumptions,
      'Commission terms with percent_of_order_net currently use merchandise subtotal only; order_net and shipping are not folded into this commission basis (see reserve layer for shipping burden preview).'
    );
  }

  const amount = merchandiseSubtotal * (rateBp / 10000);
  return {
    term_id: term.id,
    term_code: term.term_code,
    label: term.label,
    term_group: 'commission',
    bearer,
    basis_label: commissionBasisLabel(basis),
    amount,
    modeled: true,
    treatment: resolveTreatment(amount, bearer, flowType, assumptions),
    note: term.summary ?? null,
  };
}

function buildPaymentFeeItem(
  term: CommercialContractVersionTermRow,
  merchandiseSubtotal: number,
  orderGross: number,
  flowType: PricingSimulatorPreview['flow_type'],
  assumptions: string[]
): PricingSimulatorChargeItemSummary {
  const config = term.term_config as unknown as Record<string, unknown>;
  const feeType = typeof config.fee_type === 'string' ? config.fee_type : null;
  const bearer = typeof config.bearer === 'string' ? (config.bearer as FeeBearer) : null;
  const rateBp = coerceNumber(config.rate_bp);
  const fixedAmount = coerceNumber(config.fixed_amount);

  if (bearer === 'split') {
    pushUnique(assumptions, 'Split-bearer payment fees are not allocated yet in the preview.');
    return {
      term_id: term.id,
      term_code: term.term_code,
      label: term.label,
      term_group: 'payment_fee',
      bearer,
      basis_label: paymentFeeBasisLabel(feeType),
      amount: null,
      modeled: false,
      treatment: 'not_modeled',
      note: 'Split bearer is not modeled yet.',
    };
  }

  let amount: number | null = null;
  let note: string | null = term.summary ?? null;

  if (feeType === 'fixed_per_order' && fixedAmount != null) {
    amount = fixedAmount;
  } else if (feeType === 'percent_of_gmv' && rateBp != null) {
    amount = merchandiseSubtotal * (rateBp / 10000);
  } else if (feeType === 'percent_of_payment' && rateBp != null) {
    amount = orderGross * (rateBp / 10000);
  } else if (rateBp != null) {
    amount = orderGross * (rateBp / 10000);
    note = note ?? 'Fee type missing; preview assumes percent_of_payment.';
    pushUnique(assumptions, 'A payment fee term is missing fee_type and is treated as percent_of_payment.');
  } else if (fixedAmount != null) {
    amount = fixedAmount;
    note = note ?? 'Fee type missing; preview assumes fixed per order.';
    pushUnique(assumptions, 'A payment fee term is missing fee_type and is treated as fixed per order.');
  }

  if (amount == null) {
    return {
      term_id: term.id,
      term_code: term.term_code,
      label: term.label,
      term_group: 'payment_fee',
      bearer,
      basis_label: paymentFeeBasisLabel(feeType),
      amount: null,
      modeled: false,
      treatment: 'not_modeled',
      note: 'Payment fee formula is not modeled yet.',
    };
  }

  return {
    term_id: term.id,
    term_code: term.term_code,
    label: term.label,
    term_group: 'payment_fee',
    bearer,
    basis_label: paymentFeeBasisLabel(feeType),
    amount,
    modeled: true,
    treatment: resolveTreatment(amount, bearer, flowType, assumptions),
    note,
  };
}

function buildAppliedRuleSummary(
  applicableRules: ChannelPricingRule[],
  requestedDiscountPct: number,
  effectiveDiscountPct: number,
  floorPrice: number | null,
  currency: string
): PricingSimulatorAppliedRuleSummary[] {
  return applicableRules.map((rule) => ({
    rule_id: rule.id,
    rule_type: rule.rule_type,
    scope: rule.scope,
    label: rule.rule_type,
    value_label: buildRuleValueLabel(rule, currency),
    effect_summary:
      rule.rule_type === 'max_discount_pct'
        ? `Requested discount ${requestedDiscountPct}% -> applied ${effectiveDiscountPct}%`
        : rule.rule_type === 'min_price_override'
          ? `Effective unit price floor ${floorPrice == null ? '-' : floorPrice}`
          : rule.rule_type === 'target_margin_pct'
            ? 'Advisory target for later margin tightening'
            : `Context set to ${rule.text_value ?? '-'}`,
  }));
}

/** Deterministic read-only reserve / adjustment preview (no settlement engine). */
function buildReserveLayerPreview(args: {
  terms: CommercialContractVersionTermRow[];
  settlementTerm: CommercialContractVersionTermRow | null;
  merchandiseSubtotal: number;
  shippingChargeToCustomer: number;
  expectedPayoutPreview: number;
  assumptions: string[];
}): PricingSimulatorReserveLayerPreview {
  const { terms, settlementTerm, merchandiseSubtotal, shippingChargeToCustomer, expectedPayoutPreview, assumptions } = args;

  const shippingTerm = terms.find((t) => t.term_group === 'shipping_responsibility') ?? null;
  const shipCfg = (shippingTerm?.term_config ?? null) as Record<string, unknown> | null;
  const responsibleParty =
    shipCfg && typeof shipCfg.responsible_party === 'string' ? shipCfg.responsible_party : null;

  const modeledMerchantShippingCost =
    coerceNumber(shipCfg?.estimated_merchant_outbound_shipping) ??
    coerceNumber(shipCfg?.merchant_outbound_shipping_cost) ??
    coerceNumber(shipCfg?.modeled_merchant_shipping_cost) ??
    coerceNumber(shipCfg?.merchant_shipping_cost_estimate);

  const shippingTodos: string[] = [];
  let merchantBurdenPreview: number | null = null;
  let shippingBasis =
    'Shipping burden preview uses shipping_responsibility term plus optional outbound cost fields on term_config.';

  if (!shippingTerm) {
    shippingTodos.push('TODO: Add shipping_responsibility term to preview merchant shipping burden.');
    shippingBasis = 'No shipping_responsibility term; burden not attributed from contract.';
  } else if (modeledMerchantShippingCost != null) {
    merchantBurdenPreview = Math.max(0, modeledMerchantShippingCost - shippingChargeToCustomer);
    shippingBasis =
      'Burden = max(0, modeled merchant outbound shipping − customer shipping collected in simulator inputs).';
  } else if (responsibleParty === 'merchant') {
    merchantBurdenPreview = null;
    shippingTodos.push(
      'TODO: Add estimated_merchant_outbound_shipping (or merchant_outbound_shipping_cost) on shipping_responsibility term_config to quantify burden.'
    );
    shippingBasis = 'Merchant responsible for shipping; outbound fulfillment cost not on term yet — burden unknown.';
  } else if (responsibleParty === 'customer' || responsibleParty === 'channel') {
    merchantBurdenPreview = 0;
    shippingBasis =
      'Contract assigns primary shipping responsibility away from merchant; per-order merchant subsidy not modeled without outbound cost.';
  } else if (responsibleParty === 'dynamic_by_region') {
    merchantBurdenPreview = null;
    shippingTodos.push(
      'TODO: dynamic_by_region shipping — add estimated_merchant_outbound_shipping or regional table hook on term_config.'
    );
    shippingBasis = 'Shipping responsibility varies by region; burden needs explicit cost on term or rule data.';
  } else if (responsibleParty === 'split') {
    merchantBurdenPreview = null;
    shippingTodos.push('TODO: Model split shipping_responsibility allocation before burden preview is meaningful.');
    shippingBasis = 'Split shipping responsibility — allocation not in preview yet.';
  } else {
    merchantBurdenPreview = null;
    shippingTodos.push('TODO: Set responsible_party on shipping_responsibility term_config.');
  }

  const shipping_burden = {
    customer_shipping_collected: shippingChargeToCustomer,
    responsible_party: responsibleParty,
    modeled_merchant_shipping_cost: modeledMerchantShippingCost,
    merchant_burden_preview: merchantBurdenPreview,
    basis_label: shippingBasis,
    todos: shippingTodos,
  };

  const returnTerm = terms.find((t) => t.term_group === 'return_expiry') ?? null;
  const retCfg = (returnTerm?.term_config ?? null) as Record<string, unknown> | null;
  const reserveRateBp =
    coerceNumber(retCfg?.return_reserve_rate_bp) ??
    coerceNumber(retCfg?.reserve_rate_bp) ??
    coerceNumber(retCfg?.return_reserve_bp);
  const returnTodos: string[] = [];
  if (!returnTerm) {
    returnTodos.push('TODO: Add return_expiry term to preview return / spoilage reserve rate.');
  } else if (reserveRateBp == null) {
    returnTodos.push(
      'TODO: Add return_reserve_rate_bp (basis points of merchandise subtotal) on return_expiry term_config.'
    );
  }
  const reserve_amount_preview = merchandiseSubtotal * ((reserveRateBp ?? 0) / 10000);
  const return_reserve = {
    reserve_rate_bp_applied: reserveRateBp,
    reserve_amount_preview,
    basis_label:
      reserveRateBp != null
        ? 'Reserve = merchandise subtotal × reserve_rate_bp / 10_000 (read-only placeholder for returns / expiry).'
        : 'Reserve rate not configured on term — amount is zero until return_reserve_rate_bp exists.',
    source_term_label: returnTerm?.label ?? null,
    todos: returnTodos,
  };

  const setCfg = (settlementTerm?.term_config ?? null) as Record<string, unknown> | null;
  const payoutCycleDays = setCfg ? coerceNumber(setCfg.payout_cycle_days) : null;
  const payoutDelayDays = setCfg ? coerceNumber(setCfg.payout_delay_days) : null;
  const adjustmentRateBp =
    coerceNumber(setCfg?.settlement_adjustment_rate_bp) ?? coerceNumber(setCfg?.payout_holdback_rate_bp);
  const settlementTodos: string[] = [];
  if (adjustmentRateBp == null && settlementTerm) {
    settlementTodos.push(
      'TODO: Add settlement_adjustment_rate_bp (basis points of expected payout) on settlement term_config for holdback preview.'
    );
  } else if (!settlementTerm) {
    settlementTodos.push('TODO: Add settlement term with payout_cycle_days / payout_delay_days for timing context.');
  }
  const adjustment_amount_preview = expectedPayoutPreview * ((adjustmentRateBp ?? 0) / 10000);
  const settlement_adjustment = {
    payout_cycle_days: payoutCycleDays,
    payout_delay_days: payoutDelayDays,
    timing_drag_amount_preview: 0,
    adjustment_rate_bp_applied: adjustmentRateBp,
    adjustment_amount_preview,
    basis_label:
      'Timing drag is not monetized. Optional adjustment = expected payout × settlement_adjustment_rate_bp / 10_000.',
    todos: settlementTodos,
  };

  let net_preview_after_read_only_reserves =
    expectedPayoutPreview - return_reserve.reserve_amount_preview - settlement_adjustment.adjustment_amount_preview;
  if (merchantBurdenPreview != null) {
    net_preview_after_read_only_reserves -= merchantBurdenPreview;
  } else {
    pushUnique(
      assumptions,
      'Net after read-only reserves excludes merchant shipping burden when outbound cost is not modeled on the term.'
    );
  }

  return {
    shipping_burden,
    return_reserve,
    settlement_adjustment,
    net_preview_after_read_only_reserves,
  };
}

export function buildPricingSimulatorPreview(args: {
  contract: CommercialContractListItem;
  currentVersion: NonNullable<CommercialContractListItem['current_version']>;
  priceBook: ChannelPriceBookDetail;
  line: ChannelPriceBookLine;
  pricingRules: ChannelPricingRule[];
  input: PricingSimulatorInput;
}): PricingSimulatorPreview {
  const { contract, currentVersion, priceBook, line, pricingRules, input } = args;

  const assumptions: string[] = [
    'Expected payout preview is deterministic for price book, rule, and normalized fee terms only.',
    'Campaign burden and spoilage-specific reserves are not modeled in the simulator yet.',
    'Reserve / adjustment read-model is preview-only: extend term_config keys documented in TODO markers before treating amounts as contractual truth.',
  ];
  const todos: string[] = [
    'Tighten settlement-direction behavior beyond preview-level payout treatment.',
    'Model tiered commission, split bearers, and reserve logic before treating this as a full financial source of truth.',
  ];

  const now = new Date();
  const applicableRules = pricingRules.filter(
    (rule) =>
      rule.is_active &&
      isRuleEffective(rule, now) &&
      (rule.canonical_sku_id == null || rule.canonical_sku_id === line.canonical_sku_id)
  );

  const minPriceRule = pickPreferredRule(applicableRules, 'min_price_override');
  const targetMarginRule = pickPreferredRule(applicableRules, 'target_margin_pct');
  const maxDiscountRule = pickPreferredRule(applicableRules, 'max_discount_pct');
  const merchantOfRecordRule = pickPreferredRule(applicableRules, 'merchant_of_record');
  const flowTypeRule = pickPreferredRule(applicableRules, 'flow_type');

  const quantity = Math.max(1, coerceNumber(input.quantity) ?? 1);
  const requestedDiscountPct = Math.max(0, coerceNumber(input.requested_discount_pct) ?? 0);
  const shippingChargeToCustomer = Math.max(0, coerceNumber(input.shipping_charge_to_customer) ?? 0);
  const maxDiscountPct = coerceNumber(maxDiscountRule?.numeric_value) ?? null;
  const effectiveDiscountPct =
    maxDiscountPct == null ? requestedDiscountPct : Math.min(requestedDiscountPct, Math.max(0, maxDiscountPct));

  const candidateUnitPrice = line.list_price * (1 - effectiveDiscountPct / 100);
  const floorPrice = coerceNumber(minPriceRule?.numeric_value) ?? line.floor_price ?? null;
  const finalUnitPrice = floorPrice == null ? candidateUnitPrice : Math.max(candidateUnitPrice, floorPrice);
  const floorPriceApplied = floorPrice != null && finalUnitPrice !== candidateUnitPrice ? floorPrice : null;
  const merchandiseSubtotal = finalUnitPrice * quantity;
  const orderGross = merchandiseSubtotal + shippingChargeToCustomer;

  const settlementTerm = currentVersion.terms.find((term) => term.term_group === 'settlement') ?? null;
  const settlementConfig = settlementTerm?.term_config as Record<string, unknown> | undefined;

  const merchant_of_record =
    (merchantOfRecordRule?.text_value as PricingSimulatorPreview['merchant_of_record']) ?? null;
  const flow_type =
    (flowTypeRule?.text_value as PricingSimulatorPreview['flow_type']) ??
    ((typeof settlementConfig?.settlement_direction === 'string'
      ? settlementConfig.settlement_direction
      : null) as PricingSimulatorPreview['flow_type']);

  const commissionItems = currentVersion.terms
    .filter((term) => term.term_group === 'commission')
    .map((term) => buildCommissionItem(term, merchandiseSubtotal, flow_type, assumptions));

  const paymentFeeItems = currentVersion.terms
    .filter((term) => term.term_group === 'payment_fee')
    .map((term) => buildPaymentFeeItem(term, merchandiseSubtotal, orderGross, flow_type, assumptions));

  const commission_summary = finalizeChargeGroup(currentVersion.commission_summary, commissionItems);
  const payment_fee_summary = finalizeChargeGroup(currentVersion.payment_fee_summary, paymentFeeItems);

  const estimatedChannelFees =
    commission_summary.deducted_from_payout_amount +
    commission_summary.due_separately_amount +
    payment_fee_summary.deducted_from_payout_amount +
    payment_fee_summary.due_separately_amount;

  const commissionImpactTotal =
    commission_summary.deducted_from_payout_amount + commission_summary.due_separately_amount;
  const paymentFeeImpactTotal =
    payment_fee_summary.deducted_from_payout_amount + payment_fee_summary.due_separately_amount;

  const payoutDeductionTotal =
    commission_summary.deducted_from_payout_amount + payment_fee_summary.deducted_from_payout_amount;
  const feesDueSeparately =
    commission_summary.due_separately_amount + payment_fee_summary.due_separately_amount;

  if (flow_type === 'merchant_collects_then_fees_due') {
    pushUnique(assumptions, 'Merchant-collected flow shows fees due separately instead of deducting them from payout.');
  } else if (flow_type === 'manual_reconciliation') {
    pushUnique(assumptions, 'Manual reconciliation flow is still simplified to preview-level fee treatment.');
  } else if (flow_type === 'split_settlement') {
    pushUnique(assumptions, 'Split settlement is simplified to payout deductions for merchant-borne fees.');
  }

  if (targetMarginRule?.numeric_value != null) {
    pushUnique(
      assumptions,
      `Target margin rule remains advisory in this foundation (${targetMarginRule.numeric_value}%).`
    );
  }

  const costSource: PricingSimulatorCostBasisSource =
    coerceNumber(input.unit_cogs_override) != null
      ? 'override'
      : line.base_cost_price != null
        ? 'item_cost'
        : 'zero_fallback';
  const unitCost = coerceNumber(input.unit_cogs_override) ?? line.base_cost_price ?? 0;
  const costBasisTotal = unitCost * quantity;

  const expectedPayoutPreview = orderGross - payoutDeductionTotal;
  const trueNetMarginPreview = orderGross - estimatedChannelFees - costBasisTotal;
  const trueNetMarginPct = orderGross > 0 ? (trueNetMarginPreview / orderGross) * 100 : null;

  const reserve_layer = buildReserveLayerPreview({
    terms: currentVersion.terms,
    settlementTerm,
    merchandiseSubtotal,
    shippingChargeToCustomer,
    expectedPayoutPreview,
    assumptions,
  });
  for (const row of [
    ...reserve_layer.shipping_burden.todos,
    ...reserve_layer.return_reserve.todos,
    ...reserve_layer.settlement_adjustment.todos,
  ]) {
    pushUnique(todos, row);
  }

  return {
    currency: priceBook.currency,
    merchant_of_record,
    flow_type,
    contract: {
      id: contract.id,
      contract_code: contract.contract_code,
      name: contract.name,
      version_id: currentVersion.id,
    },
    price_book: {
      id: priceBook.id,
      name: priceBook.name,
      channel_name: priceBook.channel_name,
    },
    line: {
      canonical_sku_id: line.canonical_sku_id,
      sku: line.sku,
      item_name: line.item_name,
      item_name_ar: line.item_name_ar,
      base_unit_price: line.base_selling_price ?? line.list_price,
      base_selling_price: line.base_selling_price,
      channel_list_price: line.list_price,
      floor_price: line.floor_price,
      base_cost_price: line.base_cost_price,
    },
    inputs: {
      ...input,
      quantity,
      requested_discount_pct: requestedDiscountPct,
      shipping_charge_to_customer: shippingChargeToCustomer,
      unit_cogs_override: coerceNumber(input.unit_cogs_override),
    },
    price_context: {
      quantity,
      requested_discount_pct: requestedDiscountPct,
      effective_discount_pct: effectiveDiscountPct,
      base_selling_price: line.base_selling_price,
      channel_list_price: line.list_price,
      candidate_unit_price: candidateUnitPrice,
      floor_price: floorPrice,
      floor_price_applied: floorPriceApplied,
      final_unit_price: finalUnitPrice,
      shipping_charge_to_customer: shippingChargeToCustomer,
      merchandise_subtotal: merchandiseSubtotal,
      order_gross: orderGross,
    },
    cost_basis: {
      unit_cost: unitCost,
      total_cost: costBasisTotal,
      source: costSource,
    },
    commission_summary,
    payment_fee_summary,
    outputs: {
      effective_discount_pct: effectiveDiscountPct,
      floor_price_applied: floorPriceApplied,
      final_unit_price: finalUnitPrice,
      merchandise_subtotal: merchandiseSubtotal,
      order_gross: orderGross,
      commission_total: commissionImpactTotal,
      payment_fee_total: paymentFeeImpactTotal,
      estimated_channel_fees: estimatedChannelFees,
      payout_deduction_total: payoutDeductionTotal,
      fees_due_separately: feesDueSeparately,
      cost_basis_total: costBasisTotal,
      expected_payout_preview: expectedPayoutPreview,
      true_net_margin_preview: trueNetMarginPreview,
      true_net_margin_pct: trueNetMarginPct,
    },
    reserve_layer,
    applied_rules: buildAppliedRuleSummary(
      applicableRules,
      requestedDiscountPct,
      effectiveDiscountPct,
      floorPrice,
      priceBook.currency
    ),
    assumptions,
    todos,
  };
}
