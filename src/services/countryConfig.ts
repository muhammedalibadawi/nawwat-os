/** Gulf & Egypt country presets for NawwatOS */

export type CountryCode = 'UAE' | 'KSA' | 'BHR' | 'OMN' | 'KWT' | 'QAT' | 'EGY';

export interface CountryPreset {
    code: CountryCode;
    labelAr: string;
    labelEn: string;
    vatRate: number;
    currency: string;
    zatcaRequired: boolean;
    wpsRequired: boolean;
    flag: string;
}

export const COUNTRY_PRESETS: CountryPreset[] = [
    { code: 'UAE', labelAr: 'الإمارات', labelEn: 'UAE', vatRate: 5, currency: 'AED', zatcaRequired: false, wpsRequired: true, flag: '🇦🇪' },
    { code: 'KSA', labelAr: 'السعودية', labelEn: 'KSA', vatRate: 15, currency: 'SAR', zatcaRequired: true, wpsRequired: true, flag: '🇸🇦' },
    { code: 'BHR', labelAr: 'البحرين', labelEn: 'Bahrain', vatRate: 10, currency: 'BHD', zatcaRequired: false, wpsRequired: false, flag: '🇧🇭' },
    { code: 'OMN', labelAr: 'عُمان', labelEn: 'Oman', vatRate: 5, currency: 'OMR', zatcaRequired: false, wpsRequired: false, flag: '🇴🇲' },
    { code: 'KWT', labelAr: 'الكويت', labelEn: 'Kuwait', vatRate: 0, currency: 'KWD', zatcaRequired: false, wpsRequired: false, flag: '🇰🇼' },
    { code: 'QAT', labelAr: 'قطر', labelEn: 'Qatar', vatRate: 0, currency: 'QAR', zatcaRequired: false, wpsRequired: false, flag: '🇶🇦' },
    { code: 'EGY', labelAr: 'مصر', labelEn: 'Egypt', vatRate: 14, currency: 'EGP', zatcaRequired: false, wpsRequired: false, flag: '🇪🇬' },
];

export function getCountryPreset(code: string | null | undefined): CountryPreset | undefined {
    return COUNTRY_PRESETS.find((c) => c.code === code);
}

export function zatcaBadgeText(preset: CountryPreset | undefined): string {
    if (!preset) return 'ZATCA: —';
    return preset.zatcaRequired ? 'ZATCA: إلزامي' : 'ZATCA: غير مطلوب';
}

export function wpsBadgeText(preset: CountryPreset | undefined): string {
    if (!preset) return 'WPS: —';
    if (preset.code === 'UAE') return 'UAE WPS: إلزامي';
    if (preset.wpsRequired && preset.code === 'KSA') return 'KSA WPS: إلزامي';
    return 'WPS: حسب النظام';
}
