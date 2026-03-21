import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const registerCompany = async (formData: any, plan: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Supabase Auth Registration
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("تعذّر إنشاء الحساب");

      // 2. Provision Tenant (Company)
      const { data: tenant, error: tenantError } = await supabase.from('tenants').insert({
        name: formData.company_name,
        name_ar: formData.company_name_ar || formData.company_name,
        business_type: formData.business_sector,
        country: formData.country,
        city: formData.city,
        website: formData.website || null,
        currency: formData.country === 'SA' ? 'SAR' : 'AED',
        plan_type: plan,
        is_active: true
      }).select().single();

      if (tenantError) throw tenantError;

      // 3. Provision User Linked to Tenant
      const { error: userError } = await supabase.from('users').insert({
        auth_id: authData.user.id,
        tenant_id: tenant.id,
        full_name: formData.full_name,
        full_name_ar: formData.full_name_ar || formData.full_name,
        email: formData.email,
        phone: formData.phone,
        role: 'owner',
        job_title: formData.job_title || null,
        is_active: true
      });

      if (userError) throw userError;

      // 4. Provision Initial Head Office Branch
      const { error: branchError } = await supabase.from('branches').insert({
        tenant_id: tenant.id,
        name: 'Head Office',
        name_ar: 'المقر الرئيسي',
        is_head_office: true,
        country: formData.country,
        city: formData.city,
        is_active: true
      });

      if (branchError) throw branchError;

      // 5. Navigate to post-setup success screen
      navigate('/register/success');

    } catch (err: any) {
      console.error("[useRegister Error]:", err);
      // Map common errors into Arabic UI messages
      if (err.message?.includes('already registered')) {
        setError('البريد الإلكتروني مستخدم بالفعل');
      } else if (err.message?.includes('fetch') || err.message?.includes('Network')) {
        setError('تعذّر الاتصال — تحقق من الإنترنت وحاول مجدداً');
      } else {
        setError(err.message || 'حدث خطأ غير متوقع أثناء إنشاء حسابك.');
      }
    } finally {
      setLoading(false);
    }
  };

  return { registerCompany, loading, error, setError };
}
