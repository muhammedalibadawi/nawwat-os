/**
 * Normalization + validation for commercial_contract_version_terms.term_config
 * preview-related keys (pricing simulator read-model). Keeps RPC payloads consistent.
 */
import type {
  CommercialContractCommissionTermConfig,
  ContractCommissionTierBand,
  ContractCommissionTierJson,
  CommercialContractPaymentFeeTermConfig,
  CommercialContractReturnExpiryTermConfig,
  CommercialContractSettlementTermConfig,
  CommercialContractShippingResponsibilityTermConfig,
  CommercialContractVersionTermConfig,
  CommercialContractVersionTermGroup,
} from '@/types/commerceFoundation';

/** Basis points: 0 = 0%, 10_000 = 100%. */
export const COMMERCE_PREVIEW_BP_MIN = 0;
export const COMMERCE_PREVIEW_BP_MAX = 10_000;
const COMMERCE_MAX_REASONABLE_FIXED_AMOUNT = 1_000_000_000;

export class CommercialContractTermConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommercialContractTermConfigError';
  }
}

function assertPlainObject(termConfig: unknown): Record<string, unknown> {
  if (termConfig == null || typeof termConfig !== 'object' || Array.isArray(termConfig)) {
    throw new CommercialContractTermConfigError('term_config must be a plain object.');
  }
  return { ...(termConfig as Record<string, unknown>) };
}

/** Strict coerce: undefined = absent, null = explicit null. */
function coerceOptionalNonNegativeNumber(value: unknown, fieldLabel: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(n)) {
    throw new CommercialContractTermConfigError(`${fieldLabel} must be a finite number.`);
  }
  if (n < 0) {
    throw new CommercialContractTermConfigError(`${fieldLabel} must be >= 0.`);
  }
  return n;
}

function coerceOptionalPreviewBp(value: unknown, fieldLabel: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new CommercialContractTermConfigError(`${fieldLabel} must be a whole-number basis point value.`);
  }
  if (n < COMMERCE_PREVIEW_BP_MIN || n > COMMERCE_PREVIEW_BP_MAX) {
    throw new CommercialContractTermConfigError(
      `${fieldLabel} must be between ${COMMERCE_PREVIEW_BP_MIN} and ${COMMERCE_PREVIEW_BP_MAX} bp.`
    );
  }
  return n;
}

