import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SECTORS = [
  { value: 'retail',   label: '🛍️ Retail' },
  { value: 'fnb',      label: '🍽️ F&B / مطعم' },
  { value: 'pharmacy', label: '💊 صيدلية' },
  { value: 'clinic',   label: '🏥 عيادة' },
  { value: 'general',  label: '🏢 عام' },
]

export default function SignupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    tenant_name: '',
    sector: 'retail',
    country: 'AE',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSignup = async () => {
    setLoading(true)
    setError('')

    try {
      // 1. إنشاء الـ user في Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('فشل إنشاء الحساب')

      // 2. إنشاء الـ Tenant + User + Branch في الـ Database
      const slug = form.tenant_name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        + '-' + Date.now().toString(36)

      const { error: tenantError } = await supabase.rpc('register_new_tenant', {
        p_auth_id:     authData.user.id,
        p_email:       form.email,
        p_full_name:   form.full_name,
        p_tenant_name: form.tenant_name,
        p_tenant_slug: slug,
        p_sector:      form.sector,
        p_country:     form.country,
      })

      if (tenantError) throw tenantError

      // 3. Refresh الـ session عشان الـ JWT يتحدث بالـ tenant_id
      await supabase.auth.refreshSession()

      navigate('/dashboard')

    } catch (err: any) {
      setError(err.message || 'حدث خطأ، حاول مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid #E8EDF5',
    fontSize: '14px',
    color: '#071C3B',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#071C3B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: '24px',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        width: '100%',
        maxWidth: '460px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="56" height="56" style={{ margin: '0 auto 12px' }}>
            <circle cx="48" cy="48" r="30" fill="rgba(0,207,255,0.06)"/>
            <ellipse cx="31" cy="27" rx="11" ry="5.5" fill="rgba(0,207,255,0.22)" transform="rotate(-42,31,27)"/>
            <ellipse cx="72" cy="45" rx="13" ry="5" fill="rgba(0,207,255,0.18)" transform="rotate(-8,72,45)"/>
            <ellipse cx="38" cy="75" rx="11" ry="5" fill="rgba(0,207,255,0.20)" transform="rotate(30,38,75)"/>
            <circle cx="22" cy="20" r="9" fill="#00CFFF"/>
            <circle cx="80" cy="44" r="7.5" fill="#00CFFF" opacity="0.85"/>
            <circle cx="28" cy="78" r="8.5" fill="#00CFFF" opacity="0.9"/>
            <circle cx="48" cy="48" r="22" fill="#071C3B"/>
          </svg>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: '24px', fontWeight: 800, color: '#071C3B' }}>nawwat</div>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', color: '#00CFFF' }}>ENTERPRISE ERP</div>
        </div>

        <div style={{ fontSize: '20px', fontWeight: 700, color: '#071C3B', textAlign: 'center', marginBottom: '8px' }}>إنشاء حساب جديد</div>
        <div style={{ fontSize: '13px', color: '#8A97B0', textAlign: 'center', marginBottom: '28px' }}>ابدأ تجربتك المجانية الآن</div>

        {/* Step 1 — بيانات شخصية */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>الاسم الكامل</label>
              <input style={inputStyle} placeholder="أحمد محمد" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>البريد الإلكتروني</label>
              <input style={inputStyle} type="email" placeholder="you@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>كلمة المرور</label>
              <input style={inputStyle} type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <button
              onClick={() => {
                if (!form.full_name || !form.email || !form.password) { setError('يرجى ملء جميع الحقول'); return; }
                setError('')
                setStep(2)
              }}
              style={{ width: '100%', padding: '14px', background: '#071C3B', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
            >
              التالي ←
            </button>
          </div>
        )}

        {/* Step 2 — بيانات الشركة */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>اسم الشركة</label>
              <input style={inputStyle} placeholder="شركة النور للتجارة" value={form.tenant_name} onChange={e => set('tenant_name', e.target.value)} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>القطاع</label>
              <select style={inputStyle} value={form.sector} onChange={e => set('sector', e.target.value)}>
                {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>الدولة</label>
              <select style={inputStyle} value={form.country} onChange={e => set('country', e.target.value)}>
                <option value="AE">🇦🇪 الإمارات</option>
                <option value="SA">🇸🇦 السعودية</option>
              </select>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', color: '#EF476F', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', background: '#F4F7FC', color: '#071C3B', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                → رجوع
              </button>
              <button
                onClick={handleSignup}
                disabled={loading}
                style={{ flex: 2, padding: '14px', background: loading ? '#8A97B0' : '#071C3B', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? '...' : 'إنشاء الحساب 🚀'}
              </button>
            </div>
          </div>
        )}

        {step === 1 && error && (
          <div style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.2)', borderRadius: '10px', padding: '10px 14px', marginTop: '16px', color: '#EF476F', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#8A97B0' }}>
          عندك حساب؟{' '}
          <Link to="/login" style={{ color: '#00CFFF', fontWeight: 600, textDecoration: 'none' }}>سجل دخول</Link>
        </div>
      </div>
    </div>
  )
}