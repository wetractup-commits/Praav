'use client'
// ============================================================
// PRAAV — Profile Builder
// src/app/(app)/profile-builder/page.tsx
//
// 6 steps:
//   1. The Basics      — name, age, city, gender
//   2. Your Identity   — orientation, intent, religion
//   3. About You       — bio, interests (fetched from DB)
//   4. Add Prompts     — 2 open-ended prompts
//   5. Add Photos      — up to 4, one required
//   6. Publish         — Razorpay pay gate → POST /api/profile
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/stores/auth'
import { useRazorpay } from '@/lib/hooks/useRazorpay'
import type {
  GenderType, OrientationType, IntentType, ReligionType, Interest
} from '@/types/database'

// ── Constants ─────────────────────────────────────────────────

const TOTAL_STEPS = 6

const GENDER_OPTIONS: { label: string; value: GenderType }[] = [
  { label: 'She / Her',        value: 'woman' },
  { label: 'He / Him',         value: 'man' },
  { label: 'They / Them',      value: 'non_binary' },
  { label: 'She / They',       value: 'non_binary' },
  { label: 'Trans man',        value: 'transgender_man' },
  { label: 'Trans woman',      value: 'transgender_woman' },
  { label: 'Genderqueer',      value: 'genderqueer' },
  { label: 'Agender',          value: 'agender' },
  { label: 'Prefer not to say',value: 'prefer_not_to_say' },
  { label: 'Other',            value: 'other' },
]

const ORIENTATION_OPTIONS: { label: string; value: OrientationType }[] = [
  { label: 'Straight',         value: 'straight' },
  { label: 'Gay',              value: 'gay' },
  { label: 'Lesbian',          value: 'lesbian' },
  { label: 'Bisexual',         value: 'bisexual' },
  { label: 'Pansexual',        value: 'pansexual' },
  { label: 'Queer',            value: 'queer' },
  { label: 'Asexual',          value: 'asexual' },
  { label: 'Prefer not to say',value: 'prefer_not_to_say' },
]

const INTENT_OPTIONS: { label: string; value: IntentType }[] = [
  { label: 'Dating',           value: 'dating' },
  { label: 'Long-term',        value: 'long_term' },
  { label: 'Marriage',         value: 'marriage' },
  { label: 'Open relationship',value: 'open_relationship' },
  { label: 'Figuring it out',  value: 'not_sure' },
]

const RELIGION_OPTIONS: { label: string; value: ReligionType }[] = [
  { label: 'Atheist',                  value: 'atheist' },
  { label: 'Agnostic',                 value: 'agnostic' },
  { label: 'Non-religious',            value: 'non_religious' },
  { label: 'Secular',                  value: 'non_religious' },
  { label: 'Spiritual, not religious', value: 'spiritual_not_religious' },
  { label: 'Questioning',              value: 'questioning' },
  { label: 'Prefer not to say',        value: 'prefer_not_to_say' },
]

const PROMPT_OPTIONS = [
  "I'll fall for you if…",
  "My love language is",
  "A non-negotiable for me",
  "I'm looking for someone who",
  "One thing I wish more people knew",
  "My ideal Sunday looks like",
  "The conversation I want to have",
  "You'll know I like you when",
  "The most important thing I'm looking for",
]

// ── Types ──────────────────────────────────────────────────────

interface PhotoSlot {
  file: File | null
  preview: string | null
  uploading: boolean
  uploaded_path: string | null
}

interface FormData {
  // Step 1
  display_name: string
  age: string
  city: string
  gender: GenderType | null
  gender_label: string
  gender_custom: string

  // Step 2
  orientation: OrientationType[]
  intent: IntentType | null
  religion: ReligionType | null

  // Step 3
  bio: string
  interest_ids: string[]

  // Step 4
  prompt1_q: string
  prompt1_a: string
  prompt2_q: string
  prompt2_a: string
}

// ── Component ─────────────────────────────────────────────────