function coerceOptionalStringEnum<T extends string>(
  value: unknown,
  fieldLabel: string,
  allowed: readonly T[]
): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CommercialContractTermConfigError(`${fieldLabel} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new CommercialContractTermConfigError(`${fieldLabel} cannot be blank.`);
  }
  if (!allowed.includes(normalized as T)) {
    throw new CommercialContractTermConfigError(`${fieldLabel} must be one of: ${allowed.join(', ')}.`);
  }
  return normalized as T;
}

function lenientStringEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

function coerceRequiredNonNegativeNumber(value: unknown, fieldLabel: string): number {
  const n = coerceOptionalNonNegativeNumber(value, fieldLabel);
  if (n == null) {
    throw new CommercialContractTermConfigError(`${fieldLabel} is required and must be >= 0.`);
  }
  return n;
}

function coerceRequiredPreviewBp(value: unknown, fieldLabel: string): number {
  const n = coerceOptionalPreviewBp(value, fieldLabel);
  if (n == null) {
    throw new CommercialContractTermConfigError(`${fieldLabel} is required and must be 0..10000.`);
  }
  return n;
}

function validateAndNormalizeTierBandsForPersist(rawTierJson: unknown): ContractCommissionTierJson {
  if (rawTierJson == null || typeof rawTierJson !== 'object' || Array.isArray(rawTierJson)) {
    throw new CommercialContractTermConfigError('Commission tiered basis requires tier_json object.');
  }
  const tierObj = rawTierJson as Record<string, unknown>;
  if (!Array.isArray(tierObj.tiers)) {
    throw new CommercialContractTermConfigError('tier_json.tiers must be an array.');
  }
  if (tierObj.tiers.length === 0) {
    throw new CommercialContractTermConfigError('tier_json.tiers cannot be empty.');
  }

  const normalized: ContractCommissionTierBand[] = tierObj.tiers.map((entry, index) => {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new CommercialContractTermConfigError(`tier_json.tiers[${index}] must be an object.`);
    }
    const row = entry as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(row, 'min_order_amount')) {
      throw new CommercialContractTermConfigError(`tier_json.tiers[${index}].min_order_amount is required.`);
    }
    if (!Object.prototype.hasOwnProperty.call(row, 'max_order_amount')) {
      throw new CommercialContractTermConfigError(`tier_json.tiers[${index}].max_order_amount is required (use null for open-ended).`);
    }
    if (!Object.prototype.hasOwnProperty.call(row, 'rate_bp')) {
      throw new CommercialContractTermConfigError(`tier_json.tiers[${index}].rate_bp is required.`);
    }

    const min_order_amount = coerceRequiredNonNegativeNumber(
      row.min_order_amount,
      `tier_json.tiers[${index}].min_order_amount`
    );
    const max_order_amount =
      row.max_order_amount === null
        ? null
        : coerceRequiredNonNegativeNumber(row.max_order_amount, `tier_json.tiers[${index}].max_order_amount`);
    const rate_bp = coerceRequiredPreviewBp(row.rate_bp, `tier_json.tiers[${index}].rate_bp`);

    if (max_order_amount != null && max_order_amount <= min_order_amount) {
      throw new CommercialContractTermConfigError(
        `tier_json.tiers[${index}] has max_order_amount <= min_order_amount.`
      );
    }

    return { min_order_amount, max_order_amount, rate_bp };
  });

  const sorted = [...normalized].sort((a, b) => a.min_order_amount - b.min_order_amount);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.max_order_amount == null) {
      throw new CommercialContractTermConfigError('Open-ended tier (max_order_amount = null) must be the final band.');
    }
    if (curr.min_order_amount < prev.min_order_amount) {
      throw new CommercialContractTermConfigError('tier_json.tiers ordering is invalid.');
    }
    if (curr.min_order_amount < prev.max_order_amount) {
      throw new CommercialContractTermConfigError(
        `tier_json.tiers overlap between bands ending at ${prev.max_order_amount} and starting at ${curr.min_order_amount}.`
      );
    }
  }

  return { tiers: sorted };
}

function normalizeTierBandsForRead(rawTierJson: unknown): ContractCommissionTierJson | null {
  if (rawTierJson == null || typeof rawTierJson !== 'object' || Array.isArray(rawTierJson)) {
    return null;
  }
  const tierObj = rawTierJson as Record<string, unknown>;
  if (!Array.isArray(tierObj.tiers) || tierObj.tiers.length === 0) return null;

  const parsed: ContractCommissionTierBand[] = [];
  for (const entry of tierObj.tiers) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const min = lenientNonNegative(row.min_order_amount);
    const max = row.max_order_amount === null ? null : lenientNonNegative(row.max_order_amount);
    const rate = lenientPreviewBp(row.rate_bp);
    if (min == null || rate == null) continue;
    if (row.max_order_amount !== null && max == null) continue;
    if (max != null && max <= min) continue;
    parsed.push({ min_order_amount: min, max_order_amount: max, rate_bp: rate });
  }
  if (parsed.length === 0) return null;
  const sorted = [...parsed].sort((a, b) => a.min_order_amount - b.min_order_amount);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.max_order_amount == null || curr.min_order_amount < prev.max_order_amount) {
      return null;
    }
  }
  return { tiers: sorted };
}

function requireSingleNumericValue(
  entries: Array<[string, number | null | undefined]>,
  label: string
): number | null | undefined {
  const defined = entries.filter(([, v]) => v !== undefined && v !== null) as [string, number][];
  if (defined.length === 0) return undefined;
  const values = defined.map(([, v]) => v);
  if (new Set(values).size > 1) {
    throw new CommercialContractTermConfigError(
      `${label}: conflicting values on ${defined.map(([k]) => k).join(', ')}; use one canonical field or matching values.`
    );
  }
  return values[0];
}

function normalizeShippingResponsibilityForPersist(
  raw: Record<string, unknown>
): CommercialContractShippingResponsibilityTermConfig {
  const out = { ...raw };
  const merged = requireSingleNumericValue(
    [
      ['estimated_merchant_outbound_shipping', coerceOptionalNonNegativeNumber(out.estimated_merchant_outbound_shipping, 'estimated_merchant_outbound_shipping')],
      ['merchant_outbound_shipping_cost', coerceOptionalNonNegativeNumber(out.merchant_outbound_shipping_cost, 'merchant_outbound_shipping_cost')],
      ['modeled_merchant_shipping_cost', coerceOptionalNonNegativeNumber(out.modeled_merchant_shipping_cost, 'modeled_merchant_shipping_cost')],
      ['merchant_shipping_cost_estimate', coerceOptionalNonNegativeNumber(out.merchant_shipping_cost_estimate, 'merchant_shipping_cost_estimate')],
    ],
    'Merchant outbound shipping estimate'
  );

  delete out.merchant_outbound_shipping_cost;
  delete out.modeled_merchant_shipping_cost;
  delete out.merchant_shipping_cost_estimate;

  if (merged === undefined) {
    delete out.estimated_merchant_outbound_shipping;
  } else if (merged === null) {
    out.estimated_merchant_outbound_shipping = null;
  } else {
    out.estimated_merchant_outbound_shipping = merged;
  }

  return out as unknown as CommercialContractShippingResponsibilityTermConfig;
}

function normalizeCommissionForPersist(raw: Record<string, unknown>): CommercialContractCommissionTermConfig {
  const out = { ...raw };
  const basis = coerceOptionalStringEnum(out.basis, 'basis', [
    'percent_of_line',
    'percent_of_order_net',
    'tiered',
  ] as const);
  const bearer = coerceOptionalStringEnum(out.bearer, 'bearer', ['merchant', 'channel', 'customer', 'split'] as const);
  const rateBp = coerceOptionalPreviewBp(out.rate_bp, 'rate_bp');
  const tierMode = coerceOptionalStringEnum(out.tier_mode, 'tier_mode', ['single_band', 'progressive'] as const);

  if (basis == null) {
    throw new CommercialContractTermConfigError('Commission term_config.basis is required.');
  }
  if (bearer == null) {
    throw new CommercialContractTermConfigError('Commission term_config.bearer is required.');
  }

  if (basis === 'tiered') {
    out.tier_json = validateAndNormalizeTierBandsForPersist(out.tier_json);
    out.rate_bp = null;
    out.tier_mode = tierMode ?? 'single_band';
  } else {
    if (rateBp == null) {
      throw new CommercialContractTermConfigError(`Commission basis "${basis}" requires rate_bp (0..10000).`);
    }
    out.rate_bp = rateBp;
    delete out.tier_mode;
    out.tier_json = null;
  }

  out.basis = basis;
  out.bearer = bearer;
  return out as unknown as CommercialContractCommissionTermConfig;
}

function normalizePaymentFeeForPersist(raw: Record<string, unknown>): CommercialContractPaymentFeeTermConfig {
  const out = { ...raw };
  const feeType = coerceOptionalStringEnum(out.fee_type, 'fee_type', [
    'percent_of_gmv',
    'fixed_per_order',
    'percent_of_payment',
  ] as const);
  const bearer = coerceOptionalStringEnum(out.bearer, 'bearer', ['merchant', 'channel', 'customer', 'split'] as const);
  const rateBp = coerceOptionalPreviewBp(out.rate_bp, 'rate_bp');
  const fixedAmount = coerceOptionalNonNegativeNumber(out.fixed_amount, 'fixed_amount');

  if (feeType == null) {
    throw new CommercialContractTermConfigError('Payment fee term_config.fee_type is required.');
  }
  if (bearer == null) {
    throw new CommercialContractTermConfigError('Payment fee term_config.bearer is required.');
  }

  if (feeType === 'fixed_per_order') {
    if (fixedAmount == null) {
      throw new CommercialContractTermConfigError('fixed_per_order payment fee requires fixed_amount >= 0.');
    }
    if (fixedAmount > COMMERCE_MAX_REASONABLE_FIXED_AMOUNT) {
      throw new CommercialContractTermConfigError(
        `fixed_amount is too large (>${COMMERCE_MAX_REASONABLE_FIXED_AMOUNT}) for preview data quality.`
      );
    }
    out.fixed_amount = fixedAmount;
    out.rate_bp = null;
  } else {
    if (rateBp == null) {
      throw new CommercialContractTermConfigError(`Payment fee "${feeType}" requires rate_bp (0..10000).`);
    }
    out.rate_bp = rateBp;
    out.fixed_amount = null;
  }

  out.fee_type = feeType;
  out.bearer = bearer;
  return out as unknown as CommercialContractPaymentFeeTermConfig;
}

function normalizeReturnExpiryForPersist(raw: Record<string, unknown>): CommercialContractReturnExpiryTermConfig {
  const out = { ...raw };
  const merged = requireSingleNumericValue(
    [
      ['return_reserve_rate_bp', coerceOptionalPreviewBp(out.return_reserve_rate_bp, 'return_reserve_rate_bp')],
      ['reserve_rate_bp', coerceOptionalPreviewBp(out.reserve_rate_bp, 'reserve_rate_bp')],
      ['return_reserve_bp', coerceOptionalPreviewBp(out.return_reserve_bp, 'return_reserve_bp')],
    ],
    'Return / expiry reserve rate'
  );

  delete out.reserve_rate_bp;
  delete out.return_reserve_bp;

  if (merged === undefined) {
    delete out.return_reserve_rate_bp;
  } else if (merged === null) {
    out.return_reserve_rate_bp = null;
  } else {
    out.return_reserve_rate_bp = merged;
  }

  return out as unknown as CommercialContractReturnExpiryTermConfig;
}

function normalizeSettlementForPersist(raw: Record<string, unknown>): CommercialContractSettlementTermConfig {
  const out = { ...raw };
  const adj = coerceOptionalPreviewBp(out.settlement_adjustment_rate_bp, 'settlement_adjustment_rate_bp');
  const hold = coerceOptionalPreviewBp(out.payout_holdback_rate_bp, 'payout_holdback_rate_bp');

  const hasAdj = adj !== undefined && adj !== null;
  const hasHold = hold !== undefined && hold !== null;
  if (hasAdj && hasHold && adj !== hold) {
    throw new CommercialContractTermConfigError(
      'settlement_adjustment_rate_bp and payout_holdback_rate_bp must match when both are set.'
    );
  }

  const merged = hasAdj ? adj : hasHold ? hold : undefined;

  if (merged === undefined) {
    delete out.settlement_adjustment_rate_bp;
    delete out.payout_holdback_rate_bp;
  } else if (merged === null) {
    out.settlement_adjustment_rate_bp = null;
    out.payout_holdback_rate_bp = null;
  } else {
    out.settlement_adjustment_rate_bp = merged;
    out.payout_holdback_rate_bp = merged;
  }

  return out as unknown as CommercialContractSettlementTermConfig;
}

/** Strict normalization before RPC (create draft / set current). */
export function normalizeCommercialContractTermConfigForPersist(
  termGroup: CommercialContractVersionTermGroup,
  termConfig: unknown
): CommercialContractVersionTermConfig {
  const base = assertPlainObject(termConfig);
  switch (termGroup) {
    case 'commission':
      return normalizeCommissionForPersist(base);
    case 'payment_fee':
      return normalizePaymentFeeForPersist(base);
    case 'shipping_responsibility':
      return normalizeShippingResponsibilityForPersist(base);
    case 'return_expiry':
      return normalizeReturnExpiryForPersist(base);
    case 'settlement':
      return normalizeSettlementForPersist(base);
    default:
      return base as unknown as CommercialContractVersionTermConfig;
  }
}

function lenientNonNegative(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function lenientPreviewBp(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < COMMERCE_PREVIEW_BP_MIN || n > COMMERCE_PREVIEW_BP_MAX) return null;
  return n;
}

function normalizeShippingResponsibilityForRead(raw: Record<string, unknown>): CommercialContractShippingResponsibilityTermConfig {
  const out = { ...raw };
  const merged =
    lenientNonNegative(out.estimated_merchant_outbound_shipping) ??
    lenientNonNegative(out.merchant_outbound_shipping_cost) ??
    lenientNonNegative(out.modeled_merchant_shipping_cost) ??
    lenientNonNegative(out.merchant_shipping_cost_estimate);

  delete out.merchant_outbound_shipping_cost;
  delete out.modeled_merchant_shipping_cost;
  delete out.merchant_shipping_cost_estimate;

  if (merged != null) {
    out.estimated_merchant_outbound_shipping = merged;
  }
  return out as unknown as CommercialContractShippingResponsibilityTermConfig;
}

function normalizeCommissionForRead(raw: Record<string, unknown>): CommercialContractCommissionTermConfig {
  const out = { ...raw };
  const basis = lenientStringEnum(out.basis, [
    'percent_of_line',
    'percent_of_order_net',
    'tiered',
  ] as const);
  const bearer = lenientStringEnum(out.bearer, ['merchant', 'channel', 'customer', 'split'] as const);
  const rateBp = lenientPreviewBp(out.rate_bp);
  const tierMode = lenientStringEnum(out.tier_mode, ['single_band', 'progressive'] as const);

  if (basis != null) out.basis = basis;
  if (bearer != null) out.bearer = bearer;

  if (basis === 'tiered') {
    out.rate_bp = null;
    out.tier_json = normalizeTierBandsForRead(out.tier_json);
    out.tier_mode = tierMode ?? 'single_band';
  } else {
    if (rateBp != null) {
      out.rate_bp = rateBp;
    }
    out.tier_json = null;
    delete out.tier_mode;
  }

  return out as unknown as CommercialContractCommissionTermConfig;
}

function normalizePaymentFeeForRead(raw: Record<string, unknown>): CommercialContractPaymentFeeTermConfig {
  const out = { ...raw };
  const feeType = lenientStringEnum(out.fee_type, [
    'percent_of_gmv',
    'fixed_per_order',
    'percent_of_payment',
  ] as const);
  const bearer = lenientStringEnum(out.bearer, ['merchant', 'channel', 'customer', 'split'] as const);
  const rateBp = lenientPreviewBp(out.rate_bp);
  const fixedAmount = lenientNonNegative(out.fixed_amount);

  if (feeType != null) out.fee_type = feeType;
  if (bearer != null) out.bearer = bearer;

  if (feeType === 'fixed_per_order') {
    out.rate_bp = null;
    if (fixedAmount != null) out.fixed_amount = fixedAmount;
  } else if (feeType === 'percent_of_gmv' || feeType === 'percent_of_payment') {
    out.fixed_amount = null;
    if (rateBp != null) out.rate_bp = rateBp;
  } else {
    if (rateBp != null) out.rate_bp = rateBp;
    if (fixedAmount != null) out.fixed_amount = fixedAmount;
  }

  return out as unknown as CommercialContractPaymentFeeTermConfig;
}

function normalizeReturnExpiryForRead(raw: Record<string, unknown>): CommercialContractReturnExpiryTermConfig {
  const out = { ...raw };
  const merged =
    lenientPreviewBp(out.return_reserve_rate_bp) ?? lenientPreviewBp(out.reserve_rate_bp) ?? lenientPreviewBp(out.return_reserve_bp);

  delete out.reserve_rate_bp;
  delete out.return_reserve_bp;

  if (merged != null) {
    out.return_reserve_rate_bp = merged;
  }
  return out as unknown as CommercialContractReturnExpiryTermConfig;
}

function normalizeSettlementForRead(raw: Record<string, unknown>): CommercialContractSettlementTermConfig {
  const out = { ...raw };
  const adj = lenientPreviewBp(out.settlement_adjustment_rate_bp);
  const hold = lenientPreviewBp(out.payout_holdback_rate_bp);
  const merged = adj ?? hold;
  if (merged != null) {
    out.settlement_adjustment_rate_bp = merged;
    out.payout_holdback_rate_bp = merged;
  }
  return out as unknown as CommercialContractSettlementTermConfig;
}

/** Lenient coercion for rows loaded from DB (preview + UI read-model). */
export function normalizeCommercialContractTermConfigForRead(
  termGroup: CommercialContractVersionTermGroup,
  termConfig: unknown
): CommercialContractVersionTermConfig {
  if (termConfig == null || typeof termConfig !== 'object' || Array.isArray(termConfig)) {
    return {} as unknown as CommercialContractVersionTermConfig;
  }
  const base = { ...(termConfig as Record<string, unknown>) };
  switch (termGroup) {
    case 'commission':
      return normalizeCommissionForRead(base);
    case 'payment_fee':
      return normalizePaymentFeeForRead(base);
    case 'shipping_responsibility':
      return normalizeShippingResponsibilityForRead(base);
    case 'return_expiry':
      return normalizeReturnExpiryForRead(base);
    case 'settlement':
      return normalizeSettlementForRead(base);
    default:
      return base as unknown as CommercialContractVersionTermConfig;
  }
}
