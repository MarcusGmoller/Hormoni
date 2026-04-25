'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function OnboardingPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')

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

  const fullNameIsValid = useMemo(() => fullName.trim().length > 1, [fullName])
  const addressIsValid = useMemo(() => address.trim().length > 3, [address])

  const formIsValid = fullNameIsValid && addressIsValid && emailIsValid && phoneIsValid

  useEffect(() => {
    setError(null)
  }, [fullName, address, contactEmail, phone])

  const save = async () => {
    if (!formIsValid) {
      setError('Udfyld venligst alle felter korrekt.')
      return
    }

    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const payload = {
      full_name: fullName.trim(),
      address: address.trim(),
      contact_email: normalizeEmail(contactEmail),
      phone: normalizePhone(phone),
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

    router.push('/dashboard')
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Opret din profil</h1>

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      <div className="space-y-3">
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

        <button
          onClick={save}
          disabled={saving || !formIsValid}
          className="bg-black text-white rounded px-4 py-3 disabled:opacity-50"
        >
          {saving ? 'Gemmer...' : 'Fortsæt'}
        </button>
      </div>
    </main>
  )
}