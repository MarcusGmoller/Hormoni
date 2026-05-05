'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function GynekologOnboardingPage() {
  const router = useRouter()
  const [professionalName, setProfessionalName] = useState('')
  const [professionalEmail, setProfessionalEmail] = useState('')
  const [professionalPhone, setProfessionalPhone] = useState('')
  const [bio, setBio] = useState('')
  const [paymentInformation, setPaymentInformation] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: professional, error: professionalError } = await supabase
        .from('professionals')
        .select('approval_status,bio,professional_name,payment_information,professional_email,professional_phone')
        .eq('user_id', user.id)
        .maybeSingle()

      if (professionalError) {
        setError(professionalError.message)
        setLoading(false)
        return
      }

      if (professional?.approval_status === 'approved') {
        router.push('/gynaekolog-dashboard')
        return
      }

      if (professional?.bio) {
        setBio(professional.bio)
      }
      if (professional?.professional_name) {
        setProfessionalName(professional.professional_name)
      }
      if (professional?.payment_information) {
        setPaymentInformation(professional.payment_information)
      }
      if (professional?.professional_email) {
        setProfessionalEmail(professional.professional_email)
      }
      if (professional?.professional_phone) {
        setProfessionalPhone(professional.professional_phone)
      }

      setLoading(false)
    }

    bootstrap()
  }, [router])

  const submit = async () => {
    setError(null)
    if (!professionalName.trim()) {
      setError('Skriv venligst dit navn.')
      return
    }
    if (!bio.trim()) {
      setError('Skriv venligst en kort bio.')
      return
    }
    if (!paymentInformation.trim()) {
      setError('Indtast venligst betalingsinformation.')
      return
    }
    if (!professionalEmail.trim()) {
      setError('Indtast venligst e-mail.')
      return
    }
    if (!professionalPhone.trim()) {
      setError('Indtast venligst mobilnummer.')
      return
    }
    if (!confirmed) {
      setError('Du skal bekræfte afkrydsningsfeltet for at sende.')
      return
    }

    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      router.push('/login')
      return
    }

    const { error: upsertError } = await supabase.from('professionals').upsert(
      {
        user_id: user.id,
        title: 'Gynækolog',
        professional_name: professionalName.trim(),
        bio: bio.trim(),
        payment_information: paymentInformation.trim(),
        professional_email: professionalEmail.trim(),
        professional_phone: professionalPhone.trim(),
        public_profile: false,
        approval_status: 'pending',
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (upsertError) {
      setError(upsertError.message)
      return
    }

    router.push('/gynaekolog-pending')
    router.refresh()
  }

  const goBack = () => {
    router.back()
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-sm text-slate-600">Indlæser...</div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Gynækolog profilopsætning</h1>
        <p className="mt-2 text-sm text-slate-600">
          Udfyld din professionelle bio. Når du sender, bliver din profil markeret som pending indtil admin godkender.
        </p>

        <div className="mt-6">
          <label htmlFor="professionalName" className="mb-2 block text-sm font-medium text-slate-800">
            Navn
          </label>
          <input
            id="professionalName"
            value={professionalName}
            onChange={(event) => setProfessionalName(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Fx Jonas G. Møller"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="professionalEmail" className="mb-2 block text-sm font-medium text-slate-800">
            E-mail
          </label>
          <input
            id="professionalEmail"
            type="email"
            value={professionalEmail}
            onChange={(event) => setProfessionalEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="fx klinik@email.dk"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="professionalPhone" className="mb-2 block text-sm font-medium text-slate-800">
            Mobilnummer
          </label>
          <input
            id="professionalPhone"
            value={professionalPhone}
            onChange={(event) => setProfessionalPhone(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="fx 12345678"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="bio" className="mb-2 block text-sm font-medium text-slate-800">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="min-h-[160px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Beskriv din erfaring, specialer og hvordan du hjælper patienter."
          />
        </div>

        <div className="mt-4">
          <label htmlFor="paymentInformation" className="mb-2 block text-sm font-medium text-slate-800">
            Betalingsinformation
          </label>
          <textarea
            id="paymentInformation"
            value={paymentInformation}
            onChange={(event) => setPaymentInformation(event.target.value)}
            className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Fx kontonummer, faktureringsoplysninger eller anden betalingsopsætning."
          />
        </div>

        <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>Jeg bekræfter at oplysningerne er korrekte, og at profilen må sendes til admin-godkendelse.</span>
        </label>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={goBack}
          className="mt-5 mr-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Tilbage
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Sender...' : 'Send til godkendelse'}
        </button>
      </div>
    </main>
  )
}
