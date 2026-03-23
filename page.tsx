'use client'
// src/app/(auth)/login/page.tsx

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'

type Tab = 'email' | 'phone'
type OtpStep = 'send' | 'verify'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') || '/discover'
  const supabase     = createClient()

  const [tab, setTab]           = useState<Tab>('email')
  const [loading, setLoading]   = useState(false)

  // Email fields
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // OTP fields
  const [phone, setPhone]       = useState('')
  const [otp, setOtp]           = useState('')
  const [otpStep, setOtpStep]   = useState<OtpStep>('send')

  // ── Email login ─────────────────────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { toast.error(error.message); return }
      router.push(next)
    } finally {
      setLoading(false)
    }
  }

  // ── Phone OTP ───────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('OTP sent!')
      setOtpStep('verify')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone, token: otp }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      router.push(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="font-display text-4xl font-semibold text-white">
            Pr<span className="text-rose-light">aa</span>v
          </span>
          <p className="text-white/50 text-sm mt-2">Where free minds find each other</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          {/* Tab switcher */}
          <div className="flex rounded-2xl overflow-hidden bg-white/5 p-1 mb-6">
            {(['email', 'phone'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setOtpStep('send') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-rose text-white shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {t === 'email' ? '✉ Email' : '📱 Phone (OTP)'}
              </button>
            ))}
          </div>

          {/* Email form */}
          {tab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <Field label="Email address">
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-input"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password" required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                />
              </Field>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {/* Phone OTP form */}
          {tab === 'phone' && otpStep === 'send' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <Field label="Mobile number">
                <input
                  type="tel" required
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="auth-input"
                />
              </Field>
              <p className="text-white/40 text-xs">Indian numbers only in Phase 1. We'll SMS you a 6-digit code.</p>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          )}

          {tab === 'phone' && otpStep === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-white/60 text-sm text-center mb-2">
                Enter the 6-digit code sent to {phone}
              </p>
              <Field label="OTP code">
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}"
                  maxLength={6} required
                  value={otp} onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  className="auth-input text-center text-2xl tracking-widest"
                />
              </Field>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Verifying…' : 'Verify & Sign in'}
              </button>
              <button
                type="button"
                onClick={() => setOtpStep('send')}
                className="text-white/40 text-xs text-center w-full hover:text-white/70 transition-colors"
              >
                ← Change number
              </button>
            </form>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <p className="text-center text-white/50 text-sm">
            No account?{' '}
            <Link href="/signup" className="text-rose-light hover:underline font-medium">
              Create profile
            </Link>
          </p>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          <Link href="/discover" className="hover:text-white/50 transition-colors">
            Browse without signing in →
          </Link>
        </p>
      </div>

      <style jsx>{`
        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.07);
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #fff;
          outline: none;
          transition: border-color 0.2s;
        }
        .auth-input:focus {
          border-color: #B5294E;
        }
        .auth-input::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .btn-primary {
          background: #B5294E;
          border: none;
          color: #fff;
          border-radius: 14px;
          padding: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: block;
        }
        .btn-primary:hover:not(:disabled) {
          background: #E8526E;
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
