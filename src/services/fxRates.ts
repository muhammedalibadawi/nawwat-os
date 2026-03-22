import { supabase } from '../lib/supabase';

/** Fallback display rates (when DB has no row). */
export const STATIC_FX: Record<string, number> = {
    'USD:AED': 3.6725,
    'USD:SAR': 3.75,
    'EUR:AED': 4.02,
    'GBP:AED': 4.65,
};

/**
 * Latest rate from_currency → to_currency for tenant (most recent rate_date).
 */
export async function fetchLatestFxRate(tenantId: string, from: string, to: string): Promise<number> {
    try {
        if (!from || !to || from === to) return 1;
        const key = `${from}:${to}`;
        if (STATIC_FX[key] != null) return STATIC_FX[key];
        const { data, error } = await supabase
            .from('fx_rates')
            .select('rate')
            .eq('tenant_id', tenantId)
            .eq('from_currency', from)
            .eq('to_currency', to)
            .order('rate_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (data?.rate != null) return Number(data.rate);
        const invKey = `${to}:${from}`;
        if (STATIC_FX[invKey] != null) return 1 / STATIC_FX[invKey];
        return 1;
    } catch {
        const key = `${from}:${to}`;
        return STATIC_FX[key] ?? 1;
    }
}
