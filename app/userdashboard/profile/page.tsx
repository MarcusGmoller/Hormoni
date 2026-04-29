'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './profilePage.module.css'

type ProfileRow = {
  role: string | null
  profile_completed: boolean | null
  full_name: string | null
  contact_email: string | null
  address: string | null
  gender: string | null
  payment_method: string | null
  payment_status: string | null
}

export default function UserProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role,profile_completed,full_name,contact_email,address,gender,payment_method,payment_status')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error(error)
        router.push('/userdashboard')
        return
      }

      const profile = data as ProfileRow
      if (profile.role === 'professional') {
        router.push('/gynaekolog-dashboard')
        return
      }

      if (!profile.profile_completed) {
        router.push('/onboarding')
        return
      }

      setFullName(profile.full_name ?? '')
      setGender(profile.gender ?? '')
      setContactEmail(profile.contact_email ?? user.email ?? '')
      setAddress(profile.address ?? '')
      setPaymentMethod(profile.payment_method ?? '')
      setPaymentStatus(profile.payment_status ?? '')
      setLoading(false)
    }

    run()
  }, [router])

  const save = async () => {
    setSaving(true)
    setFeedback(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        gender: gender.trim() || null,
        contact_email: contactEmail.trim() || null,
        address: address.trim() || null,
        payment_method: paymentMethod.trim() || null,
        payment_status: paymentStatus.trim() || null,
      })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      setFeedback(`Kunne ikke gemme profil: ${error.message}`)
      return
    }

    setFeedback('Profilen er opdateret.')
  }

  if (loading) return <div className={styles.shell}>Loader...</div>

  return (
    <div className={styles.shell}>
      <button type="button" className={styles.backBtn} onClick={() => router.push('/userdashboard')}>
        ← Tilbage til dashboard
      </button>

      <div>
        <h1 className={styles.title}>Ret din profil</h1>
        <p className={styles.lead}>Opdater navn, køn, mail, adresse og betalingsoplysninger.</p>
      </div>

      <div className={styles.panel}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Fulde navn</label>
            <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Køn</label>
            <select className={styles.select} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Vælg</option>
              <option value="female">Kvinde</option>
              <option value="male">Mand</option>
              <option value="non_binary">Non-binær</option>
              <option value="other">Andet</option>
              <option value="prefer_not_to_say">Ønsker ikke at oplyse</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Mail</label>
            <input className={styles.input} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Adresse</label>
            <input className={styles.input} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Betalingsmetode</label>
            <input
              className={styles.input}
              placeholder="fx Visa **** 1234"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Betalingsstatus</label>
            <select className={styles.select} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">Vælg</option>
              <option value="active">Aktiv</option>
              <option value="past_due">Forfalden</option>
              <option value="cancelled">Opsagt</option>
            </select>
          </div>
        </div>

        <button type="button" className={styles.saveBtn} disabled={saving} onClick={save}>
          {saving ? 'Gemmer...' : 'Gem ændringer'}
        </button>

        {feedback ? (
          <div className={feedback.startsWith('Kunne ikke') ? styles.bannerError : styles.bannerOk}>{feedback}</div>
        ) : null}
      </div>
    </div>
  )
}
