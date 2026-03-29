import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COUNTRY_PRESETS, getCountryPreset } from '../services/countryConfig';

const STEP_TO_STATE: Record<number, string> = {
  1: 'company_profile',
  2: 'tax_config',
  3: 'inventory_setup',
  4: 'team_setup',
  5: 'review',
};

const STATE_TO_STEP: Record<string, number> = {
  company_profile: 1,
  tax_config: 2,
  inventory_setup: 3,
  team_setup: 4,
  review: 5,
  completed: 5,
};

type TenantSetupRow = {
  setup_state?: string | null;
  onboarded_at?: string | null;
};

export default function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>({
    companyName: '',
    sector: 'متجر',
    country: 'UAE',
    currency: 'AED',
    vat: 5,
    firstItemName: '',
    firstItemPrice: '',
    firstItemQty: '',
    firstEmployeeName: '',
    firstEmployeeEmail: '',
    firstEmployeeRole: '',
  });

  const progress = useMemo(() => (step / 5) * 100, [step]);

  useEffect(() => {
    let cancelled = false;

    const loadTenantSetup = async () => {
      if (!user?.tenant_id) {
        if (!cancelled) setLoadingState(false);
        return;
      }

      setLoadingState(true);
      setError('');
      try {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('setup_state, onboarded_at')
          .eq('id', user.tenant_id)
          .single();

        if (tenantError) throw tenantError;
        if (cancelled) return;

        const tenantRow = (tenant ?? null) as TenantSetupRow | null;
        const isCompleted = Boolean(tenantRow?.onboarded_at) || tenantRow?.setup_state === 'completed';
        if (isCompleted) {
          localStorage.setItem('nawwat_onboarding_done', 'true');
          onDone();
          return;
        }

        const nextStep = STATE_TO_STEP[tenantRow?.setup_state || 'company_profile'] || 1;
        setStep(nextStep);
        localStorage.setItem('nawwat_onboarding_done', 'false');
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message ?? 'تعذر تحميل حالة الإعداد');
          setStep(1);
        }
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    };

    void loadTenantSetup();

    return () => {
      cancelled = true;
    };
  }, [onDone, user?.tenant_id]);

  const updateTenantSetup = async (payload: Record<string, unknown>) => {
    if (!user?.tenant_id) throw new Error('Tenant context is missing');

    const { error: updateError } = await supabase
      .from('tenants')
      .update(payload)
      .eq('id', user.tenant_id);

    if (updateError) throw updateError;
  };

  const next = async () => {
    if (!user?.tenant_id || loadingState) return;

    setSaving(true);
    setError('');

    try {
      if (step === 1) {
        const preset = getCountryPreset(data.country) || getCountryPreset('UAE');
        await updateTenantSetup({
          name: data.companyName || undefined,
          country: preset?.code || data.country,
          country_code: preset?.code || 'UAE',
          currency: preset?.currency || data.currency,
          default_currency: preset?.currency || data.currency,
          default_tax_rate: preset?.vatRate ?? Number(data.vat || 0),
          vat_rate: preset?.vatRate ?? Number(data.vat || 0),
          setup_state: STEP_TO_STATE[2],
        });
      }

      if (step === 2) {
        await updateTenantSetup({
          vat_rate: Number(data.vat || 0),
          default_tax_rate: Number(data.vat || 0),
          setup_state: STEP_TO_STATE[3],
        });
      }

      if (step === 3) {
        if (data.firstItemName) {
          const { error: itemError } = await supabase.from('items').insert({
            tenant_id: user.tenant_id,
            name: data.firstItemName,
            selling_price: Number(data.firstItemPrice || 0),
            is_active: true,
          });
          if (itemError) throw itemError;
        }

        await updateTenantSetup({
          setup_state: STEP_TO_STATE[4],
        });
      }

      if (step === 4) {
        if (data.firstEmployeeName && data.firstEmployeeEmail) {
          const { data: createdUser, error: userError } = await supabase
            .from('users')
            .insert({
              tenant_id: user.tenant_id,
              full_name: data.firstEmployeeName,
              email: data.firstEmployeeEmail,
              is_active: true,
            })
            .select('id')
            .single();

          if (userError) throw userError;

          if (createdUser?.id && data.firstEmployeeRole) {
            const { error: roleError } = await supabase.from('user_roles').insert({
              tenant_id: user.tenant_id,
              user_id: createdUser.id,
              role_id: data.firstEmployeeRole,
            });
            if (roleError) throw roleError;
          }
        }

        await updateTenantSetup({
          setup_state: STEP_TO_STATE[5],
        });
      }

      if (step < 5) {
        setStep((current) => current + 1);
      }
    } catch (saveError: any) {
      setError(saveError?.message ?? 'تعذر حفظ هذه الخطوة');
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    if (!user?.tenant_id) return;

    setSaving(true);
    setError('');
    try {
      await updateTenantSetup({
        setup_state: 'completed',
        onboarded_at: new Date().toISOString(),
      });

      localStorage.setItem('nawwat_onboarding_done', 'true');
      onDone();
    } catch (finishError: any) {
      setError(finishError?.message ?? 'تعذر إكمال الإعداد');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#071C3B] text-white p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="h-2 bg-white/20 rounded mb-6">
          <div className="h-2 bg-[#00CFFF] rounded" style={{ width: `${progress}%` }} />
        </div>

        {loadingState ? (
          <div className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="animate-spin text-[#00CFFF]" size={36} />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black">مرحباً بك في NawwatOS!</h2>
                <input className="w-full px-3 py-2 rounded text-black" placeholder="اسم الشركة" value={data.companyName} onChange={(e) => setData({ ...data, companyName: e.target.value })} />
                <select className="w-full px-3 py-2 rounded text-black" value={data.sector} onChange={(e) => setData({ ...data, sector: e.target.value })}><option>مطعم</option><option>متجر</option><option>خدمات</option><option>استيراد</option><option>عقارات</option><option>أخرى</option></select>
                <label className="text-sm font-bold text-white/80">الدولة</label>
                <select
                  className="w-full px-3 py-2 rounded text-black"
                  value={data.country}
                  onChange={(e) => {
                    const preset = getCountryPreset(e.target.value);
                    setData({
                      ...data,
                      country: e.target.value,
                      currency: preset?.currency || 'AED',
                      vat: preset?.vatRate ?? 5,
                    });
                  }}
                >
                  {COUNTRY_PRESETS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code} | {country.labelAr}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-white/60">العملة</span>
                    <input className="w-full px-3 py-2 rounded text-black bg-white/90" readOnly value={getCountryPreset(data.country)?.currency || 'AED'} />
                  </div>
                  <div>
                    <span className="text-xs text-white/60">ضريبة افتراضية %</span>
                    <input className="w-full px-3 py-2 rounded text-black" type="number" value={data.vat} onChange={(e) => setData({ ...data, vat: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black">إعداد الضريبة</h2>
                <input type="number" className="w-full px-3 py-2 rounded text-black" value={data.vat} onChange={(e) => setData({ ...data, vat: Number(e.target.value) })} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black">أضف أول منتج</h2>
                <input className="w-full px-3 py-2 rounded text-black" placeholder="الاسم" value={data.firstItemName} onChange={(e) => setData({ ...data, firstItemName: e.target.value })} />
                <input type="number" className="w-full px-3 py-2 rounded text-black" placeholder="السعر" value={data.firstItemPrice} onChange={(e) => setData({ ...data, firstItemPrice: e.target.value })} />
                <input type="number" className="w-full px-3 py-2 rounded text-black" placeholder="الكمية" value={data.firstItemQty} onChange={(e) => setData({ ...data, firstItemQty: e.target.value })} />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black">أضف أول موظف</h2>
                <input className="w-full px-3 py-2 rounded text-black" placeholder="الاسم" value={data.firstEmployeeName} onChange={(e) => setData({ ...data, firstEmployeeName: e.target.value })} />
                <input className="w-full px-3 py-2 rounded text-black" placeholder="الإيميل" value={data.firstEmployeeEmail} onChange={(e) => setData({ ...data, firstEmployeeEmail: e.target.value })} />
                <input className="w-full px-3 py-2 rounded text-black" placeholder="role_id" value={data.firstEmployeeRole} onChange={(e) => setData({ ...data, firstEmployeeRole: e.target.value })} />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <h2 className="text-2xl font-black">أنت جاهز!</h2>
                <p>Ctrl+K للبحث الشامل • /pos • /invoices</p>
                <button
                  onClick={() => void finish()}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-[#00CFFF] text-[#071C3B] font-black disabled:opacity-60"
                >
                  {saving ? 'جاري الإكمال...' : 'ابدأ الاستخدام'}
                </button>
              </div>
            )}

            {step < 5 && (
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={saving}
                  className="px-4 py-2 rounded border border-white/30 disabled:opacity-60"
                >
                  رجوع
                </button>
                <button
                  onClick={() => void next()}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-[#00CFFF] text-[#071C3B] font-black disabled:opacity-60 flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'جاري الحفظ...' : 'التالي'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