export default function ProfileBuilderPage() {
  const router          = useRouter()
  const { user, profile } = useAuthStore()
  const { checkout, loading: payLoading } = useRazorpay()

  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)
  const [interests, setInterests] = useState<Interest[]>([])

  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { file: null, preview: null, uploading: false, uploaded_path: null },
    { file: null, preview: null, uploading: false, uploaded_path: null },
    { file: null, preview: null, uploading: false, uploaded_path: null },
    { file: null, preview: null, uploading: false, uploaded_path: null },
  ])

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const [form, setForm] = useState<FormData>({
    display_name: '', age: '', city: '',
    gender: null, gender_label: '', gender_custom: '',
    orientation: [], intent: null, religion: null,
    bio: '', interest_ids: [],
    prompt1_q: PROMPT_OPTIONS[0], prompt1_a: '',
    prompt2_q: PROMPT_OPTIONS[8], prompt2_a: '',
  })

  // Redirect if already has profile
  useEffect(() => {
    if (profile?.is_published) router.replace('/discover')
  }, [profile, router])

  // Fetch interests from DB
  useEffect(() => {
    fetch('/api/interests')
      .then(r => r.json())
      .then(d => setInterests(d.interests ?? []))
      .catch(() => {/* non-fatal */})
  }, [])

  // ── Helpers ────────────────────────────────────────────────

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  function toggleMulti<T extends string>(
    arr: T[], val: T, maxItems = 99
  ): T[] {
    if (arr.includes(val)) return arr.filter(v => v !== val)
    if (arr.length >= maxItems) return arr
    return [...arr, val]
  }

  function toggleInterest(id: string) {
    setForm(f => ({
      ...f,
      interest_ids: f.interest_ids.includes(id)
        ? f.interest_ids.filter(i => i !== id)
        : f.interest_ids.length >= 6 ? f.interest_ids : [...f.interest_ids, id]
    }))
  }

  // ── Photo handling ─────────────────────────────────────────

  async function handlePhotoSelect(idx: number, file: File) {
    const preview = URL.createObjectURL(file)
    setPhotos(prev => {
      const next = [...prev]
      next[idx] = { file, preview, uploading: true, uploaded_path: null }
      return next
    })

    const fd = new FormData()
    fd.append('file', file)
    fd.append('order_index', String(idx))
    fd.append('is_primary', String(idx === 0))

    try {
      const res  = await fetch('/api/photos', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Photo upload failed.')
        setPhotos(prev => {
          const next = [...prev]
          next[idx] = { file: null, preview: null, uploading: false, uploaded_path: null }
          return next
        })
        return
      }

      setPhotos(prev => {
        const next = [...prev]
        next[idx] = { ...next[idx], uploading: false, uploaded_path: data.photo.storage_path }
        return next
      })
    } catch {
      toast.error('Upload failed. Please try again.')
      setPhotos(prev => {
        const next = [...prev]
        next[idx] = { file: null, preview: null, uploading: false, uploaded_path: null }
        return next
      })
    }
  }

  async function removePhoto(idx: number) {
    const slot = photos[idx]
    if (slot.uploaded_path) {
      // Delete from server (get photo id from path — simplified: just try)
      await fetch(`/api/photos?photo_id=${slot.uploaded_path}`, { method: 'DELETE' })
        .catch(() => {/* best effort */})
    }
    setPhotos(prev => {
      const next = [...prev]
      next[idx] = { file: null, preview: null, uploading: false, uploaded_path: null }
      return next
    })
  }

  // ── Step validation ────────────────────────────────────────

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return (
          form.display_name.trim().length >= 2 &&
          Number(form.age) >= 18 &&
          form.city.trim().length >= 2 &&
          form.gender !== null
        )
      case 2:
        return form.orientation.length > 0 && form.intent !== null
      case 3:
        return form.bio.trim().length >= 10
      case 4:
        return form.prompt1_a.trim().length > 0 && form.prompt2_a.trim().length > 0
      case 5:
        return photos.some(p => p.uploaded_path !== null) &&
               photos.every(p => !p.uploading)
      default:
        return true
    }
  }

  function advance() {
    if (!canAdvance()) {
      const msgs: Record<number, string> = {
        1: 'Please fill in your name, age, city and gender.',
        2: 'Please select your orientation and relationship intent.',
        3: 'Please write a bio of at least 10 characters.',
        4: 'Please answer both prompts.',
        5: 'Please upload at least one photo.',
      }
      toast.error(msgs[step] || 'Please complete this step.')
      return
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setStep(s => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Final submit ───────────────────────────────────────────

  async function handlePublish() {
    // Photos must be uploaded first (step 5 uploads them)
    // Now: create the profile record, then trigger Razorpay
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name:  form.display_name.trim(),
          age:           Number(form.age),
          city:          form.city.trim(),
          gender:        form.gender,
          gender_custom: form.gender === 'other' ? form.gender_custom : undefined,
          orientation:   form.orientation,
          intent:        [form.intent],
          bio:           form.bio.trim(),
          religion:      form.religion ?? 'prefer_not_to_say',
          interest_ids:  form.interest_ids,
        }),
      })

      // 402 = payment required — trigger Razorpay
      if (res.status === 402) {
        setSaving(false)
        checkout({
          sku: 'profile_publish',
          onSuccess: () => {
            toast.success('🕊️ Profile published! Welcome to Praav.')
            router.push('/discover')
          },
          onError: (err) => {
            toast.error(`Payment failed: ${err}`)
          },
        })
        return
      }

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save profile.')
        return
      }

      // Profile created (payment already existed) — go to discover
      toast.success('🕊️ Profile published! Welcome to Praav.')
      router.push('/discover')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="builder-shell">
      {/* Header */}
      <header className="builder-header">
        <span className="logo">Pr<span>aa</span>v</span>
        {step > 1 && (
          <button onClick={back} className="back-btn" aria-label="Go back">
            ←
          </button>
        )}
      </header>

      {/* Progress bar */}
      <div className="progress-track" role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL_STEPS}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="step-label">Step {step} of {TOTAL_STEPS}</div>

      {/* Steps */}
      <main className="builder-body">
        {step === 1 && <Step1 form={form} set={set} />}
        {step === 2 && <Step2 form={form} set={set} toggleMulti={toggleMulti} />}
        {step === 3 && <Step3 form={form} set={set} interests={interests} toggleInterest={toggleInterest} />}
        {step === 4 && <Step4 form={form} set={set} />}
        {step === 5 && (
          <Step5
            photos={photos}
            fileInputRefs={fileInputRefs}
            onSelect={handlePhotoSelect}
            onRemove={removePhoto}
          />
        )}
        {step === 6 && (
          <Step6
            form={form}
            photos={photos}
            onPublish={handlePublish}
            loading={saving || payLoading}
          />
        )}

        {/* Navigation */}
        <div className="nav-row">
          {step < TOTAL_STEPS ? (
            <button
              className="btn-primary"
              onClick={advance}
              disabled={!canAdvance()}
            >
              Continue →
            </button>
          ) : null}
        </div>
      </main>

      <style jsx>{`
        .builder-shell {
          min-height: 100vh;
          background: var(--sand);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .builder-header {
          width: 100%;
          max-width: 480px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 0;
        }
        .logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 600;
          color: var(--midnight);
          letter-spacing: 0.5px;
        }
        .logo span { color: var(--rose); }
        .back-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: white;
          border: none;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-sm);
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .back-btn:hover { background: var(--rose-pale); color: var(--rose); }
        .progress-track {
          width: 100%;
          max-width: 480px;
          height: 3px;
          background: var(--sand-dark);
          margin: 16px 0 0;
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--rose);
          border-radius: 2px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .step-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 8px 0 0;
          width: 100%;
          max-width: 480px;
          padding: 0 20px;
        }
        .builder-body {
          width: 100%;
          max-width: 480px;
          padding: 24px 20px 100px;
          flex: 1;
          animation: fadeUp 0.3s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nav-row {
          margin-top: 24px;
        }
        .btn-primary {
          width: 100%;
          background: var(--rose);
          border: none;
          color: white;
          border-radius: 16px;
          padding: 17px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--rose-light);
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 1 — The Basics
// ══════════════════════════════════════════════════════════════

function Step1({ form, set }: {
  form: FormData
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void
}) {
  return (
    <section>
      <StepTitle title="The Basics" sub="How you appear to others. You can use an alias — your real name is never required." />

      <Field label="Display Name">
        <input
          className="field-input"
          type="text"
          placeholder="Priya, P.K., or any alias"
          value={form.display_name}
          onChange={e => set('display_name', e.target.value)}
          maxLength={50}
          autoFocus
        />
      </Field>

      <div className="grid-2">
        <Field label="Age">
          <input
            className="field-input"
            type="number"
            placeholder="25"
            min={18} max={100}
            value={form.age}
            onChange={e => set('age', e.target.value)}
          />
        </Field>
        <Field label="City">
          <input
            className="field-input"
            type="text"
            placeholder="Bengaluru"
            value={form.city}
            onChange={e => set('city', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Gender Identity">
        <ChipGrid>
          {GENDER_OPTIONS.map(opt => (
            <Chip
              key={opt.label}
              selected={form.gender_label === opt.label}
              onClick={() => {
                set('gender', opt.value)
                set('gender_label', opt.label)
              }}
            >
              {opt.label}
            </Chip>
          ))}
        </ChipGrid>
      </Field>

      {form.gender === 'other' && (
        <Field label="Describe your gender (optional)">
          <input
            className="field-input"
            type="text"
            placeholder="e.g. Demi-girl, Two-spirit…"
            value={form.gender_custom}
            onChange={e => set('gender_custom', e.target.value)}
            maxLength={80}
          />
        </Field>
      )}

      <SharedStyles />
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 2 — Identity
// ══════════════════════════════════════════════════════════════

function Step2({ form, set, toggleMulti }: {
  form: FormData
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  toggleMulti: <T extends string>(arr: T[], val: T, max?: number) => T[]
}) {
  return (
    <section>
      <StepTitle title="Your Identity" sub="Praav is explicitly inclusive. Be as open or as private as you like." />

      <Field label="Sexual Orientation" hint="select all that apply">
        <ChipGrid>
          {ORIENTATION_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              selected={form.orientation.includes(opt.value)}
              onClick={() => set('orientation', toggleMulti(form.orientation, opt.value))}
            >
              {opt.label}
            </Chip>
          ))}
        </ChipGrid>
      </Field>

      <Field label="Relationship Intent">
        <ChipGrid>
          {INTENT_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              selected={form.intent === opt.value}
              onClick={() => set('intent', opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </ChipGrid>
      </Field>

      <Field label="Religion / Worldview" hint="optional">
        <ChipGrid>
          {RELIGION_OPTIONS.map(opt => (
            <Chip
              key={opt.label}
              selected={form.religion === opt.value && form.religion !== null}
              onClick={() => set('religion', opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </ChipGrid>
      </Field>

      <SharedStyles />
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 3 — About You
// ══════════════════════════════════════════════════════════════

function Step3({ form, set, interests, toggleInterest }: {
  form: FormData
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  interests: Interest[]
  toggleInterest: (id: string) => void
}) {
  const remaining = 280 - form.bio.length

  return (
    <section>
      <StepTitle title="About You" sub="Your bio and interests. Be specific — generic bios get ignored." />

      <Field label="Short Bio">
        <textarea
          className="field-input field-textarea"
          placeholder="Write something honest. What makes you, you?"
          value={form.bio}
          onChange={e => set('bio', e.target.value.slice(0, 280))}
          rows={5}
        />
        <div className="char-count" style={{ color: remaining < 40 ? 'var(--rose)' : undefined }}>
          {remaining} left
        </div>
      </Field>

      <Field label="Interests" hint={`pick up to 6 · ${form.interest_ids.length}/6 selected`}>
        <ChipGrid>
          {interests.map(interest => (
            <Chip
              key={interest.id}
              selected={form.interest_ids.includes(interest.id)}
              onClick={() => toggleInterest(interest.id)}
              disabled={!form.interest_ids.includes(interest.id) && form.interest_ids.length >= 6}
            >
              {interest.emoji && <span style={{ marginRight: 4 }}>{interest.emoji}</span>}
              {interest.label}
            </Chip>
          ))}
        </ChipGrid>
      </Field>

      <SharedStyles />
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 4 — Prompts
// ══════════════════════════════════════════════════════════════

function Step4({ form, set }: {
  form: FormData
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void
}) {
  return (
    <section>
      <StepTitle title="Add Prompts" sub="Answer 2 prompts. They show personality far better than a bio." />

      <PromptCard
        label="Prompt 1"
        question={form.prompt1_q}
        answer={form.prompt1_a}
        options={PROMPT_OPTIONS}
        onQuestionChange={q => set('prompt1_q', q)}
        onAnswerChange={a => set('prompt1_a', a)}
        excluded={[form.prompt2_q]}
      />

      <PromptCard
        label="Prompt 2"
        question={form.prompt2_q}
        answer={form.prompt2_a}
        options={PROMPT_OPTIONS}
        onQuestionChange={q => set('prompt2_q', q)}
        onAnswerChange={a => set('prompt2_a', a)}
        excluded={[form.prompt1_q]}
      />

      <SharedStyles />
    </section>
  )
}

function PromptCard({ label, question, answer, options, onQuestionChange, onAnswerChange, excluded }: {
  label: string
  question: string
  answer: string
  options: string[]
  onQuestionChange: (q: string) => void
  onAnswerChange:   (a: string) => void
  excluded: string[]
}) {
  return (
    <div className="prompt-card">
      <div className="prompt-label">{label}</div>
      <select
        className="field-input"
        value={question}
        onChange={e => onQuestionChange(e.target.value)}
        style={{ marginBottom: 10, cursor: 'pointer' }}
      >
        {options
          .filter(o => !excluded.includes(o) || o === question)
          .map(o => <option key={o} value={o}>{o}</option>)
        }
      </select>
      <textarea
        className="field-input field-textarea"
        rows={3}
        placeholder="Your answer…"
        value={answer}
        onChange={e => onAnswerChange(e.target.value.slice(0, 200))}
        style={{ resize: 'none' }}
      />
      <style jsx>{`
        .prompt-card {
          background: white;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 14px;
          box-shadow: 0 2px 12px rgba(28,28,46,.08);
        }
        .prompt-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--rose);
          margin-bottom: 10px;
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 5 — Photos
// ══════════════════════════════════════════════════════════════

