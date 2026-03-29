-- Minimal DB guardrail for commission tier_json shape.
-- Deep overlap/order checks remain in app normalization for maintainability.
BEGIN;

CREATE OR REPLACE FUNCTION public.trg_validate_commercial_contract_version_terms_preview_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    cfg JSONB;
    g TEXT;
    ship NUMERIC;
    mocc NUMERIC;
    mmsc NUMERIC;
    msce NUMERIC;
    rr NUMERIC;
    res NUMERIC;
    retbp NUMERIC;
    adj NUMERIC;
    hold NUMERIC;
    comm_rate NUMERIC;
    pay_rate NUMERIC;
    pay_fixed NUMERIC;
    basis TEXT;
    fee_type TEXT;
    bearer TEXT;
    tier JSONB;
BEGIN
    cfg := NEW.term_config;
    g := NEW.term_group;

    IF cfg IS NULL OR jsonb_typeof(cfg) <> 'object' THEN
        RETURN NEW;
    END IF;

    IF g = 'commission' THEN
        basis := NULLIF(trim(cfg->>'basis'), '');
        bearer := NULLIF(trim(cfg->>'bearer'), '');
        comm_rate := public._cc_term_config_numeric_or_null(cfg, 'rate_bp');

        IF basis IS NULL OR basis NOT IN ('percent_of_line', 'percent_of_order_net', 'tiered') THEN
            RAISE EXCEPTION 'commission.term_config.basis must be one of percent_of_line, percent_of_order_net, tiered';
        END IF;
        IF bearer IS NULL OR bearer NOT IN ('merchant', 'channel', 'customer', 'split') THEN
            RAISE EXCEPTION 'commission.term_config.bearer must be one of merchant, channel, customer, split';
        END IF;

        IF comm_rate IS NOT NULL THEN
            IF comm_rate <> trunc(comm_rate) OR comm_rate < 0 OR comm_rate > 10000 THEN
                RAISE EXCEPTION 'commission.term_config.rate_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;

        IF basis = 'tiered' THEN
            IF NOT (cfg ? 'tier_json') OR cfg->'tier_json' IS NULL OR jsonb_typeof(cfg->'tier_json') <> 'object' THEN
                RAISE EXCEPTION 'commission tiered basis requires term_config.tier_json object';
            END IF;
            IF jsonb_typeof(cfg->'tier_json'->'tiers') <> 'array' THEN
                RAISE EXCEPTION 'commission tiered basis requires term_config.tier_json.tiers array';
            END IF;
            IF jsonb_array_length(cfg->'tier_json'->'tiers') = 0 THEN
                RAISE EXCEPTION 'commission tiered basis requires at least one tier';
            END IF;
            FOR tier IN SELECT jsonb_array_elements(cfg->'tier_json'->'tiers')
            LOOP
                IF jsonb_typeof(tier) <> 'object' THEN
                    RAISE EXCEPTION 'commission tier_json.tiers entries must be objects';
                END IF;
                IF NOT (tier ? 'min_order_amount' AND tier ? 'max_order_amount' AND tier ? 'rate_bp') THEN
                    RAISE EXCEPTION 'commission tier_json tier requires min_order_amount, max_order_amount, rate_bp';
                END IF;
            END LOOP;
        ELSE
            IF comm_rate IS NULL THEN
                RAISE EXCEPTION 'commission non-tiered basis requires term_config.rate_bp';
            END IF;
        END IF;
    END IF;

    IF g = 'payment_fee' THEN
        fee_type := NULLIF(trim(cfg->>'fee_type'), '');
        bearer := NULLIF(trim(cfg->>'bearer'), '');
        pay_rate := public._cc_term_config_numeric_or_null(cfg, 'rate_bp');
        pay_fixed := public._cc_term_config_numeric_or_null(cfg, 'fixed_amount');

        IF fee_type IS NULL OR fee_type NOT IN ('percent_of_gmv', 'fixed_per_order', 'percent_of_payment') THEN
            RAISE EXCEPTION 'payment_fee.term_config.fee_type must be one of percent_of_gmv, fixed_per_order, percent_of_payment';
        END IF;
        IF bearer IS NULL OR bearer NOT IN ('merchant', 'channel', 'customer', 'split') THEN
            RAISE EXCEPTION 'payment_fee.term_config.bearer must be one of merchant, channel, customer, split';
        END IF;

        IF pay_rate IS NOT NULL THEN
            IF pay_rate <> trunc(pay_rate) OR pay_rate < 0 OR pay_rate > 10000 THEN
                RAISE EXCEPTION 'payment_fee.term_config.rate_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;
        IF pay_fixed IS NOT NULL AND pay_fixed < 0 THEN
            RAISE EXCEPTION 'payment_fee.term_config.fixed_amount must be >= 0';
        END IF;

        IF fee_type = 'fixed_per_order' THEN
            IF pay_fixed IS NULL THEN
                RAISE EXCEPTION 'fixed_per_order payment fee requires term_config.fixed_amount';
            END IF;
        ELSE
            IF pay_rate IS NULL THEN
                RAISE EXCEPTION 'percent-based payment fee requires term_config.rate_bp';
            END IF;
        END IF;
    END IF;

    IF g = 'shipping_responsibility' THEN
        ship := public._cc_term_config_numeric_or_null(cfg, 'estimated_merchant_outbound_shipping');
        mocc := public._cc_term_config_numeric_or_null(cfg, 'merchant_outbound_shipping_cost');
        mmsc := public._cc_term_config_numeric_or_null(cfg, 'modeled_merchant_shipping_cost');
        msce := public._cc_term_config_numeric_or_null(cfg, 'merchant_shipping_cost_estimate');

        IF ship IS NOT NULL AND ship < 0 THEN
            RAISE EXCEPTION 'estimated_merchant_outbound_shipping must be >= 0';
        END IF;
        IF mocc IS NOT NULL AND mocc < 0 THEN
            RAISE EXCEPTION 'merchant_outbound_shipping_cost must be >= 0';
        END IF;
        IF mmsc IS NOT NULL AND mmsc < 0 THEN
            RAISE EXCEPTION 'modeled_merchant_shipping_cost must be >= 0';
        END IF;
        IF msce IS NOT NULL AND msce < 0 THEN
            RAISE EXCEPTION 'merchant_shipping_cost_estimate must be >= 0';
        END IF;
    END IF;

    IF g = 'return_expiry' THEN
        rr := public._cc_term_config_numeric_or_null(cfg, 'return_reserve_rate_bp');
        res := public._cc_term_config_numeric_or_null(cfg, 'reserve_rate_bp');
        retbp := public._cc_term_config_numeric_or_null(cfg, 'return_reserve_bp');

        IF rr IS NOT NULL THEN
            IF rr <> trunc(rr) OR rr < 0 OR rr > 10000 THEN
                RAISE EXCEPTION 'return_reserve_rate_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;
        IF res IS NOT NULL THEN
            IF res <> trunc(res) OR res < 0 OR res > 10000 THEN
                RAISE EXCEPTION 'reserve_rate_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;
        IF retbp IS NOT NULL THEN
            IF retbp <> trunc(retbp) OR retbp < 0 OR retbp > 10000 THEN
                RAISE EXCEPTION 'return_reserve_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;

        IF rr IS NOT NULL AND res IS NOT NULL AND rr IS DISTINCT FROM res THEN
            RAISE EXCEPTION 'return_reserve_rate_bp and reserve_rate_bp must match when both are set';
        END IF;
        IF rr IS NOT NULL AND retbp IS NOT NULL AND rr IS DISTINCT FROM retbp THEN
            RAISE EXCEPTION 'return_reserve_rate_bp and return_reserve_bp must match when both are set';
        END IF;
        IF res IS NOT NULL AND retbp IS NOT NULL AND res IS DISTINCT FROM retbp THEN
            RAISE EXCEPTION 'reserve_rate_bp and return_reserve_bp must match when both are set';
        END IF;
    END IF;

    IF g = 'settlement' THEN
        adj := public._cc_term_config_numeric_or_null(cfg, 'settlement_adjustment_rate_bp');
        hold := public._cc_term_config_numeric_or_null(cfg, 'payout_holdback_rate_bp');

        IF adj IS NOT NULL THEN
            IF adj <> trunc(adj) OR adj < 0 OR adj > 10000 THEN
                RAISE EXCEPTION 'settlement_adjustment_rate_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;
        IF hold IS NOT NULL THEN
            IF hold <> trunc(hold) OR hold < 0 OR hold > 10000 THEN
                RAISE EXCEPTION 'payout_holdback_rate_bp must be an integer between 0 and 10000 basis points';
            END IF;
        END IF;
        IF adj IS NOT NULL AND hold IS NOT NULL AND adj IS DISTINCT FROM hold THEN
            RAISE EXCEPTION 'settlement_adjustment_rate_bp and payout_holdback_rate_bp must match when both are set';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
