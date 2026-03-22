import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type CountryCode = 'UAE' | 'KSA' | 'BHR' | 'OMN' | 'KWT' | 'QAT' | 'EGY' | 'OTHER';
type IndustryCode =
  | 'restaurant'
  | 'retail'
  | 'services'
  | 'construction'
  | 'manufacturing'
  | 'healthcare'
  | 'education'
  | 'other';
type VatStatus = 'yes' | 'no' | 'unsure';

const COUNTRIES: { code: CountryCode; flag: string; label: string }[] = [
  { code: 'UAE', flag: '🇦🇪', label: 'الإمارات' },
  { code: 'KSA', flag: '🇸🇦', label: 'السعودية' },
  { code: 'BHR', flag: '🇧🇭', label: 'البحرين' },
  { code: 'OMN', flag: '🇴🇲', label: 'عُمان' },
  { code: 'KWT', flag: '🇰🇼', label: 'الكويت' },
  { code: 'QAT', flag: '🇶🇦', label: 'قطر' },
  { code: 'EGY', flag: '🇪🇬', label: 'مصر' },
  { code: 'OTHER', flag: '🌍', label: 'أخرى' },
];

const INDUSTRIES: { code: IndustryCode; emoji: string; label: string }[] = [
  { code: 'restaurant', emoji: '🍽️', label: 'مطعم وضيافة' },
  { code: 'retail', emoji: '🛒', label: 'تجارة تجزئة' },
  { code: 'services', emoji: '⚙️', label: 'خدمات مهنية' },
  { code: 'construction', emoji: '🏗️', label: 'مقاولات' },
  { code: 'manufacturing', emoji: '🏭', label: 'تصنيع' },
  { code: 'healthcare', emoji: '🏥', label: 'رعاية صحية' },
  { code: 'education', emoji: '📚', label: 'تعليم' },
  { code: 'other', emoji: '📋', label: 'أخرى' },
];

const TAX_BY_COUNTRY: Record<CountryCode, number> = {
  UAE: 5,
  KSA: 15,
  BHR: 10,
  OMN: 5,
  KWT: 0,
  QAT: 0,
  EGY: 14,
  OTHER: 5,
};

const CURRENCY_BY_COUNTRY: Record<CountryCode, string> = {
  UAE: 'AED',
  KSA: 'SAR',
  BHR: 'BHD',
  OMN: 'OMR',
  KWT: 'KWD',
  QAT: 'QAR',
  EGY: 'EGP',
  OTHER: 'AED',
};

function industryLabelAr(code: IndustryCode): string {
  return INDUSTRIES.find((i) => i.code === code)?.label ?? code;
}

function emailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function translateAuthError(err: { message?: string } | null): string {
  const m = (err?.message || '').toLowerCase();
  if (!m) return 'حدث خطأ غير متوقع';
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة';
  if (m.includes('invalid') && m.includes('email')) return 'صيغة البريد غير صحيحة';
  return err?.message || 'تعذر إرسال الرابط — حاول مرة أخرى';
}

function translateRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('يجب تسجيل')) return 'يجب تسجيل الدخول أولاً';
  if (m.includes('مستخدم غير موجود')) return 'مستخدم غير موجود';
  return message || 'تعذر إنشاء مساحة العمل';
}

