-- Backfill legacy preview aliases to canonical term_config keys.
-- Scope: commercial_contract_version_terms only (no product-surface changes).
BEGIN;

DO $$
DECLARE
    scanned_count INTEGER := 0;
    updated_return_count INTEGER := 0;
    updated_settlement_count INTEGER := 0;
    updated_total_count INTEGER := 0;
    remaining_alias_count INTEGER := 0;
    ambiguous_count INTEGER := 0;
BEGIN
    SELECT COUNT(*)
    INTO scanned_count
    FROM public.commercial_contract_version_terms t
    WHERE t.term_config IS NOT NULL
      AND jsonb_typeof(t.term_config) = 'object'
      AND (
        t.term_config ? 'reserve_rate_bp'
        OR t.term_config ? 'return_reserve_bp'
        OR t.term_config ? 'payout_holdback_rate_bp'
      );

    -- Ambiguous means canonical + alias are both present but values differ.
    SELECT COUNT(*)
    INTO ambiguous_count
    FROM public.commercial_contract_version_terms t
    WHERE t.term_config IS NOT NULL
      AND jsonb_typeof(t.term_config) = 'object'
      AND (
        (
          t.term_group = 'return_expiry'
          AND t.term_config ? 'return_reserve_rate_bp'
          AND (
            (t.term_config ? 'reserve_rate_bp' AND t.term_config->'return_reserve_rate_bp' IS DISTINCT FROM t.term_config->'reserve_rate_bp')
            OR (t.term_config ? 'return_reserve_bp' AND t.term_config->'return_reserve_rate_bp' IS DISTINCT FROM t.term_config->'return_reserve_bp')
          )
        )
        OR (
          t.term_group = 'settlement'
          AND t.term_config ? 'settlement_adjustment_rate_bp'
          AND t.term_config ? 'payout_holdback_rate_bp'
          AND t.term_config->'settlement_adjustment_rate_bp' IS DISTINCT FROM t.term_config->'payout_holdback_rate_bp'
        )
      );

    -- return_expiry: canonicalize to return_reserve_rate_bp, then remove aliases.
    UPDATE public.commercial_contract_version_terms t
    SET term_config =
      (
        (t.term_config || jsonb_build_object(
          'return_reserve_rate_bp',
          COALESCE(
            t.term_config->'return_reserve_rate_bp',
            t.term_config->'reserve_rate_bp',
            t.term_config->'return_reserve_bp'
          )
        ))
        - 'reserve_rate_bp'
        - 'return_reserve_bp'
      )
    WHERE t.term_group = 'return_expiry'
      AND t.term_config IS NOT NULL
      AND jsonb_typeof(t.term_config) = 'object'
      AND (t.term_config ? 'reserve_rate_bp' OR t.term_config ? 'return_reserve_bp');

    GET DIAGNOSTICS updated_return_count = ROW_COUNT;

    -- settlement: canonicalize to settlement_adjustment_rate_bp, then remove alias.
    UPDATE public.commercial_contract_version_terms t
    SET term_config =
      (
        (t.term_config || jsonb_build_object(
          'settlement_adjustment_rate_bp',
          COALESCE(
            t.term_config->'settlement_adjustment_rate_bp',
            t.term_config->'payout_holdback_rate_bp'
          )
        ))
        - 'payout_holdback_rate_bp'
      )
    WHERE t.term_group = 'settlement'
      AND t.term_config IS NOT NULL
      AND jsonb_typeof(t.term_config) = 'object'
      AND t.term_config ? 'payout_holdback_rate_bp';

    GET DIAGNOSTICS updated_settlement_count = ROW_COUNT;
    updated_total_count := updated_return_count + updated_settlement_count;

    SELECT COUNT(*)
    INTO remaining_alias_count
    FROM public.commercial_contract_version_terms t
    WHERE t.term_config IS NOT NULL
      AND jsonb_typeof(t.term_config) = 'object'
      AND (
        t.term_config ? 'reserve_rate_bp'
        OR t.term_config ? 'return_reserve_bp'
        OR t.term_config ? 'payout_holdback_rate_bp'
      );

    RAISE NOTICE 'contract term_config alias backfill report: scanned=% updated=% (return=% settlement=%) remaining_aliases=% ambiguous=%',
      scanned_count,
      updated_total_count,
      updated_return_count,
      updated_settlement_count,
      remaining_alias_count,
      ambiguous_count;
END
$$;

COMMIT;
