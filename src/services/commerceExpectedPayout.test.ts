import { describe, expect, it } from 'vitest';
import { buildPricingSimulatorPreview } from '@/services/commerceExpectedPayout';

function makeArgs(termConfig: Record<string, unknown>) {
  return {
    contract: {
      id: 'contract-1',
      contract_code: 'C-001',
      name: 'Test contract',
    } as any,
    currentVersion: {
      id: 'v-1',
      commission_summary: null,
      payment_fee_summary: null,
      terms: [
        {
          id: 'term-commission',
          term_code: 'commission_main',
          label: 'Commission',
          term_group: 'commission',
          summary: null,
          term_config: termConfig,
        },
      ],
    } as any,
    priceBook: {
      id: 'pb-1',
      name: 'Default',
      channel_name: 'Channel',
      currency: 'SAR',
    } as any,
    line: {
      canonical_sku_id: 'sku-1',
      sku: 'SKU-1',
      item_name: 'Item',
      item_name_ar: null,
      list_price: 100,
      base_selling_price: 100,
      floor_price: null,
      base_cost_price: null,
    } as any,
    pricingRules: [],
    input: {
      channel_account_id: null,
      contract_id: 'contract-1',
      price_book_id: 'pb-1',
      canonical_sku_id: 'sku-1',
      quantity: 2,
      requested_discount_pct: 0,
      shipping_charge_to_customer: 0,
      unit_cogs_override: null,
    },
  };
}

describe('buildPricingSimulatorPreview tiered commission modes', () => {
  const tiers = {
    tiers: [
      { min_order_amount: 0, max_order_amount: 100, rate_bp: 500 },
      { min_order_amount: 100, max_order_amount: null, rate_bp: 1000 },
    ],
  };

  it('keeps single_band as default behavior', () => {
    const preview = buildPricingSimulatorPreview(
      makeArgs({
        basis: 'tiered',
        bearer: 'merchant',
        tier_json: tiers,
      })
    );

    expect(preview.commission_summary.items[0]?.modeled).toBe(true);
    expect(preview.commission_summary.items[0]?.amount).toBe(20);
    expect(preview.commission_summary.items[0]?.note).toContain('single_band');
  });

  it('computes bracketed commission in progressive mode', () => {
    const preview = buildPricingSimulatorPreview(
      makeArgs({
        basis: 'tiered',
        tier_mode: 'progressive',
        bearer: 'merchant',
        tier_json: tiers,
      })
    );

    expect(preview.commission_summary.items[0]?.modeled).toBe(true);
    expect(preview.commission_summary.items[0]?.amount).toBe(15);
    expect(preview.commission_summary.items[0]?.note).toContain('progressive');
  });

  it('fails gracefully when progressive coverage is incomplete', () => {
    const preview = buildPricingSimulatorPreview(
      makeArgs({
        basis: 'tiered',
        tier_mode: 'progressive',
        bearer: 'merchant',
        tier_json: {
          tiers: [{ min_order_amount: 50, max_order_amount: null, rate_bp: 1000 }],
        },
      })
    );

    expect(preview.commission_summary.items[0]?.modeled).toBe(false);
    expect(preview.commission_summary.items[0]?.amount).toBeNull();
    expect(preview.commission_summary.items[0]?.note).toContain('does not fully cover');
  });
});
