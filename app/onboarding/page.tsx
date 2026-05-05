'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#333333] placeholder:text-[#94a3b8] shadow-sm transition focus:border-[#849b87] focus:outline-none focus:ring-2 focus:ring-[#849b87]/20'
const labelClass = 'mb-1.5 block text-sm font-medium text-[#333333]'
const sageBtn =
  'inline-flex items-center justify-center rounded-full bg-[#849b87] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#738a7a] disabled:pointer-events-none disabled:opacity-45'
const ghostBtn =
  'inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-[#333333] transition hover:border-[#849b87]/50 hover:bg-[#f8faf9]'

const SYMPTOM_OPTIONS = [
  'Hedeture',
  'Nattesved',
  'Sovnproblemer',
  'Humorsvingninger',
  'Irritabilitet',
  'Angst',
  'Nedtrykthed',
  'Traethed',
  'Hjernetaage',
  'Koncentrationsbesvaer',
  'Nedsat sexlyst',
  'Toer slimhinde',
  'Hovedpine',
  'Ledsmerter',
  'Hjertebanken',
  'Vaegtoegning',
] as const

const HEALTH_CONDITION_OPTIONS = [
  'Diabetes',
  'Hjertesygdom',
  'Forhoejet blodtryk',
  'Blodprop',
  'Brystkraeft',
  'Osteoporose',
  'Autoimmun sygdom',
  'Andet',
] as const

const toSha256Hex = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type PlanRow = { id: string; name: string; description: string | null }

const planBlurb: Record<string, string> = {
  free: 'Én aktiv konsultation ad gangen. Ideelt til at komme i gang.',
  pro: 'Book flere konsultationer og få fuld fleksibilitet i dit forløb.',
}

