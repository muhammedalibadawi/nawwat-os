/**
 * CommerceOS — Channel Revenue layer + CRM alignment (no storefront).
 * Some entities already exist in DB (`channel_accounts`, views `commerce_*_v`); others are Phase 2+ schema targets.
 */

/** Commercial channel taxonomy (operations sense — not WorkOS `work_channels`). */
export type CommerceChannelKind =
  | 'marketplace'
  | 'pos_partner'
  | 'wholesale_b2b'
  | 'own_channel'
  | 'aggregator'
  | 'other';

/** Who receives net funds after fees (high-level). */
export type SettlementDirection =
  | 'channel_collects_then_payout'
  | 'merchant_collects_then_fees_due'
  | 'split_settlement'
  | 'manual_reconciliation';

/** Who pays a given fee class. */
export type FeeBearer = 'merchant' | 'channel' | 'customer' | 'split';

/** ——— Existing table: public.channel_accounts (current integration surface) ——— */
export interface ChannelAccountRecord {
  id: string;
  tenant_id: string;
  channel_name: string;
  connection_status: string;
  credentials_secret_id: string | null;
  credentials_metadata: Record<string, unknown> | null;
  health_status: string;
  last_error_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** ——— DB: public.commercial_contracts ——— */
export type CommercialContractStatus = 'draft' | 'active' | 'suspended' | 'ended';

export interface CommercialContractRow {
  id: string;
  tenant_id: string;
  contract_code: string;
  name: string;
  channel_account_id: string | null;
  counterparty_contact_id: string | null;
  status: CommercialContractStatus;
  effective_from: string | null;
  effective_to: string | null;
  current_version_id: string | null;
  summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** ——— DB: public.commercial_contract_versions ——— */
export interface CommercialContractVersionRow {
  id: string;
  tenant_id: string;
  contract_id: string;
  version_number: number;
  is_current: boolean;
  commission_summary: string | null;
  payment_fee_summary: string | null;
  shipping_responsibility_summary: string | null;
  return_expiry_summary: string | null;
  settlement_terms_summary: string | null;
  created_at: string;
}

export type CommercialContractVersionTermGroup =
  | 'commission'
  | 'payment_fee'
  | 'shipping_responsibility'
  | 'return_expiry'
  | 'settlement';

export interface CommercialContractCommissionTermConfig {
  basis: ContractCommissionRule['basis'];
  rate_bp: number | null;
  tier_json: ContractCommissionTierJson | null;
  tier_mode?: ContractCommissionTierMode;
  bearer: FeeBearer;
}

export interface ContractCommissionTierBand {
  min_order_amount: number;
  /** Null means open-ended final band. */
  max_order_amount: number | null;
  rate_bp: number;
}

export interface ContractCommissionTierJson {
  tiers: ContractCommissionTierBand[];
}

export type ContractCommissionTierMode = 'single_band' | 'progressive';

export interface CommercialContractPaymentFeeTermConfig {
  fee_type: ContractFeeRule['fee_type'];
  rate_bp: number | null;
  fixed_amount: number | null;
  currency: string | null;
  bearer: FeeBearer;
}

export interface CommercialContractShippingResponsibilityTermConfig {
  responsible_party: ContractShippingRule['responsible_party'] | 'split';
  notes: string | null;
  /** Estimated merchant-fulfilled outbound shipping per order (pricing preview; tenant currency context). */
  estimated_merchant_outbound_shipping?: number | null;
}

export interface CommercialContractReturnExpiryTermConfig {
  return_window: ContractReturnRule['return_window'];
  expiry_handling: ContractReturnRule['expiry_handling'];
  restock_fee_bp: number | null;
  notes: string | null;
  /** Basis points of merchandise subtotal for return/expiry reserve preview (0–10_000). */
  return_reserve_rate_bp?: number | null;
}

export interface CommercialContractSettlementTermConfig {
  settlement_direction: SettlementDirection;
  payout_cycle_days: number | null;
  payout_delay_days: number | null;
  notes: string | null;
  /** Basis points of expected payout for holdback preview (0–10_000); mirrored with payout_holdback_rate_bp on normalize. */
  settlement_adjustment_rate_bp?: number | null;
  /** Alias of settlement_adjustment_rate_bp for pricing preview readers. */
  payout_holdback_rate_bp?: number | null;
}

export type CommercialContractVersionTermConfig =
  | CommercialContractCommissionTermConfig
  | CommercialContractPaymentFeeTermConfig
  | CommercialContractShippingResponsibilityTermConfig
  | CommercialContractReturnExpiryTermConfig
  | CommercialContractSettlementTermConfig;

export interface CommercialContractVersionTermRow {
  id: string;
  tenant_id: string;
  contract_version_id: string;
  term_group: CommercialContractVersionTermGroup;
  term_code: string;
  label: string;
  summary: string | null;
  term_config: CommercialContractVersionTermConfig;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommercialContractVersionWithTerms extends CommercialContractVersionRow {
  terms: CommercialContractVersionTermRow[];
}

export interface CommercialContractListItem extends CommercialContractRow {
  current_version: CommercialContractVersionWithTerms | null;
}

/** @deprecated Use CommercialContractRow */
export type CommercialContract = CommercialContractRow;

export interface CreateCommercialContractInput {
  contract_code: string;
  name: string;
  channel_account_id?: string | null;
  counterparty_contact_id?: string | null;
  status?: CommercialContractStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  summary?: string | null;
  notes?: string | null;
}

export interface CreateCommercialContractVersionInput {
  contract_id: string;
  version_number?: number;
  commission_summary?: string | null;
  payment_fee_summary?: string | null;
  shipping_responsibility_summary?: string | null;
  return_expiry_summary?: string | null;
  settlement_terms_summary?: string | null;
  terms?: CreateCommercialContractVersionTermInput[];
  set_as_current: boolean;
}

export interface CreateCommercialContractVersionTermInput {
  term_group: CommercialContractVersionTermGroup;
  term_code: string;
  label: string;
  summary?: string | null;
  term_config?: CommercialContractVersionTermConfig;
  sort_order?: number;
  is_active?: boolean;
}

/** Nested rule groups (stored as JSONB or child tables TBD). */
export interface ContractTermsBlock {
  payment_gateway_fees: ContractFeeRule[];
  channel_commission: ContractCommissionRule[];
  shipping_responsibility: ContractShippingRule;
  returns_and_expiry: ContractReturnRule;
  campaign_cost_allocations: CampaignCostAllocation[];
}

export interface ContractFeeRule {
  id: string;
  label: string;
  fee_type: 'percent_of_gmv' | 'fixed_per_order' | 'percent_of_payment';
  rate_bp: number | null;
  fixed_amount: number | null;
  currency: string;
  bearer: FeeBearer;
}

export interface ContractCommissionRule {
  id: string;
  label: string;
  basis: 'percent_of_line' | 'percent_of_order_net' | 'tiered';
  rate_bp: number | null;
  tier_json: ContractCommissionTierJson | null;
  tier_mode?: ContractCommissionTierMode;
  bearer: FeeBearer;
}

export interface ContractShippingRule {
  responsible_party: 'merchant' | 'channel' | 'customer' | 'dynamic_by_region';
  notes: string | null;
}

export interface ContractReturnRule {
  return_window: string | null;
  expiry_handling: 'merchant' | 'channel' | 'split' | 'case_by_case';
  restock_fee_bp: number | null;
  notes: string | null;
}

export interface CampaignCostAllocation {
  id: string;
  campaign_code: string;
  allocation_basis: 'percent_of_sales' | 'fixed_monthly' | 'cogs_share';
  allocation_value: number;
  currency: string | null;
}

/** ——— DB: public.channel_price_books ——— */
export interface ChannelPriceBookRow {
  id: string;
  tenant_id: string;
  channel_account_id: string;
  name: string;
  currency: string;
  effective_from: string | null;
  effective_to: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelPriceBook extends ChannelPriceBookRow {
  channel_name: string | null;
  line_count: number;
}

/** ——— DB: public.channel_price_book_lines ——— */
export interface ChannelPriceBookLineRow {
  id: string;
  tenant_id: string;
  price_book_id: string;
  canonical_sku_id: string;
  list_price: number;
  floor_price: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelPriceBookLine extends ChannelPriceBookLineRow {
  item_id: string | null;
  sku: string | null;
  item_name: string | null;
  item_name_ar: string | null;
  base_selling_price: number | null;
  base_cost_price: number | null;
}

export interface ChannelPriceBookDetail extends ChannelPriceBookRow {
  channel_name: string | null;
  line_count: number;
  lines: ChannelPriceBookLine[];
}

export type ChannelPricingRuleType =
  | 'min_price_override'
  | 'target_margin_pct'
  | 'max_discount_pct'
  | 'merchant_of_record'
  | 'flow_type';

export type MerchantOfRecord = 'merchant' | 'channel';

/** ——— DB: public.channel_pricing_rules ——— */
export interface ChannelPricingRuleRow {
  id: string;
  tenant_id: string;
  price_book_id: string;
  canonical_sku_id: string | null;
  rule_type: ChannelPricingRuleType;
  numeric_value: number | null;
  text_value: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelPricingRule extends ChannelPricingRuleRow {
  scope: 'price_book' | 'sku';
  sku: string | null;
  item_id: string | null;
  item_name: string | null;
  item_name_ar: string | null;
}

export interface PricingSimulatorContext {
  channel_accounts: ChannelAccountRecord[];
  contracts: CommercialContractListItem[];
  price_books: ChannelPriceBook[];
}

export interface PricingSimulatorInput {
  channel_account_id: string | null;
  contract_id: string | null;
  price_book_id: string | null;
  canonical_sku_id: string | null;
  quantity: number;
  requested_discount_pct: number;
  shipping_charge_to_customer: number;
  unit_cogs_override: number | null;
}

export interface PricingSimulatorAppliedRuleSummary {
  rule_id: string;
  rule_type: ChannelPricingRuleType;
  scope: 'price_book' | 'sku';
  label: string;
  value_label: string;
  effect_summary: string;
}

export type PricingSimulatorChargeTreatment =
  | 'deducted_from_payout'
  | 'due_separately'
  | 'not_merchant_borne'
  | 'not_modeled';

export interface PricingSimulatorChargeItemSummary {
  term_id: string;
  term_code: string;
  label: string;
  term_group: 'commission' | 'payment_fee';
  bearer: FeeBearer | null;
  basis_label: string;
  amount: number | null;
  modeled: boolean;
  treatment: PricingSimulatorChargeTreatment;
  note: string | null;
}

export interface PricingSimulatorChargeGroupSummary {
  summary_text: string | null;
  total_modeled_amount: number;
  deducted_from_payout_amount: number;
  due_separately_amount: number;
  not_merchant_borne_amount: number;
  unmodeled_term_count: number;
  items: PricingSimulatorChargeItemSummary[];
}

export type PricingSimulatorCostBasisSource = 'override' | 'item_cost' | 'zero_fallback';

/** Read-only reserve / adjustment layer (deterministic preview only; not settlement truth). */
export interface PricingSimulatorShippingBurdenPreview {
  customer_shipping_collected: number;
  responsible_party: string | null;
  /** From term_config if present (e.g. estimated_merchant_outbound_shipping); else null. */
  modeled_merchant_shipping_cost: number | null;
  /** max(0, modeled cost − collected) when cost modeled; else null. */
  merchant_burden_preview: number | null;
  basis_label: string;
  todos: string[];
}

export interface PricingSimulatorReturnReservePreview {
  reserve_rate_bp_applied: number | null;
  reserve_amount_preview: number;
  basis_label: string;
  source_term_label: string | null;
  todos: string[];
}

export interface PricingSimulatorSettlementAdjustmentPreview {
  payout_cycle_days: number | null;
  payout_delay_days: number | null;
  /** Placeholder — not monetized until treasury model exists. */
  timing_drag_amount_preview: number;
  adjustment_rate_bp_applied: number | null;
  adjustment_amount_preview: number;
  basis_label: string;
  todos: string[];
}

export interface PricingSimulatorReserveLayerPreview {
  shipping_burden: PricingSimulatorShippingBurdenPreview;
  return_reserve: PricingSimulatorReturnReservePreview;
  settlement_adjustment: PricingSimulatorSettlementAdjustmentPreview;
  /** Payout preview minus modeled reserve/adjustment/burden (burden omitted when unknown). */
  net_preview_after_read_only_reserves: number;
}

export interface PricingSimulatorPreview {
  currency: string;
  merchant_of_record: MerchantOfRecord | null;
  flow_type: SettlementDirection | null;
  contract: {
    id: string;
    contract_code: string;
    name: string;
    version_id: string | null;
  };
  price_book: {
    id: string;
    name: string;
    channel_name: string | null;
  };
  line: {
    canonical_sku_id: string;
    sku: string | null;
    item_name: string | null;
    item_name_ar: string | null;
    base_unit_price: number;
    base_selling_price: number | null;
    channel_list_price: number;
    floor_price: number | null;
    base_cost_price: number | null;
  };
  inputs: PricingSimulatorInput;
  price_context: {
    quantity: number;
    requested_discount_pct: number;
    effective_discount_pct: number;
    base_selling_price: number | null;
    channel_list_price: number;
    candidate_unit_price: number;
    floor_price: number | null;
    floor_price_applied: number | null;
    final_unit_price: number;
    shipping_charge_to_customer: number;
    merchandise_subtotal: number;
    order_gross: number;
  };
  cost_basis: {
    unit_cost: number;
    total_cost: number;
    source: PricingSimulatorCostBasisSource;
  };
  commission_summary: PricingSimulatorChargeGroupSummary;
  payment_fee_summary: PricingSimulatorChargeGroupSummary;
  outputs: {
    effective_discount_pct: number;
    floor_price_applied: number | null;
    final_unit_price: number;
    merchandise_subtotal: number;
    order_gross: number;
    commission_total: number;
    payment_fee_total: number;
    estimated_channel_fees: number;
    payout_deduction_total: number;
    fees_due_separately: number;
    cost_basis_total: number;
    expected_payout_preview: number;
    true_net_margin_preview: number;
    true_net_margin_pct: number | null;
  };
  reserve_layer: PricingSimulatorReserveLayerPreview;
  applied_rules: PricingSimulatorAppliedRuleSummary[];
  assumptions: string[];
  todos: string[];
}

/**
 * Operational reference to SKU↔channel mapping (lives today in commerce mapping tables/views).
 * Keep aligned with `commerce_mapping_queue_v` / confirm RPCs — separate normalization in Phase 2.
 */
export interface SkuChannelMapRef {
  mapping_id?: string;
  channel_account_id: string;
  item_id: string;
  sku: string;
  channel_item_id: string | null;
  mapping_status: string;
}

/** Inputs for a margin / payout calc (pure structure — engine later). */
export interface OrderEconomicsDraft {
  order_gross: number;
  currency: string;
  channel_account_id: string;
  line_cogs_estimate: number | null;
  applied_fee_total: number | null;
  applied_commission_total: number | null;
  shipping_charge_to_customer: number | null;
  campaign_cost_alloc: number | null;
}

export interface MarginEstimate {
  net_after_fees: number;
  gross_margin: number | null;
  currency: string;
  assumptions: string[];
}

/** What-if inputs for UI simulator (no persistence in Phase 1). */
export interface PricingSimulatorScenario {
  label: string;
  draft: OrderEconomicsDraft;
  /** When contract + price books exist, reference here instead of free-form draft. */
  contract_version_id: string | null;
  price_book_id: string | null;
}

/* -------------------------------------------------------------------------- */
/* Schema & RLS direction (repo-level; not executable SQL)                      */
/* -------------------------------------------------------------------------- */
/**
 * - RLS: commerce tables (`channel_accounts`, `sku_mappings`, …) already have RLS policies
 *   scoped to tenant + role (see `20240101000001_commerce_rls.sql`). New tables must follow the same pattern.
 * - Multi-source reconciliation (e.g. channel payout vs merchant ledger vs PSP): **not implemented**;
 *   `SettlementDirection` + future settlement_run tables are design direction only.
 * - Contract rows + versions exist after 20260325190000_commercial_contracts_foundation.sql.
 * - Normalized contract version terms exist after 20260401090000_contract_version_terms_normalization.sql.
 * - Channel price books exist after 20260401093000_channel_price_books_foundation.sql; pricing/margin execution is still future work.
 * - Channel pricing rules exist after 20260401100000_channel_pricing_rules_scaffolding.sql; execution/calculation is still future work.
 */
export type CommerceSchemaDirectionNote = 'see_jsdoc_above';
