'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './subscriptionPage.module.css'

type PlanRow = { id: string; name: string; description: string | null }

const planBlurb: Record<string, string> = {
  free: 'Én aktiv konsultation ad gangen. Ideelt til at komme i gang.',
  pro: 'Book flere konsultationer og få fuld fleksibilitet i dit forløb.',
}

function SubscriptionUpgradePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setupMode = searchParams.get('setup') === '1'
  const nextPath = searchParams.get('next') || '/dashboard/pro'
  const [loading, setLoading] = useState(true)
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<string>('free')
  const [availablePlans, setAvailablePlans] = useState<PlanRow[]>([])
  const [saving, setSaving] = useState(false)
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

      const [{ data: profile, error }, { data: planRows, error: plansError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('profile_completed,role,subscription_tier')
          .eq('id', user.id)
          .single(),
        supabase.from('plans').select('id,name,description').order('id'),
      ])
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

      if (plansError) {
        console.error(plansError)
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

      const plans = ((planRows ?? []) as PlanRow[]).filter((plan) => plan.id === 'free' || plan.id === 'pro')
      setAvailablePlans(plans)
      const planIds = new Set(plans.map((p) => p.id))

      const rawTier = profile.subscription_tier ?? 'free'
      const legacyMapped =
        rawTier === 'starter'
          ? 'free'
          : rawTier === 'plus' || rawTier === 'premium'
            ? 'pro'
            : rawTier
      const resolved = planIds.has(legacyMapped)
        ? legacyMapped
        : planIds.has('free')
          ? 'free'
          : plans[0]?.id ?? 'free'
      setSubscriptionPlanId(resolved)
      setLoading(false)
    }

    run()
  }, [router])

  const selectPlan = async (planId: string) => {
    if (saving || planId === subscriptionPlanId) return
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

    const { error } = await supabase.from('profiles').update({ subscription_tier: planId }).eq('id', user.id)

    setSaving(false)

    if (error) {
      setFeedback(`Kunne ikke opdatere abonnement: ${error.message}`)
      return
    }

    setSubscriptionPlanId(planId)
    const label = availablePlans.find((p) => p.id === planId)?.name ?? planId
    setFeedback(`Abonnement opdateret til ${label}.`)
  }

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

    setSubscriptionPlanId('pro')
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
          router.back()
        }}
      >
        ← Tilbage til dashboard
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