function validateVatNumber(country: CountryCode, v: string): string | null {
  const t = v.trim();
  if (country === 'UAE') {
    if (!/^\d{15}$/.test(t)) return 'رقم ضريبي إماراتي يجب أن يكون 15 رقماً';
  } else if (country === 'KSA') {
    if (!/^3\d{13}3$/.test(t)) return 'رقم ضريبي سعودي غير صالح (15 رقماً يبدأ وينتهي بـ 3)';
  }
  return null;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshUserSession } = useAuth();

  const step = Math.min(4, Math.max(1, parseInt(searchParams.get('step') || '1', 10) || 1));

  const setStep = useCallback(
    (n: number) => {
      const s = Math.min(4, Math.max(1, n));
      setSearchParams({ step: String(s) }, { replace: true });
    },
    [setSearchParams]
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Success, setStep1Success] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState<CountryCode>('UAE');
  const [industry, setIndustry] = useState<IndustryCode>('retail');

  const [employeeCount, setEmployeeCount] = useState('1-5');
  const [branchCount, setBranchCount] = useState('1');
  const [vatStatus, setVatStatus] = useState<VatStatus>('no');
  const [vatNumber, setVatNumber] = useState('');

  /** خطوة 3 — إنشاء المستأجر */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step2Checked, setStep2Checked] = useState(false);

  useEffect(() => {
    if (step !== 2) {
      setStep2Checked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate('/register?step=1', { replace: true });
        return;
      }
      setStep2Checked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, navigate]);

  const onStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    if (!fullName.trim()) {
      setStep1Error('الاسم الكامل مطلوب');
      return;
    }
    if (!email.trim() || !emailValid(email)) {
      setStep1Error('أدخل بريداً إلكترونياً صحيحاً');
      return;
    }
    setStep1Loading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/register?step=2`,
          data: { full_name: fullName.trim() },
        },
      });
      if (error) {
        setStep1Error(translateAuthError(error));
        return;
      }
      setStep1Success(true);
    } finally {
      setStep1Loading(false);
    }
  };

  const onStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      return;
    }
    setStep(3);
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (vatStatus === 'yes') {
      const err = validateVatNumber(country, vatNumber);
      if (err) {
        setError(err);
        return;
      }
    }

    setLoading(true);
    try {
      const numBranch = Number(branchCount);
      const p_branch_count = Number.isFinite(numBranch) && numBranch > 0 ? numBranch : branchCount || '1';

      const { data: result, error: rpcError } = await supabase.rpc('create_nawwat_tenant', {
        p_display_name: companyName.trim(),
        p_country_code: country || 'UAE',
        p_industry: industry || 'retail',
        // الـ RPC يتوقع نصاً يُقارَن بـ 'yes' في SQL
        p_vat_registered: vatStatus === 'yes' ? 'yes' : 'no',
        p_vat_number: vatStatus === 'yes' ? vatNumber.trim() || null : null,
        p_employee_count: employeeCount || '1-5',
        p_branch_count: p_branch_count,
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        setError('حدث خطأ: ' + translateRpcError(rpcError.message));
        setLoading(false);
        return;
      }

      if (result == null) {
        setError('لم يتم إنشاء مساحة العمل — حاول مرة أخرى');
        setLoading(false);
        return;
      }

      const r = result as { tenant_id?: string } | string;
      const tenantId =
        typeof r === 'object' && r !== null && 'tenant_id' in r && r.tenant_id
          ? String(r.tenant_id)
          : typeof r === 'string'
            ? r
            : null;

      if (!tenantId) {
        setError('لم يتم إنشاء مساحة العمل — حاول مرة أخرى');
        setLoading(false);
        return;
      }

      localStorage.setItem('nawwat_tenant_id', tenantId);

      await refreshUserSession();

      setStep(4);
      setLoading(false);
    } catch (unknownErr: unknown) {
      console.error('handleStep3:', unknownErr);
      const msg = unknownErr instanceof Error ? unknownErr.message : String(unknownErr);
      setError('حدث خطأ: ' + msg);
      setLoading(false);
    }
  };

  const sectorLine = useMemo(() => {
    return `دليل حسابات جاهز لـ ${industryLabelAr(industry)}`;
  }, [industry]);

  const taxLine = useMemo(() => {
    const pct = TAX_BY_COUNTRY[country];
    const label = COUNTRIES.find((c) => c.code === country)?.label ?? '';
    return `ضريبة ${pct}% (${label})`;
  }, [country]);

  const currencyLine = useMemo(() => {
    return `عملة ${CURRENCY_BY_COUNTRY[country]} افتراضية`;
  }, [country]);

  const progressNodes = [1, 2, 3, 4];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#071C3B] font-arabic text-white flex flex-col items-center px-4 py-8"
    >
      <div className="w-full max-w-[480px] flex flex-col gap-6 transition-opacity duration-300">
        {/* Progress */}
        <div className="flex items-center w-full px-1">
          {progressNodes.map((n, idx) => (
            <React.Fragment key={n}>
              <div
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold transition-colors ${
                  n < step
                    ? 'bg-emerald-500 text-white'
                    : n === step
                      ? 'bg-[#00CFFF] text-[#071C3B] shadow-[0_0_16px_rgba(0,207,255,0.45)]'
                      : 'bg-white/15 text-white/50'
                }`}
              >
                {n < step ? '✓' : n}
              </div>
              {idx < progressNodes.length - 1 && (
                <div
                  className={`flex-1 min-w-[8px] h-0.5 mx-1 rounded ${
                    n < step ? 'bg-emerald-500' : 'bg-white/15'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          key={step}
          className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-6 shadow-xl transition-all duration-300"
        >
          {step === 1 && (
            <form onSubmit={onStep1Submit} className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-white mb-1">ابدأ تجربتك المجانية</h1>
                <p className="text-sm text-white/65">14 يوم مجاناً — بدون بطاقة ائتمان</p>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-white/80">الاسم الكامل</span>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl bg-[#071C3B]/80 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-[#00CFFF]/80 focus:ring-1 focus:ring-[#00CFFF]/40"
                  placeholder="مثال: أحمد محمد"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-white/80">البريد الإلكتروني</span>
                <input
                  required
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl bg-[#071C3B]/80 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-[#00CFFF]/80 focus:ring-1 focus:ring-[#00CFFF]/40 text-left"
                  placeholder="you@company.com"
                />
              </label>

              {step1Error && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">{step1Error}</p>
              )}

              {step1Success && (
                <div className="text-sm text-[#00CFFF] bg-[#00CFFF]/10 border border-[#00CFFF]/30 rounded-lg px-3 py-3 space-y-1">
                  <p>✉️ تم إرسال رابط التأكيد — تحقق من بريدك</p>
                  <p className="text-white/70 text-xs">الرابط صالح لمدة 60 دقيقة</p>
                </div>
              )}

              <button
                type="submit"
                disabled={step1Loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#00CFFF] text-[#071C3B] font-extrabold py-3 text-sm hover:brightness-110 disabled:opacity-60"
              >
                {step1Loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                متابعة →
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-center text-sm text-white/60 hover:text-[#00CFFF] underline-offset-2 hover:underline"
              >
                عندك حساب؟ تسجيل دخول
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={onStep2Next} className="flex flex-col gap-4">
              {!step2Checked ? (
                <div className="flex items-center justify-center py-12 gap-2 text-white/70">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00CFFF]" />
                  جاري التحقق من الجلسة...
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-extrabold">أخبرنا عن شركتك</h1>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-white/80">اسم الشركة</span>
                    <input
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="rounded-xl bg-[#071C3B]/80 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-[#00CFFF]/80"
                      placeholder="اسم النشاط التجاري"
                    />
                  </label>

                  <div>
                    <span className="text-xs font-bold text-white/80 block mb-2">الدولة</span>
                    <div className="grid grid-cols-2 gap-2">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setCountry(c.code)}
                          className={`rounded-xl border px-2 py-2.5 text-right text-sm font-semibold transition-all ${
                            country === c.code
                              ? 'border-[#00CFFF] bg-[#00CFFF]/15 text-[#00CFFF]'
                              : 'border-white/15 bg-[#071C3B]/50 text-white/85 hover:border-white/30'
                          }`}
                        >
                          <span className="me-1">{c.flag}</span>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-white/80 block mb-2">القطاع</span>
                    <div className="grid grid-cols-2 gap-2">
                      {INDUSTRIES.map((ind) => (
                        <button
                          key={ind.code}
                          type="button"
                          onClick={() => setIndustry(ind.code)}
                          className={`rounded-xl border px-2 py-2.5 text-right text-sm font-semibold transition-all ${
                            industry === ind.code
                              ? 'border-[#00CFFF] bg-[#00CFFF]/15 text-[#00CFFF]'
                              : 'border-white/15 bg-[#071C3B]/50 text-white/85 hover:border-white/30'
                          }`}
                        >
                          <span className="me-1">{ind.emoji}</span>
                          {ind.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#00CFFF] text-[#071C3B] font-extrabold py-3 text-sm hover:brightness-110"
                  >
                    التالي →
                  </button>
                </>
              )}
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleStep3} className="flex flex-col gap-4">
              <h1 className="text-xl font-extrabold">إعداد {companyName || 'شركتك'}</h1>

              <div className="rounded-xl bg-[#00CFFF]/12 border border-[#00CFFF]/35 p-4 text-sm space-y-2 text-white/95">
                <p>✓ {sectorLine}</p>
                <p>✓ {taxLine} مُعدّة</p>
                <p>✓ {currencyLine}</p>
                <p>✓ الفرع الرئيسي</p>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-white/80">عدد الموظفين</span>
                <select
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  className="rounded-xl bg-[#071C3B]/80 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-[#00CFFF]/80"
                >
                  <option value="1-5">1–5</option>
                  <option value="6-20">6–20</option>
                  <option value="21-100">21–100</option>
                  <option value="+100">+100</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-white/80">عدد الفروع</span>
                <select
                  value={branchCount}
                  onChange={(e) => setBranchCount(e.target.value)}
                  className="rounded-xl bg-[#071C3B]/80 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-[#00CFFF]/80"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4-10">4–10</option>
                  <option value="+10">+10</option>
                </select>
              </label>

              <div>
                <p className="text-xs font-bold text-white/80 mb-2">هل أنت مسجل في ضريبة القيمة المضافة؟</p>
                <div className="flex flex-wrap gap-2">
                  {(['yes', 'no', 'unsure'] as VatStatus[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVatStatus(v)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${
                        vatStatus === v
                          ? 'bg-[#00CFFF] text-[#071C3B]'
                          : 'bg-white/10 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      {v === 'yes' ? 'نعم' : v === 'no' ? 'لا' : 'لست متأكداً'}
                    </button>
                  ))}
                </div>
              </div>

              {vatStatus === 'yes' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-white/80">الرقم الضريبي</span>
                  <input
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    dir="ltr"
                    className="rounded-xl bg-[#071C3B]/80 border border-white/15 px-3 py-2.5 text-sm outline-none focus:border-[#00CFFF]/80 text-left"
                    placeholder={country === 'UAE' ? '15 رقماً' : country === 'KSA' ? '15 رقماً' : 'أدخل الرقم'}
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#00CFFF] text-[#071C3B] font-extrabold py-3 text-sm hover:brightness-110 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                إنشاء مساحة العمل →
              </button>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-400 bg-red-950/50 border border-red-500/50 rounded-lg px-3 py-2 mt-1"
                >
                  {error}
                </p>
              )}
            </form>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center text-center gap-5 py-2">
              <div className="text-5xl">🎉</div>
              <h1 className="text-xl font-extrabold leading-relaxed">
                {companyName || 'شركتك'} جاهزة على NawwatOS!
              </h1>
              <p className="text-white/75 text-sm">اختر من أين تبدأ:</p>

              <div className="w-full flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/inventory')}
                  className="w-full rounded-2xl border border-[#00CFFF]/40 bg-[#071C3B] hover:bg-[#00CFFF]/10 px-4 py-4 text-right transition-colors"
                >
                  <span className="text-2xl me-2">📦</span>
                  <span className="font-extrabold text-[#00CFFF]">أضف أول منتج</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/invoices')}
                  className="w-full rounded-2xl border border-[#00CFFF]/40 bg-[#071C3B] hover:bg-[#00CFFF]/10 px-4 py-4 text-right transition-colors"
                >
                  <span className="text-2xl me-2">📄</span>
                  <span className="font-extrabold text-[#00CFFF]">أنشئ أول فاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/pos')}
                  className="w-full rounded-2xl border border-[#00CFFF]/40 bg-[#071C3B] hover:bg-[#00CFFF]/10 px-4 py-4 text-right transition-colors"
                >
                  <span className="text-2xl me-2">🛒</span>
                  <span className="font-extrabold text-[#00CFFF]">ابدأ من نقطة البيع</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-xs text-white/45 hover:text-white/70 underline-offset-2 hover:underline mt-2"
              >
                تخطي — اذهب للوحة التحكم
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
