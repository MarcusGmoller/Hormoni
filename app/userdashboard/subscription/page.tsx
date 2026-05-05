'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './subscriptionPage.module.css'

function SubscriptionUpgradePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  /** Kun sat fra onboarding (`?setup=1`) — da peger Tilbage på trin 3. */
  const setupMode = searchParams.get('setup') === '1'
  const nextPath = searchParams.get('next') || '/dashboard/pro'
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [paymentPlaceholderBusy, setPaymentPlaceholderBusy] = useState(false)

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('profile_completed')
        .eq('id', user.id)
        .single()
      const { data: professional } = await supabase
        .from('professionals')
        .select('approval_status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error(error)
        router.push('/login')
        return
      }

      if (professional?.approval_status === 'approved') {
        router.push('/gynaekolog-dashboard')
        return
      }
      if (professional) {
        router.push('/gynaekolog-pending')
        return
      }

      if (!profile?.profile_completed) {
        router.push('/onboarding')
        return
      }

      setLoading(false)
    }

    run()
  }, [router])

  const completeStripePlaceholderPayment = async () => {
    if (paymentPlaceholderBusy) return
    setPaymentPlaceholderBusy(true)
    setFeedback('Stripe placeholder: betaling simuleret. Aktiverer Pro og sender dig videre...')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setPaymentPlaceholderBusy(false)
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ subscription_tier: 'pro' })
      .eq('id', user.id)

    if (error) {
      setPaymentPlaceholderBusy(false)
      setFeedback(`Kunne ikke aktivere Pro: ${error.message}`)
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
    setPaymentPlaceholderBusy(false)
    router.push(nextPath)
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <p className={styles.loader}>Loader...</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => {
          if (setupMode) {
            router.push('/onboarding?step=3')
            return
          }
          router.push('/dashboard')
        }}
      >
        {setupMode
          ? '← Tilbage til opret profil (trin 3 af 3)'
          : '← Tilbage til dashboard'}
      </button>

      <div className={styles.headerRow}>
        <h1 className={styles.title}>Abonnement</h1>
        <p className={styles.lead}>
          Vælg den plan der passer til dit forløb. Du kan skifte når som helst.
        </p>
      </div>
      <div className={styles.successBanner}>
        Betalingssetup (Stripe) er en placeholder. Udfyld felterne og tryk “Fuldfør betaling”.
      </div>

      <div className={styles.panel}>
        <div className={styles.stripePlaceholderCard}>
          <div className={styles.stripePlaceholderTitle}>Stripe betaling (placeholder)</div>
          <p className={styles.stripePlaceholderMeta}>
            Denne sektion simulerer kortbetaling. Ingen rigtig transaktion gennemføres endnu.
          </p>
          <div className={styles.stripePlaceholderGrid}>
            <label className={styles.stripeField}>
              <span>Kortnummer</span>
              <input type="text" value="4242 4242 4242 4242" readOnly />
            </label>
            <label className={styles.stripeField}>
              <span>Udløb</span>
              <input type="text" value="12/34" readOnly />
            </label>
            <label className={styles.stripeField}>
              <span>CVC</span>
              <input type="text" value="123" readOnly />
            </label>
            <label className={styles.stripeField}>
              <span>Kortholder</span>
              <input type="text" value="Test Bruger" readOnly />
            </label>
          </div>
          <button
            type="button"
            className={styles.stripePlaceholderPayBtn}
            onClick={completeStripePlaceholderPayment}
            disabled={paymentPlaceholderBusy}
          >
            {paymentPlaceholderBusy ? 'Behandler betaling...' : 'Fuldfør betaling (placeholder)'}
          </button>
        </div>

        {feedback ? (
          <div
            className={
              feedback.startsWith('Kunne ikke') ? styles.errorBanner : styles.successBanner
            }
          >
            {feedback}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function SubscriptionUpgradePage() {
  return (
    <Suspense
      fallback={
        <div className={styles.shell}>
          <p className={styles.loader}>Loader...</p>
        </div>
      }
    >
      <SubscriptionUpgradePageContent />
    </Suspense>
  )
}
