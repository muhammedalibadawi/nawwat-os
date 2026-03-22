import { supabase } from '../lib/supabase';
import { getCountryPreset, type CountryPreset } from './countryConfig';

export interface TenantFinance {
    countryCode: string;
    defaultCurrency: string;
    taxRate: number;
    preset?: CountryPreset;
}

/**
 * Load tenant tax/currency; prefers default_* columns then vat_rate/currency.
 */
export async function fetchTenantFinance(tenantId: string): Promise<TenantFinance> {
    try {
        const { data, error } = await supabase
            .from('tenants')
            .select('country_code, country, currency, default_currency, default_tax_rate, vat_rate')
            .eq('id', tenantId)
            .single();
        if (error) throw error;
        const row = data as Record<string, unknown>;
        const code = String(row.country_code || row.country || 'UAE').replace(/^AE$/i, 'UAE').replace(/^SA$/i, 'KSA') || 'UAE';
        const preset = getCountryPreset(code);
        const defaultCurrency = String(row.default_currency || row.currency || preset?.currency || 'AED');
        const taxRate = Number(
            row.default_tax_rate ?? row.vat_rate ?? preset?.vatRate ?? 5
        );
        return {
            countryCode: preset?.code || (code as TenantFinance['countryCode']),
            defaultCurrency,
            taxRate: Number.isFinite(taxRate) ? taxRate : 5,
            preset: preset || getCountryPreset('UAE'),
        };
    } catch {
        return { countryCode: 'UAE', defaultCurrency: 'AED', taxRate: 5, preset: getCountryPreset('UAE') };
    }
}
