-- Bounds + alias consistency for pricing-preview fields on commercial_contract_version_terms.term_config.
-- Normalization is done in the app; this trigger blocks invalid JSONB inserts/updates at the DB edge.
BEGIN;

CREATE OR REPLACE FUNCTION public._cc_term_config_numeric_or_null(p_cfg jsonb, p_key text)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    el jsonb;
    typ TEXT;
    s TEXT;
BEGIN
    IF p_cfg IS NULL OR NOT (p_cfg ? p_key) THEN
        RETURN NULL;
    END IF;

    el := p_cfg->p_key;
    IF el IS NULL OR jsonb_typeof(el) = 'null' THEN
        RETURN NULL;
    END IF;

    typ := jsonb_typeof(el);
    IF typ = 'number' THEN
        RETURN (el #>> '{}')::NUMERIC;
    END IF;

    IF typ = 'string' THEN
        s := trim(el #>> '{}');
        IF s = '' OR s IS NULL THEN
            RETURN NULL;
        END IF;
        RETURN s::NUMERIC;
    END IF;

    RAISE EXCEPTION 'term_config.% must be numeric or numeric string', p_key;
END;
$$;

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
BEGIN
    cfg := NEW.term_config;
    g := NEW.term_group;

    IF cfg IS NULL OR jsonb_typeof(cfg) <> 'object' THEN
        RETURN NEW;
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

DROP TRIGGER IF EXISTS trg_commercial_contract_version_terms_preview_config_bounds
    ON public.commercial_contract_version_terms;

CREATE TRIGGER trg_commercial_contract_version_terms_preview_config_bounds
    BEFORE INSERT OR UPDATE OF term_config, term_group
    ON public.commercial_contract_version_terms
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_validate_commercial_contract_version_terms_preview_config();

COMMIT;