function Step5({ photos, fileInputRefs, onSelect, onRemove }: {
  photos: PhotoSlot[]
  fileInputRefs: React.RefObject<HTMLInputElement>[]
  onSelect: (idx: number, file: File) => void
  onRemove: (idx: number) => void
}) {
  const hasAny = photos.some(p => p.uploaded_path)

  return (
    <section>
      <StepTitle title="Add Photos" sub="Upload at least 1 photo. Max 4. Your first photo is your main photo." />

      <div className="photo-grid">
        {photos.map((slot, idx) => (
          <div key={idx} className="photo-slot">
            {slot.preview ? (
              <>
                <div className="photo-preview">
                  <Image
                    src={slot.preview}
                    alt={`Photo ${idx + 1}`}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                  {slot.uploading && (
                    <div className="upload-overlay">
                      <div className="spinner" />
                    </div>
                  )}
                  {slot.uploaded_path && (
                    <div className="upload-success">✓</div>
                  )}
                </div>
                {!slot.uploading && (
                  <button
                    className="photo-remove"
                    onClick={() => onRemove(idx)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                )}
                {idx === 0 && (
                  <div className="photo-badge">Main</div>
                )}
              </>
            ) : (
              <button
                className="photo-add"
                onClick={() => fileInputRefs[idx].current?.click()}
                aria-label="Add photo"
              >
                <span className="photo-add-icon">+</span>
                <span className="photo-add-label">
                  {idx === 0 ? 'Main photo' : 'Add photo'}
                </span>
              </button>
            )}
            <input
              ref={fileInputRefs[idx]}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) onSelect(idx, file)
                e.target.value = ''
              }}
            />
          </div>
        ))}
      </div>

      {!hasAny && (
        <p className="photo-hint">
          Photos are served via signed URLs — never publicly guessable links.
        </p>
      )}

      <style jsx>{`
        .photo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .photo-slot {
          position: relative;
          aspect-ratio: 3/4;
          border-radius: 16px;
          overflow: hidden;
        }
        .photo-preview {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          overflow: hidden;
        }
        .upload-overlay {
          position: absolute;
          inset: 0;
          background: rgba(28,28,46,.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255,255,255,.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-success {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          background: #4CAF50;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          font-weight: 700;
        }
        .photo-remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 26px;
          height: 26px;
          background: rgba(28,28,46,.7);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          transition: background 0.15s;
        }
        .photo-remove:hover { background: var(--rose); }
        .photo-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          background: var(--rose);
          color: white;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 20px;
        }
        .photo-add {
          width: 100%;
          height: 100%;
          background: white;
          border: 2px dashed var(--sand-dark);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          gap: 6px;
          color: var(--text-muted);
        }
        .photo-add:hover {
          border-color: var(--rose);
          color: var(--rose);
          background: var(--rose-pale);
        }
        .photo-add-icon {
          font-size: 28px;
          line-height: 1;
          font-weight: 300;
        }
        .photo-add-label {
          font-size: 11px;
          font-weight: 500;
        }
        .photo-hint {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.5;
          padding: 0 12px;
        }
      `}</style>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 6 — Review + Publish
