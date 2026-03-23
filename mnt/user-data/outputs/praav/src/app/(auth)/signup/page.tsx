'use client'
// src/app/(auth)/signup/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [agreed,   setAgreed]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match.'); return }
    if (password.length < 8)  { toast.error('Password must be at least 8 characters.'); return }
    if (!agreed) { toast.error('Please confirm you are 18+.'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      })
      if (error) { toast.error(error.message); return }

      if (data.session) {
        // Email confirmation disabled in Supabase settings → go straight to builder
        toast.success('Account created!')
        router.push('/profile-builder')
      } else {
        // Email confirmation enabled
        toast.success('Check your inbox to confirm your email.')
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="font-display text-4xl font-semibold text-white">
            Pr<span className="text-rose-light">aa</span>v
          </span>
          <p className="text-white/50 text-sm mt-2">Create your account</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <form onSubmit={handleSignup} className="space-y-4">
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
                type="password" required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="auth-input"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password" required
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="auth-input"
              />
            </Field>

            {/* Age gate */}
            <label className="flex items-start gap-3 cursor-pointer group mt-2">
              <div
                className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                  agreed ? 'bg-rose border-rose' : 'border-white/20 group-hover:border-white/40'
                }`}
                onClick={() => setAgreed(!agreed)}
              >
                {agreed && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-white/50 text-sm leading-relaxed">
                I confirm I am 18 years of age or older and agree to the{' '}
                <Link href="/terms" className="text-rose-light hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-rose-light hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            <button type="submit" disabled={loading || !agreed} className="btn-primary w-full mt-2">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-white/50 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-rose-light hover:underline font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Your data is never sold or used for ads.
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
        .auth-input:focus { border-color: #B5294E; }
        .auth-input::placeholder { color: rgba(255,255,255,0.25); }
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
        .btn-primary:hover:not(:disabled) { background: #E8526E; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
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
