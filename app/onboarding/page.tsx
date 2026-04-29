'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

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

export default function OnboardingPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cprNumber, setCprNumber] = useState('')
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [selectedHealthConditions, setSelectedHealthConditions] = useState<string[]>([])
  const [medications, setMedications] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [step, setStep] = useState<1 | 2>(1)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const stepOneIsValid = fullNameIsValid && addressIsValid && emailIsValid && phoneIsValid && cprIsValid
  const formIsValid = stepOneIsValid

  useEffect(() => {
    setError(null)
  }, [fullName, address, contactEmail, phone, cprNumber, selectedSymptoms, selectedHealthConditions, medications, additionalNotes])

  const toggleItem = (current: string[], value: string, setter: (next: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value))
      return
    }

    setter([...current, value])
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
      router.push('/login')
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
      profile_completed: true,
      profile_completed_at: new Date().toISOString(),
    }

    const normalizedCpr = normalizeCpr(cprNumber)
    const cprHash = await toSha256Hex(normalizedCpr)

    const { error: cprVaultError } = await supabase
      .from('user_cpr_vault')
      .upsert(
        {
          user_id: user.id,
          cpr_ciphertext: normalizedCpr,
          cpr_hash: cprHash,
        },
        { onConflict: 'user_id' }
      )

    if (cprVaultError) {
      setSaving(false)
      setError(cprVaultError.message)
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

    router.push('/userdashboard')
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

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Opret din profil</h1>
      <p className="mb-4 text-sm text-gray-600">
        Trin {step} af 2
      </p>

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      <div className="space-y-3">
        {step === 1 && (
          <>
            <input
              className="border p-2 w-full"
              placeholder="Fulde navn"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <input
              className="border p-2 w-full"
              placeholder="Adresse"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div>
              <input
                className="border p-2 w-full"
                placeholder="Email (kontakt)"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              {!emailIsValid && contactEmail.trim().length > 0 && (
                <div className="text-sm text-red-600 mt-1">Indtast en gyldig email.</div>
              )}
            </div>

            <div>
              <input
                className="border p-2 w-full"
                placeholder="Telefon (8 cifre)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
              />
              {!phoneIsValid && phone.trim().length > 0 && (
                <div className="text-sm text-red-600 mt-1">
                  Telefonnummer skal være præcis 8 cifre (fx 12345678). Du må gerne skrive +45, vi fjerner det automatisk.
                </div>
              )}
            </div>

            <div>
              <input
                className="border p-2 w-full"
                placeholder="CPR-nummer (10 cifre)"
                value={cprNumber}
                onChange={(e) => setCprNumber(e.target.value)}
                inputMode="numeric"
              />
              {!cprIsValid && cprNumber.trim().length > 0 && (
                <div className="text-sm text-red-600 mt-1">CPR-nummer skal være præcis 10 cifre.</div>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8">
            <div>
              <h2 className="text-4xl font-semibold text-gray-800">Helbred & symptomer</h2>
              <p className="mt-2 text-2xl text-gray-500">
                Dette hjælper os med at give dig den bedste behandling
              </p>
            </div>

            <div>
              <label className="mb-4 block text-lg font-semibold">Hvilke symptomer oplever du? *</label>
              <div className="grid gap-3 md:grid-cols-3">
                {SYMPTOM_OPTIONS.map((symptom) => {
                  const selected = selectedSymptoms.includes(symptom)
                  return (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() => toggleItem(selectedSymptoms, symptom, setSelectedSymptoms)}
                      className={[
                        'rounded-xl border px-4 py-3 text-center transition-colors',
                        selected ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-800 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {symptom}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-4 block text-lg font-semibold">Har du nogle af følgende helbredstilstande?</label>
              <div className="grid gap-3 md:grid-cols-2">
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
                        'rounded-xl border px-4 py-3 text-center transition-colors',
                        selected ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-800 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {condition}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tager du nogen medicin?</label>
              <textarea
                className="min-h-24 border p-2 w-full"
                placeholder="Skriv hvilken medicin du tager"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Er der andet, vi skal vide?</label>
              <textarea
                className="min-h-24 border p-2 w-full"
                placeholder="Skriv eventuelle ekstra oplysninger"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="border rounded px-4 py-3"
              type="button"
            >
              Tilbage
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!stepOneIsValid}
              className="bg-black text-white rounded px-4 py-3 disabled:opacity-50"
              type="button"
            >
              Næste
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving || !formIsValid}
              className="bg-black text-white rounded px-4 py-3 disabled:opacity-50"
            >
              {saving ? 'Gemmer...' : 'Færdig'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}