const TOTAL_STEPS = 3

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cprNumber, setCprNumber] = useState('')
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [selectedHealthConditions, setSelectedHealthConditions] = useState<string[]>([])
  const [medications, setMedications] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [allowNewsEmails, setAllowNewsEmails] = useState(false)
  const [allowAppointmentReminders, setAllowAppointmentReminders] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [availablePlans, setAvailablePlans] = useState<PlanRow[]>([])
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('free')

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cprChecking, setCprChecking] = useState(false)
  const [cprError, setCprError] = useState<string | null>(null)

  const normalizeEmail = (value: string) => value.trim()

  const normalizePhone = (value: string) => {
    const trimmed = value.trim()
    const withoutSpaces = trimmed.replace(/\s+/g, '')
    const withoutCountry = withoutSpaces.startsWith('+45') ? withoutSpaces.slice(3) : withoutSpaces
    return withoutCountry.replace(/\D/g, '')
  }

  const emailIsValid = useMemo(() => {
    const e = normalizeEmail(contactEmail)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }, [contactEmail])

  const phoneIsValid = useMemo(() => {
    const p = normalizePhone(phone)
    return /^\d{8}$/.test(p)
  }, [phone])

  const normalizeCpr = (value: string) => value.replace(/\D/g, '')
  const cprIsValid = useMemo(() => /^\d{10}$/.test(normalizeCpr(cprNumber)), [cprNumber])

  const fullNameIsValid = useMemo(() => fullName.trim().length > 1, [fullName])
  const addressIsValid = useMemo(() => address.trim().length > 3, [address])

  const stepOneIsValid =
    fullNameIsValid && addressIsValid && emailIsValid && phoneIsValid && cprIsValid && acceptedTerms
  const planIds = useMemo(() => new Set(availablePlans.map((p) => p.id)), [availablePlans])
  const planStepIsValid = plansLoaded && planIds.has(selectedPlanId)
  const formIsValid = stepOneIsValid && planStepIsValid

  useEffect(() => {
    setError(null)
  }, [
    fullName,
    address,
    contactEmail,
    phone,
    cprNumber,
    selectedSymptoms,
    selectedHealthConditions,
    medications,
    additionalNotes,
    selectedPlanId,
    acceptedTerms,
    allowNewsEmails,
    allowAppointmentReminders,
  ])

  const toggleItem = (current: string[], value: string, setter: (next: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value))
      return
    }

    setter([...current, value])
  }

  const validateCprOnStepOne = async () => {
    const normalizedCpr = normalizeCpr(cprNumber)
    if (!/^\d{10}$/.test(normalizedCpr)) return false

    setCprChecking(true)
    setCprError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) {
        setCprError('Session udløbet. Log ind igen for at fortsætte.')
        return false
      }

      const cprHash = await toSha256Hex(normalizedCpr)
      const cprRes = await fetch(`${window.location.origin}/api/user-cpr-vault`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          cpr_ciphertext: normalizedCpr,
          cpr_hash: cprHash,
        }),
      })
      const cprJson = (await cprRes.json().catch(() => ({}))) as { error?: string }
      if (!cprRes.ok) {
        setCprError(cprJson.error ?? 'Kunne ikke validere CPR. Prøv igen.')
        return false
      }
      return true
    } finally {
      setCprChecking(false)
    }
  }

  const handleStepOneNext = async () => {
    if (!stepOneIsValid || cprChecking) return
    const ok = await validateCprOnStepOne()
    if (!ok) return
    setStep(2)
  }

  const goToPreviousStep = () => {
    if (step === 3) {
      setStep(2)
      return
    }
    if (step === 2) {
      setStep(1)
      return
    }
    router.back()
  }

  const save = async () => {
    if (!formIsValid) {
      setError('Udfyld venligst alle felter korrekt.')
      return
    }

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      router.push('/login')
      return
    }

    // Sikrer at PostgREST-kald får en frisk JWT (undgår RLS-fejl når session i hukommelse
    // og getUser() er ude af trit — ses især efter production build).
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshData.session) {
      setSaving(false)
      setError(
        refreshError?.message ??
          'Session kunne ikke bekræftes. Prøv at logge ud og ind igen.'
      )
      return
    }

    const payload = {
      full_name: fullName.trim(),
      address: address.trim(),
      contact_email: normalizeEmail(contactEmail),
      phone: normalizePhone(phone),
      symptoms: selectedSymptoms,
      health_conditions: selectedHealthConditions,
      medications: medications.trim() || null,
      additional_notes: additionalNotes.trim() || null,
      subscription_tier: selectedPlanId,
      profile_completed: true,
      profile_completed_at: new Date().toISOString(),
    }

    const normalizedCpr = normalizeCpr(cprNumber)
    const cprHash = await toSha256Hex(normalizedCpr)

    const accessToken = refreshData.session.access_token
    const cprRes = await fetch(`${window.location.origin}/api/user-cpr-vault`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        cpr_ciphertext: normalizedCpr,
        cpr_hash: cprHash,
      }),
    })
    const cprJson = (await cprRes.json().catch(() => ({}))) as { error?: string }
    if (!cprRes.ok) {
      setSaving(false)
      setError(cprJson.error ?? 'Kunne ikke gemme CPR. Prøv igen.')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (selectedPlanId === 'pro') {
      router.push('/userdashboard/subscription?setup=1&next=%2Fdashboard%2Fpro')
      return
    }
    router.push('/dashboard/free')
  }

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      if (!contactEmail && user.email) {
        setContactEmail(user.email)
      }
    }

    bootstrap()
  }, [contactEmail, router])

  useEffect(() => {
    let cancelled = false

    const loadPlans = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profile }, { data: planRows, error: plansError }] = await Promise.all([
        supabase.from('profiles').select('subscription_tier').eq('id', user.id).single(),
        supabase.from('plans').select('id,name,description').order('id'),
      ])

      if (cancelled) return

      if (plansError) {
        console.error(plansError)
      }

      const plans = ((planRows ?? []) as PlanRow[]).filter((plan) => plan.id === 'free' || plan.id === 'pro')
      setAvailablePlans(plans)
      const ids = new Set(plans.map((p) => p.id))

      const rawTier = profile?.subscription_tier ?? 'free'
      const legacyMapped =
        rawTier === 'starter'
          ? 'free'
          : rawTier === 'plus' || rawTier === 'premium'
            ? 'pro'
            : rawTier
      const resolved = ids.has(legacyMapped)
        ? legacyMapped
        : ids.has('free')
            ? 'free'
            : plans[0]?.id ?? 'free'
      setSelectedPlanId(resolved)
      setPlansLoaded(true)
    }

    loadPlans()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (stepParam === '1' || stepParam === '2' || stepParam === '3') {
      setStep(Number(stepParam) as 1 | 2 | 3)
    }
  }, [searchParams])

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <nav className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white/80 p-2">
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-sm font-medium text-[#4a4a4a] transition hover:bg-[#f8faf9] hover:text-[#333333]"
        >
          Forside
        </Link>
        <Link
          href="/professionals"
          className="rounded-full px-4 py-2 text-sm font-medium text-[#4a4a4a] transition hover:bg-[#f8faf9] hover:text-[#333333]"
        >
          Gynækologer
        </Link>
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-[#4a4a4a] transition hover:bg-[#f8faf9] hover:text-[#333333]"
        >
          Log ind
        </Link>
      </nav>

      <header className="mb-8 border-b border-black/5 pb-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#333333] transition hover:text-[#849b87]">
          Hormoni(e)
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#333333] md:text-[1.65rem]">Opret din profil</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#777777]">
          Udfyld dine oplysninger, så vi kan tilpasse dit forløb.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${step >= n ? 'bg-[#849b87]' : 'bg-[#e5e7eb]'}`}
                aria-hidden
              />
            ))}
          </div>
          <span className="shrink-0 text-xs font-medium text-[#777777]">
            Trin {step} af {TOTAL_STEPS}
          </span>
        </div>
      </header>

      {error && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-5 rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
            <div>
              <label className={labelClass} htmlFor="onboarding-fullname">
                Fulde navn
              </label>
              <input
                id="onboarding-fullname"
                className={inputClass}
                placeholder="Fx Anna Jensen"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="onboarding-address">
                Adresse
              </label>
              <input
                id="onboarding-address"
                className={inputClass}
                placeholder="Vej og nummer, postnr. og by"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="onboarding-email">
                E-mail (kontakt)
              </label>
              <input
                id="onboarding-email"
                className={inputClass}
                type="email"
                placeholder="din@email.dk"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                autoComplete="email"
              />
              {!emailIsValid && contactEmail.trim().length > 0 && (
                <p className="mt-1.5 text-sm text-red-600">Indtast en gyldig e-mail.</p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="onboarding-phone">
                Telefon
              </label>
              <input
                id="onboarding-phone"
                className={inputClass}
                placeholder="8 cifre (fx 12345678)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                autoComplete="tel"
              />
              {!phoneIsValid && phone.trim().length > 0 && (
                <p className="mt-1.5 text-sm text-red-600">
                  Telefonnummer skal være 8 cifre. Du må gerne skrive +45 — det fjernes automatisk.
                </p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="onboarding-cpr">
                CPR-nummer
              </label>
              <input
                id="onboarding-cpr"
                className={inputClass}
                placeholder="10 cifre"
                value={cprNumber}
                onChange={(e) => {
                  setCprNumber(e.target.value)
                  setCprError(null)
                }}
                inputMode="numeric"
                autoComplete="off"
              />
              {!cprIsValid && cprNumber.trim().length > 0 && (
                <p className="mt-1.5 text-sm text-red-600">CPR-nummer skal være præcis 10 cifre.</p>
              )}
              {cprError ? <p className="mt-1.5 text-sm text-red-600">{cprError}</p> : null}
            </div>

            <div className="space-y-2 rounded-xl border border-black/10 bg-[#fafafa] p-4">
              <label className="flex items-start gap-3 text-sm text-[#333333]">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20 text-[#849b87] focus:ring-[#849b87]/30"
                />
                <span>
                  Jeg accepterer Terms and Conditions <span className="text-red-600">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-[#333333]">
                <input
                  type="checkbox"
                  checked={allowNewsEmails}
                  onChange={(e) => setAllowNewsEmails(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20 text-[#849b87] focus:ring-[#849b87]/30"
                />
                <span>Må vi sende dig nyhedsmails?</span>
              </label>

              <label className="flex items-start gap-3 text-sm text-[#333333]">
                <input
                  type="checkbox"
                  checked={allowAppointmentReminders}
                  onChange={(e) => setAllowAppointmentReminders(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20 text-[#849b87] focus:ring-[#849b87]/30"
                />
                <span>Må vi sende dig påmindelser om din tid?</span>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
            <div>
              <h2 className="text-xl font-bold text-[#333333] md:text-2xl">Helbred og symptomer</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#777777]">
                Det hjælper os med at give dig den bedste behandling.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-[#333333]">Hvilke symptomer oplever du?</p>
              <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                {SYMPTOM_OPTIONS.map((symptom) => {
                  const selected = selectedSymptoms.includes(symptom)
                  return (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() => toggleItem(selectedSymptoms, symptom, setSelectedSymptoms)}
                      className={[
                        'rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors',
                        selected
                          ? 'border-[#849b87] bg-[#849b87]/12 text-[#333333] ring-1 ring-[#849b87]/35'
                          : 'border-black/10 text-[#4a4a4a] hover:border-[#849b87]/35 hover:bg-[#f8faf9]',
                      ].join(' ')}
                    >
                      {symptom}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-[#333333]">Har du nogle af følgende helbredstilstande?</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {HEALTH_CONDITION_OPTIONS.map((condition) => {
                  const selected = selectedHealthConditions.includes(condition)
                  return (
                    <button
                      key={condition}
                      type="button"
                      onClick={() =>
                        toggleItem(selectedHealthConditions, condition, setSelectedHealthConditions)
                      }
                      className={[
                        'rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors',
                        selected
                          ? 'border-[#849b87] bg-[#849b87]/12 text-[#333333] ring-1 ring-[#849b87]/35'
                          : 'border-black/10 text-[#4a4a4a] hover:border-[#849b87]/35 hover:bg-[#f8faf9]',
                      ].join(' ')}
                    >
                      {condition}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="onboarding-meds">
                Tager du medicin?
              </label>
              <textarea
                id="onboarding-meds"
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder="Skriv hvilken medicin du tager"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="onboarding-notes">
                Andet vi skal vide?
              </label>
              <textarea
                id="onboarding-notes"
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder="Valgfrit — ekstra oplysninger til dit forløb"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
            <div>
              <h2 className="text-xl font-bold text-[#333333] md:text-2xl">Vælg plan</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#777777]">
                Vælg den plan der passer til dit forløb. Du kan skifte den senere under Abonnement.
              </p>
            </div>

            {!plansLoaded ? (
              <p className="text-sm text-[#777777]">Henter planer…</p>
            ) : availablePlans.length === 0 ? (
              <p className="text-sm text-red-700">
                Kunne ikke indlæse abonnementsplaner. Prøv at genindlæse siden, eller kontakt support.
              </p>
            ) : (
              <div className="grid gap-3">
                {availablePlans.map((plan) => {
                  const selected = plan.id === selectedPlanId
                  const description =
                    plan.description?.trim() || planBlurb[plan.id] || 'Abonnementsplan.'
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={[
                        'rounded-xl border px-4 py-4 text-left transition-colors',
                        selected
                          ? 'border-[#849b87] bg-[#849b87]/12 ring-1 ring-[#849b87]/35'
                          : 'border-black/10 hover:border-[#849b87]/35 hover:bg-[#f8faf9]',
                      ].join(' ')}
                    >
                      <div className="text-sm font-semibold text-[#333333]">{plan.name}</div>
                      <div className="mt-1 text-sm leading-relaxed text-[#777777]">{description}</div>
                      {selected ? (
                        <span className="mt-2 inline-block text-xs font-medium text-[#849b87]">Valgt</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button onClick={goToPreviousStep} className={ghostBtn} type="button">
            Tilbage
          </button>

          {step === 1 ? (
            <button
              onClick={handleStepOneNext}
              disabled={!stepOneIsValid || cprChecking}
              className={sageBtn}
              type="button"
            >
              {cprChecking ? 'Kontrollerer CPR…' : 'Næste'}
            </button>
          ) : step === 2 ? (
            <button onClick={() => setStep(3)} className={sageBtn} type="button">
              Næste
            </button>
          ) : (
            <button onClick={save} disabled={saving || !formIsValid} className={sageBtn} type="button">
              {saving ? 'Gemmer…' : 'Afslut og gå til dit dashboard'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}