import { useState, useMemo } from 'react';
import { useRegister } from '../../hooks/useRegister';
import { Link } from 'react-router-dom';
import { Building2, User, Lock, CreditCard, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const SECTORS = [
  'Retail', 'F&B', 'Real Estate', 'Manufacturing', 
  'Healthcare', 'Government', 'Financial Services'
];

export default function RegisterWizard() {
  const { registerCompany, loading, error: serverError, setError: setServerError } = useRegister();
  
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    company_name: '',
    company_name_ar: '',
    business_sector: 'Retail',
    country: 'UAE',
    city: '',
    website: '',
    
    full_name: '',
    full_name_ar: '',
    email: '',
    phone: '',
    job_title: '',
    
    password: '',
    confirm_password: '',
    terms: false,
  });

  const [plan, setPlan] = useState('Starter');

  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError('');
    setServerError(null);
  };

  const validateStep1 = () => {
    if (!formData.company_name.trim()) return "اسم الشركة مطلوب";
    if (!formData.country) return "يجب اختيار الدولة";
    return null;
  };

  const validateStep2 = () => {
    if (!formData.full_name.trim()) return "الاسم الكامل مطلوب";
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(formData.email)) return "البريد الإلكتروني غير صحيح";
    
    const cleanPhone = formData.phone.trim();
    if (!cleanPhone.startsWith('+971') && !cleanPhone.startsWith('+966')) {
      return "رقم الهاتف يجب أن يبدأ بـ +971 أو +966";
    }
    return null;
  };

  const validateStep3 = () => {
    if (formData.password.length < 8) return "كلمة السر يجب أن تكون 8 أحرف على الأقل";
    if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      return "كلمة السر يجب أن تحتوي على حرف كبير ورقم واحد على الأقل";
    }
    if (formData.password !== formData.confirm_password) return "كلمتا السر غير متطابقتان";
    if (!formData.terms) return "يجب الموافقة على الشروط والأحكام";
    return null;
  };

  const nextStep = () => {
    let err = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();

    if (err) {
      setValidationError(err);
      return;
    }
    setStep(s => Math.min(5, s + 1));
  };

  const prevStep = () => {
    setStep(s => Math.max(1, s - 1));
    setValidationError('');
    setServerError(null);
  };

  const submitForm = async () => {
    await registerCompany(formData, plan);
  };

  // UI Components
  const Input = ({ label, type = "text", field, placeholder, customProps = {} }: any) => (
    <div className="mb-4 text-right">
      <label className="block text-sm font-semibold text-gray-300 mb-2">{label}</label>
      <input
        type={type}
        dir={type === 'email' || type === 'password' || type === 'tel' ? 'ltr' : 'rtl'}
        className="w-full bg-[#161b22] border border-[#30363d] focus:border-blue-500 rounded-lg px-4 py-3 text-white outline-none transition-colors"
        placeholder={placeholder}
        value={(formData as any)[field]}
        onChange={e => updateForm(field, e.target.value)}
        {...customProps}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0e1117] text-white flex flex-col font-sans" dir="rtl">
      
      {/* Navbar Logo */}
      <div className="w-full p-6 border-b border-[#30363d] flex justify-center lg:justify-start">
         <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-white to-gray-400 tracking-wider">
           nawwat
         </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-[#0e1117] lg:bg-[#161b22] lg:border border-[#30363d] lg:shadow-2xl rounded-2xl p-6 lg:p-10">
          
          {/* Progress Bar */}
          <div className="flex justify-between items-center mb-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#30363d] -z-10 rounded-full"></div>
            <div 
              className="absolute top-1/2 right-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500" 
              style={{ width: `${((step - 1) / 4) * 100}%` }}
            ></div>
            
            {[1, 2, 3, 4, 5].map((p) => (
              <div
                key={p}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                  step >= p
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                    : 'bg-[#161b22] text-gray-500 border-2 border-[#30363d]'
                }`}
              >
                {step > p ? <CheckCircle2 size={18} /> : p}
              </div>
            ))}
          </div>

          <div className="mb-8 text-center animate-fade-in">
            <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">
              {step === 1 && "بيانات الشركة المؤسسة"}
              {step === 2 && "بيانات المسؤول الأول"}
              {step === 3 && "تأمين الحساب"}
              {step === 4 && "اختيار باقة الاشتراك"}
              {step === 5 && "المراجعة والتأكيد"}
            </h2>
            <p className="text-[#8b949e]">الخطوة {step} من 5</p>
          </div>

          {/* Error Banner */}
          {(validationError || serverError) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 flex items-center gap-3 animate-fade-in">
              <AlertCircle size={20} />
              <span className="font-semibold">{validationError || serverError}</span>
            </div>
          )}

          {/* Form Content */}
          <div className="min-h-[300px] animate-fade-in">
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="اسم الشركة (إنجليزي) *" field="company_name" placeholder="Acme Corp" />
                <Input label="اسم الشركة (عربي)" field="company_name_ar" placeholder="شركة أكِمي" />
                
                <div className="mb-4 text-right">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">قطاع الأعمال</label>
                  <select 
                    className="w-full bg-[#161b22] border border-[#30363d] focus:border-blue-500 rounded-lg px-4 py-3 text-white outline-none"
                    value={formData.business_sector}
                    onChange={e => updateForm('business_sector', e.target.value)}
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <Input label="المدينة *" field="city" placeholder="دبي، الرياض..." />
                
                <div className="mb-4 text-right">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">الدولة</label>
                  <select 
                    className="w-full bg-[#161b22] border border-[#30363d] focus:border-blue-500 rounded-lg px-4 py-3 text-white outline-none"
                    value={formData.country}
                    onChange={e => updateForm('country', e.target.value)}
                  >
                    <option value="UAE">الإمارات العربية المتحدة</option>
                    <option value="SA">المملكة العربية السعودية</option>
                  </select>
                </div>

                <Input label="الموقع الإلكتروني (اختياري)" field="website" placeholder="https://..." type="url" />
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="الاسم الكامل (إنجليزي) *" field="full_name" placeholder="John Doe" />
                <Input label="الاسم الكامل (عربي)" field="full_name_ar" placeholder="جون دو" />
                <Input label="البريد الإلكتروني للعمل *" field="email" type="email" placeholder="you@company.com" />
                <Input label="رقم الجوال *" field="phone" type="tel" placeholder="+971..." />
                <Input label="المسمى الوظيفي" field="job_title" placeholder="المدير العام، المؤسس..." />
              </div>
            )}

            {step === 3 && (
              <div className="max-w-md mx-auto">
                <div className="mb-4 text-right relative">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">كلمة السر *</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    className="w-full bg-[#161b22] border border-[#30363d] focus:border-blue-500 rounded-lg px-4 py-3 pb-3 text-white outline-none"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => updateForm('password', e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-10 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <Input label="تأكيد كلمة السر *" field="confirm_password" type="password" placeholder="••••••••" />
                
                <div className="mt-8 flex items-center gap-3 bg-[#161b22] p-4 rounded-lg border border-[#30363d]">
                  <input 
                    type="checkbox" 
                    id="terms" 
                    className="w-5 h-5 accent-blue-600 rounded bg-[#0e1117] border-[#30363d] cursor-pointer"
                    checked={formData.terms}
                    onChange={e => updateForm('terms', e.target.checked)}
                  />
                  <label htmlFor="terms" className="text-sm text-gray-300 cursor-pointer">
                    أوافق صراحةً على <a href="#" className="text-blue-500 hover:underline">الشروط والأحكام</a> و <a href="#" className="text-blue-500 hover:underline">سياسة الخصوصية</a>.
                  </label>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                
                {/* Starter */}
                <div 
                  onClick={() => setPlan('Starter')}
                  className={`border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative
                    ${plan === 'Starter' ? 'border-blue-500 bg-blue-600/10' : 'border-[#30363d] bg-[#161b22] hover:border-gray-500'}`}
                >
                  <h3 className="text-xl font-bold mb-2">Starter</h3>
                  <div className="text-2xl font-black mb-4">مجاني</div>
                  <ul className="space-y-3 text-sm text-[#8b949e]">
                    <li>✓ فرع واحد</li>
                    <li>✓ 3 مستخدمين كحد أقصى</li>
                    <li>✓ نقاط البيع POS</li>
                    <li>✓ المبيعات والمخزون</li>
                  </ul>
                </div>

                {/* Growth */}
                <div 
                  onClick={() => setPlan('Growth')}
                  className={`border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative
                    ${plan === 'Growth' ? 'border-blue-500 bg-blue-600/10 transform scale-105 shadow-[0_0_30px_rgba(37,99,235,0.2)]' : 'border-[#30363d] bg-[#161b22] hover:border-gray-500'}`}
                >
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                    ابدأ مجاناً 14 يوم
                  </div>
                  <h3 className="text-xl font-bold mb-2">Growth</h3>
                  <div className="text-2xl font-black mb-1">199 <span className="text-sm">درهم/شهر</span></div>
                  <div className="text-xs text-blue-400 font-bold mb-4">الأكثر شعبية 🚀</div>
                  <ul className="space-y-3 text-sm text-[#c9d1d9] font-medium">
                    <li>✓ فرع واحد</li>
                    <li>✓ 15 مستخدم</li>
                    <li>✓ جميع موديولات النظام</li>
                    <li>✓ تحليلات متقدمة</li>
                  </ul>
                </div>

                {/* Business */}
                <div 
                  onClick={() => setPlan('Business')}
                  className={`border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative
                    ${plan === 'Business' ? 'border-blue-500 bg-blue-600/10' : 'border-[#30363d] bg-[#161b22] hover:border-gray-500'}`}
                >
                  <h3 className="text-xl font-bold mb-2">Business</h3>
                  <div className="text-2xl font-black mb-4">149 <span className="text-sm">درهم/فرع/شهر</span></div>
                  <ul className="space-y-3 text-sm text-[#8b949e]">
                    <li>✓ فروع غير محدودة</li>
                    <li>✓ مستخدمين غير محدودين</li>
                    <li>✓ API Integration</li>
                    <li>✓ مدير حساب مخصص</li>
                  </ul>
                </div>

              </div>
            )}

            {step === 5 && (
              <div className="max-w-2xl mx-auto bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-6">
                
                <div className="flex items-start gap-4 pb-6 border-b border-[#30363d]">
                  <div className="bg-blue-600/20 p-3 rounded-lg text-blue-500"><Building2 size={24} /></div>
                  <div>
                    <h4 className="font-bold text-gray-400 text-sm mb-1">بيانات الشركة</h4>
                    <p className="font-semibold text-lg">{formData.company_name} <span className="text-sm font-normal text-gray-500">({formData.country})</span></p>
                    <p className="text-sm text-gray-400">{formData.business_sector} · {formData.city}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pb-6 border-b border-[#30363d]">
                  <div className="bg-purple-600/20 p-3 rounded-lg text-purple-500"><User size={24} /></div>
                  <div>
                    <h4 className="font-bold text-gray-400 text-sm mb-1">بيانات المسؤول</h4>
                    <p className="font-semibold text-lg">{formData.full_name}</p>
                    <p className="text-sm text-gray-400" dir="ltr">{formData.email} · {formData.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-emerald-600/20 p-3 rounded-lg text-emerald-500"><CreditCard size={24} /></div>
                  <div>
                    <h4 className="font-bold text-gray-400 text-sm mb-1">الخطة المختارة</h4>
                    <p className="font-semibold text-xl text-emerald-400">{plan} Plan</p>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 pt-6 border-t border-[#30363d]">
            {step > 1 && (
              <button 
                onClick={prevStep}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-bold bg-[#161b22] text-white border border-[#30363d] hover:bg-[#21262d] transition-colors"
              >
                رجوع
              </button>
            )}
            
            {step < 5 ? (
              <button 
                onClick={nextStep}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
              >
                المتابعة ←
              </button>
            ) : (
              <button 
                onClick={submitForm}
                disabled={loading}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {loading ? <span className="animate-pulse">جاري بناء نظامك...</span> : "إنشاء الحساب وبدء العمل 🚀"}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
