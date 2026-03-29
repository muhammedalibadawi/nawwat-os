import React from 'react';
import { Link } from 'react-router-dom';
import { FoundationSubnav } from '@/components/commerceFoundation/FoundationSubnav';
import { describeMarginEngineStatus } from '@/services/commerceFoundationService';

const CommerceFoundationHubScreen: React.FC = () => {
  const engine = describeMarginEngineStatus();

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-6 pb-10 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-[1.75rem] font-black text-white tracking-tight">CommerceOS — مركز طبقة الإيراد</h1>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-content-3">
          قنوات، حسابات قنوات، عقود وإصدارات (قريبًا)، شروط رسوم وشحن وإرجاع، دفاتر أسعار قناة، ومحاكي هامش — مدمج
          داخل NawwatOS ويرتبط لاحقًا بـ CRM وWorkOS. بدون storefront وبدون omnichannel.
        </p>
      </div>

      <FoundationSubnav />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[20px] border border-border bg-surface-card p-5 shadow-sm">
          <h2 className="text-sm font-black text-cyan-200">ما يُعاد استخدامه اليوم</h2>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-xs font-bold leading-6 text-content-3">
            <li>جدول channel_accounts + شاشة التجارة الحالية (مزامنة / ويبهوك / تعيين SKU).</li>
            <li>Views: commerce_*_v و RPCs الموجودة في Supabase.</li>
            <li>جهات contacts و CRM layer للطرف التجاري لاحقًا.</li>
          </ul>
        </section>
        <section className="rounded-[20px] border border-border bg-surface-card p-5 shadow-sm">
          <h2 className="text-sm font-black text-amber-200">ما سيُبنى لاحقًا (بدون تنفيذ الآن)</h2>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-xs font-bold leading-6 text-content-3">
            <li>عقود تجارية، شروط رسوم البوابات، عمولات، شحن، إرجاع/صلاحية.</li>
            <li>جداول أسعار لكل قناة، تخصيص تكلفة حملات، اتجاه التسوية.</li>
            <li>حساب هامش/دفعات مرتبط بالعقود (الحالة الحالية: {engine.ready ? 'جاهز' : 'غير مفعّل'}).</li>
          </ul>
          <p className="mt-2 text-[0.7rem] font-bold text-content-3 opacity-90">{engine.note}</p>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/commerce/foundation/channels"
          className="rounded-2xl bg-[#071C3B] px-5 py-3 text-sm font-black text-white hover:opacity-95"
        >
          قنوات متصلة
        </Link>
        <Link
          to="/commerce/foundation/contracts"
          className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
        >
          عقود وتسوية
        </Link>
        <Link
          to="/commerce/foundation/pricing"
          className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
        >
          تسعير وهامش
        </Link>
        <Link to="/crm" className="rounded-2xl px-5 py-3 text-sm font-black text-cyan-200 hover:text-cyan-100">
          CRM — جهات وفرص
        </Link>
      </div>
    </div>
  );
};

export default CommerceFoundationHubScreen;
