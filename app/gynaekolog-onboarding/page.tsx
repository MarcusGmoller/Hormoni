'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { isDanishPhone8Digits, normalizeDanishPhone } from '@/lib/danishPhone'
import { ensureProfileSyncedWithAuth } from '@/lib/ensureProfileSyncedWithAuth'
import { combineFullName, splitFullName } from '@/lib/personName'
import { isAdminProfileRole } from '@/lib/useProfileRole'

export default function GynekologOnboardingPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [professionalEmail, setProfessionalEmail] = useState('')
  const [professionalPhone, setProfessionalPhone] = useState('')
  const [bio, setBio] = useState('')
  const [paymentInformation, setPaymentInformation] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const professionalPhoneIsValid = useMemo(
    () => isDanishPhone8Digits(professionalPhone),
    [professionalPhone]
  )

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: adminCheck } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (isAdminProfileRole(adminCheck?.role)) {
        router.replace('/admin')
        return
      }

      const [{ data: professional, error: professionalError }, { data: profileRow }] = await Promise.all([
        supabase
          .from('professionals')
          .select('approval_status,bio,professional_name,payment_information,professional_email,professional_phone')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      ])

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
      {
        const nameSrc =
          professional?.professional_name?.trim() || profileRow?.full_name?.trim() || ''
        const split = splitFullName(nameSrc)
        setFirstName(split.firstName)
        setLastName(split.lastName)
      }
      if (professional?.payment_information) {
        setPaymentInformation(professional.payment_information)
      }
      // Samme konto som patient/bruger: genbrug login-mail når der ikke allerede er professional_email i DB
      setProfessionalEmail(
        (professional?.professional_email?.trim() || user.email?.trim() || '')
      )
      if (professional?.professional_phone) {
        setProfessionalPhone(professional.professional_phone)
      }

      setLoading(false)
    }

    bootstrap()
  }, [router])

  const submit = async () => {
    setError(null)
    if (!firstName.trim()) {
      setError('Skriv venligst fornavn.')
      return
    }
    if (!lastName.trim()) {
      setError('Skriv venligst efternavn.')
      return
    }
    const combinedName = combineFullName(firstName, lastName)
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
      setError('Indtast venligst telefonnummer.')
      return
    }
    if (!isDanishPhone8Digits(professionalPhone)) {
      setError(
        'Indtast et gyldigt dansk telefonnummer: præcis 8 cifre (fx mobil). Du må gerne skrive +45 foran.'
      )
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

    const ensured = await ensureProfileSyncedWithAuth(supabase, user, {
      intendedRole: 'professional',
    })
    if (!ensured.ok) {
      setSaving(false)
      setError(`Kunne ikke synkronisere profil: ${ensured.message}`)
      return
    }

    const { error: upsertError } = await supabase.from('professionals').upsert(
      {
        user_id: user.id,
        title: 'Gynækolog',
        professional_name: combinedName,
        bio: bio.trim(),
        payment_information: paymentInformation.trim(),
        professional_email: professionalEmail.trim(),
        professional_phone: normalizeDanishPhone(professionalPhone),
        public_profile: false,
        approval_status: 'pending',
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      setSaving(false)
      setError(upsertError.message)
      return
    }

    const { error: profileNameError } = await supabase
      .from('profiles')
      .update({ full_name: combinedName })
      .eq('id', user.id)

    setSaving(false)
    if (profileNameError) {
      setError(`Profil gemt som gynækolog, men fulde navn i profil kunne ikke opdateres: ${profileNameError.message}`)
      return
    }

    router.push('/gynaekolog-pending')
    router.refresh()
  }

  /** Logger ud og går til forsiden (undgår `router.back()` → patient-onboarding i historik). */
  const goBack = async () => {
    await supabase.auth.signOut()
    window.location.assign('/')
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
        <p className="mt-2 text-xs text-slate-500">
          Vil du ikke fortsætte nu?{' '}
          <Link href="/logout" className="font-medium text-slate-800 underline hover:text-slate-950">
            Fortryd og log ud
          </Link>{' '}
          — du kan logge ind igen senere.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="professionalFirstName" className="mb-2 block text-sm font-medium text-slate-800">
              Fornavn
            </label>
            <input
              id="professionalFirstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Fx Jonas"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="professionalLastName" className="mb-2 block text-sm font-medium text-slate-800">
              Efternavn
            </label>
            <input
              id="professionalLastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Fx Møller"
              autoComplete="family-name"
            />
          </div>
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
            Telefon (dansk mobil eller 8 cifre)
          </label>
          <input
            id="professionalPhone"
            value={professionalPhone}
            onChange={(event) => setProfessionalPhone(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="fx 12 34 56 78 eller +45 12 34 56 78"
            inputMode="tel"
            autoComplete="tel"
          />
          {professionalPhone.trim().length > 0 && !professionalPhoneIsValid ? (
            <p className="mt-1.5 text-sm text-red-600">
              Brug 8 cifre (dansk nummer). +45 eller mellemrum er fint — de fjernes automatisk ved gem.
            </p>
          ) : null}
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

        <label
          htmlFor="gyn-admin-confirm"
          className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-700"
        >
          <input
            id="gyn-admin-confirm"
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
          onClick={() => void goBack()}
          className="mt-5 mr-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Tilbage og log ud
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={
            saving ||
            !confirmed ||
            !professionalPhoneIsValid ||
            !firstName.trim() ||
            !lastName.trim()
          }
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Sender...' : 'Send til godkendelse'}
        </button>
      </div>
    </main>
  )
}