// ══════════════════════════════════════════════════════════════

function Step6({ form, photos, onPublish, loading }: {
  form: FormData
  photos: PhotoSlot[]
  onPublish: () => void
  loading: boolean
}) {
  const firstPhoto = photos.find(p => p.preview)

  return (
    <section>
      <StepTitle title="Publish Your Profile" sub="One last look before you go live." />

      {/* Preview card */}
      <div className="preview-card">
        <div className="preview-hero">
          {firstPhoto?.preview ? (
            <Image
              src={firstPhoto.preview}
              alt="Your profile photo"
              fill
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="preview-hero-empty">🕊️</div>
          )}
          <div className="preview-hero-grad" />
          <div className="preview-hero-info">
            <div className="preview-name">
              {form.display_name || 'Your Name'}, {form.age || '—'}
            </div>
            <div className="preview-meta">
              {form.city} · {form.religion ?? 'Non-religious'}
            </div>
            {form.interest_ids.length > 0 && (
              <div className="preview-tags">
                {/* Tags shown as placeholders — real labels need lookup */}
                {form.orientation.slice(0, 2).map(o => (
                  <span key={o} className="preview-tag">{o}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {form.bio && (
          <div className="preview-bio">
            <div className="preview-bio-label">Bio</div>
            <p>{form.bio}</p>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div className="privacy-note">
        <span className="privacy-icon">🔒</span>
        <span>
          Your contact details are never public. Only mutual matches can message you.
          Incognito mode available after publishing.
        </span>
      </div>

      {/* Pay gate */}
      <div className="paygate">
        <div className="paygate-icon">🕊️</div>
        <div className="paygate-title">Publish your profile</div>
        <div className="paygate-sub">
          Pay once to go live. No subscription. Your profile stays published until you remove it.
        </div>
        <div className="paygate-price">
          ₹199 <span>one-time</span>
        </div>
        <div className="paygate-features">
          <div className="paygate-feat">✓ Profile visible in discovery feed</div>
          <div className="paygate-feat">✓ Upload up to 4 photos</div>
          <div className="paygate-feat">✓ Swipe and match with others</div>
          <div className="paygate-feat">✓ No auto-renewal</div>
        </div>
        <button
          className="btn-pay"
          onClick={onPublish}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <span className="pay-spinner" /> Processing…
            </span>
          ) : (
            'Pay ₹199 & Publish →'
          )}
        </button>
        <p className="paygate-secure">
          Secured by Razorpay · UPI · Cards · Netbanking
        </p>
      </div>

      <style jsx>{`
        .preview-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(28,28,46,.12);
          margin-bottom: 16px;
        }
        .preview-hero {
          position: relative;
          width: 100%;
          height: 260px;
          background: linear-gradient(135deg, #1C1C2E 0%, #3A1C40 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preview-hero-empty {
          font-size: 64px;
          opacity: 0.5;
        }
        .preview-hero-grad {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(28,28,46,.95) 0%, transparent 55%);
        }
        .preview-hero-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 20px;
        }
        .preview-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 30px;
          font-weight: 600;
          color: white;
          line-height: 1.1;
          margin-bottom: 4px;
        }
        .preview-meta {
          font-size: 12px;
          color: rgba(255,255,255,.65);
          margin-bottom: 10px;
        }
        .preview-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .preview-tag {
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 11px;
          color: rgba(255,255,255,.9);
          text-transform: capitalize;
        }
        .preview-bio {
          padding: 16px 20px;
          border-top: 1px solid var(--sand);
        }
        .preview-bio-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .preview-bio p {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text);
        }
        .privacy-note {
          background: var(--rose-pale);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 16px;
          font-size: 12px;
          color: var(--rose);
          line-height: 1.5;
        }
        .privacy-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .paygate {
          background: var(--midnight);
          border-radius: 20px;
          padding: 28px 24px;
          text-align: center;
        }
        .paygate-icon { font-size: 44px; margin-bottom: 12px; display: block; }
        .paygate-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px;
          font-weight: 600;
          color: white;
          margin-bottom: 6px;
        }
        .paygate-sub {
          font-size: 13px;
          color: rgba(255,255,255,.5);
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .paygate-price {
          font-size: 36px;
          font-weight: 700;
          color: white;
          margin-bottom: 16px;
          letter-spacing: -0.5px;
        }
        .paygate-price span {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255,.4);
          margin-left: 4px;
        }
        .paygate-features {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 20px;
          text-align: left;
        }
        .paygate-feat {
          font-size: 13px;
          color: rgba(255,255,255,.65);
          padding-left: 4px;
        }
        .btn-pay {
          width: 100%;
          background: var(--rose);
          border: none;
          color: white;
          border-radius: 14px;
          padding: 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 12px;
        }
        .btn-pay:hover:not(:disabled) {
          background: var(--rose-light);
          transform: translateY(-1px);
        }
        .btn-pay:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .pay-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .paygate-secure {
          font-size: 11px;
          color: rgba(255,255,255,.3);
        }
      `}</style>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// SHARED UI ATOMS
// ══════════════════════════════════════════════════════════════

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h1 className="step-title">{title}</h1>
      <p className="step-sub">{sub}</p>
      <style jsx>{`
        .step-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 32px;
          font-weight: 600;
          color: var(--midnight);
          line-height: 1.1;
          margin-bottom: 6px;
        }
        .step-sub {
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 24px;
        }
      `}</style>
    </>
  )
}

function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="field-group">
      <label className="field-label">
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </label>
      {children}
      <style jsx>{`
        .field-group { margin-bottom: 20px; }
        .field-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .field-hint {
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          font-size: 11px;
          color: var(--text-light);
        }
      `}</style>
    </div>
  )
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="chip-grid">
      {children}
      <style jsx>{`
        .chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
      `}</style>
    </div>
  )
}

function Chip({ children, selected, onClick, disabled }: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={`chip ${selected ? 'chip-selected' : ''} ${disabled && !selected ? 'chip-disabled' : ''}`}
    >
      {children}
      <style jsx>{`
        .chip {
          padding: 8px 16px;
          border-radius: 24px;
          border: 1.5px solid var(--sand-dark);
          background: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          display: flex;
          align-items: center;
        }
        .chip:hover:not(:disabled) {
          border-color: var(--midnight);
          color: var(--midnight);
        }
        .chip-selected {
          border-color: var(--rose) !important;
          background: var(--rose-pale) !important;
          color: var(--rose) !important;
          font-weight: 600;
        }
        .chip-disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      `}</style>
    </button>
  )
}

function SharedStyles() {
  return (
    <style jsx global>{`
      .field-input {
        width: 100%;
        background: white;
        border: 1.5px solid var(--sand-dark);
        border-radius: 14px;
        padding: 13px 16px;
        font-family: 'DM Sans', sans-serif;
        font-size: 14px;
        color: var(--midnight);
        outline: none;
        transition: border-color 0.2s;
        box-shadow: 0 2px 12px rgba(28,28,46,.06);
        appearance: none;
      }
      .field-input:focus {
        border-color: var(--rose);
      }
      .field-input::placeholder {
        color: var(--text-light);
      }
      .field-textarea {
        resize: vertical;
        min-height: 100px;
        line-height: 1.6;
      }
      .char-count {
        text-align: right;
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
        transition: color 0.2s;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
    `}</style>
  )
}
