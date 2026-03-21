import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
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

  const next = async () => {
    if (!user?.tenant_id) return;
    if (step === 1) {
      await supabase.from('tenants').update({ name: data.companyName || undefined, country: data.country, currency: data.currency, industry: data.sector }).eq('id', user.tenant_id);
    }
    if (step === 2) {
      await supabase.from('tenants').update({ vat_rate: Number(data.vat || 0) }).eq('id', user.tenant_id);
    }
    if (step === 3 && data.firstItemName) {
      await supabase.from('items').insert({ tenant_id: user.tenant_id, name: data.firstItemName, selling_price: Number(data.firstItemPrice || 0), is_active: true });
    }
    if (step === 4 && data.firstEmployeeName && data.firstEmployeeEmail) {
      const { data: u } = await supabase.from('users').insert({ tenant_id: user.tenant_id, full_name: data.firstEmployeeName, email: data.firstEmployeeEmail, is_active: true }).select('id').single();
      if (u?.id && data.firstEmployeeRole) await supabase.from('user_roles').insert({ tenant_id: user.tenant_id, user_id: u.id, role_id: data.firstEmployeeRole });
    }
    if (step < 5) setStep(step + 1);
  };

  const finish = () => {
    localStorage.setItem('nawwat_onboarding_done', 'true');
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#071C3B] text-white p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="h-2 bg-white/20 rounded mb-6"><div className="h-2 bg-[#00CFFF] rounded" style={{ width: `${progress}%` }} /></div>
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-2xl font-black">مرحباً بك في NawwatOS!</h2>
            <input className="w-full px-3 py-2 rounded text-black" placeholder="اسم الشركة" value={data.companyName} onChange={(e) => setData({ ...data, companyName: e.target.value })} />
            <select className="w-full px-3 py-2 rounded text-black" value={data.sector} onChange={(e) => setData({ ...data, sector: e.target.value })}><option>مطعم</option><option>متجر</option><option>خدمات</option><option>استيراد</option><option>عقارات</option><option>أخرى</option></select>
            <div className="grid grid-cols-2 gap-2">
              <select className="w-full px-3 py-2 rounded text-black" value={data.country} onChange={(e) => setData({ ...data, country: e.target.value, vat: e.target.value === 'KSA' ? 15 : 5 })}><option>UAE</option><option>KSA</option><option>أخرى</option></select>
              <select className="w-full px-3 py-2 rounded text-black" value={data.currency} onChange={(e) => setData({ ...data, currency: e.target.value })}><option>AED</option><option>SAR</option><option>USD</option></select>
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
            <button onClick={finish} className="px-4 py-2 rounded bg-[#00CFFF] text-[#071C3B] font-black">ابدأ الاستخدام</button>
          </div>
        )}
        {step < 5 && <div className="mt-6 flex justify-end gap-2"><button onClick={() => setStep(Math.max(1, step - 1))} className="px-4 py-2 rounded border border-white/30">رجوع</button><button onClick={next} className="px-4 py-2 rounded bg-[#00CFFF] text-[#071C3B] font-black">التالي</button></div>}
      </div>
    </div>
  );
}
