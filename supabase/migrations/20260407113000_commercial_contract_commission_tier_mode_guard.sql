-- Minimal guardrail for commission tier_mode flag values.
BEGIN;

CREATE OR REPLACE FUNCTION public.trg_validate_commission_tier_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tier_mode TEXT;
BEGIN
    IF NEW.term_group <> 'commission' OR NEW.term_config IS NULL OR jsonb_typeof(NEW.term_config) <> 'object' THEN
        RETURN NEW;
    END IF;

    IF NEW.term_config ? 'tier_mode' THEN
        v_tier_mode := NULLIF(trim(NEW.term_config->>'tier_mode'), '');
        IF v_tier_mode IS NULL OR v_tier_mode NOT IN ('single_band', 'progressive') THEN
            RAISE EXCEPTION 'commission.term_config.tier_mode must be one of single_band, progressive';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_contract_version_terms_commission_tier_mode
    ON public.commercial_contract_version_terms;

CREATE TRIGGER trg_commercial_contract_version_terms_commission_tier_mode
    BEFORE INSERT OR UPDATE OF term_group, term_config
    ON public.commercial_contract_version_terms
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_validate_commission_tier_mode();

COMMIT;
