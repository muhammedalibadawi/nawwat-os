import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.message ?? 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#071C3B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)'
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="64" height="64" style={{ margin: '0 auto 16px' }}>
            <circle cx="48" cy="48" r="30" fill="rgba(0,207,255,0.06)" />
            <ellipse cx="31" cy="27" rx="11" ry="5.5" fill="rgba(0,207,255,0.22)" transform="rotate(-42,31,27)" />
            <ellipse cx="72" cy="45" rx="13" ry="5" fill="rgba(0,207,255,0.18)" transform="rotate(-8,72,45)" />
            <ellipse cx="38" cy="75" rx="11" ry="5" fill="rgba(0,207,255,0.20)" transform="rotate(30,38,75)" />
            <circle cx="22" cy="20" r="9" fill="#00CFFF" />
            <circle cx="80" cy="44" r="7.5" fill="#00CFFF" opacity="0.85" />
            <circle cx="28" cy="78" r="8.5" fill="#00CFFF" opacity="0.9" />
            <circle cx="48" cy="48" r="22" fill="#071C3B" />
          </svg>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: '28px', fontWeight: 800, color: '#071C3B', letterSpacing: '-0.5px' }}>nawwat</div>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', color: '#00CFFF', marginTop: '2px' }}>ENTERPRISE ERP</div>
        </div>

        <div style={{ marginBottom: '16px', color: '#071C3B', fontSize: '22px', fontWeight: 700, textAlign: 'center' }}>مرحباً بعودتك</div>
        <div style={{ marginBottom: '28px', color: '#8A97B0', fontSize: '14px', textAlign: 'center' }}>سجّل دخولك للمتابعة</div>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1.5px solid #E8EDF5',
              fontSize: '14px',
              color: '#071C3B',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#071C3B', marginBottom: '6px' }}>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1.5px solid #E8EDF5',
              fontSize: '14px',
              color: '#071C3B',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,71,111,0.08)',
            border: '1px solid rgba(239,71,111,0.2)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            color: '#EF476F',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#8A97B0' : '#071C3B',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {loading ? '...' : 'تسجيل الدخول'}
        </button>

      </div>
    </div>
  )
}