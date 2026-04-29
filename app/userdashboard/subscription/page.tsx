'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './subscriptionPage.module.css'

type PlanRow = { id: string; name: string; description: string | null }

const planBlurb: Record<string, string> = {
  free: 'Én aktiv konsultation ad gangen. Ideelt til at komme i gang.',
  pro: 'Book flere konsultationer og få fuld fleksibilitet i dit forløb.',
}

export default function SubscriptionUpgradePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<string>('free')
  const [availablePlans, setAvailablePlans] = useState<PlanRow[]>([])
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

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

      if (error) {
        console.error(error)
        router.push('/login')
        return
      }

      if (plansError) {
        console.error(plansError)
      }

      if (profile?.role === 'professional') {
        router.push('/gynaekolog-dashboard')
        return
      }

      if (!profile?.profile_completed) {
        router.push('/onboarding')
        return
      }

      const plans = (planRows ?? []) as PlanRow[]
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

  if (loading) {
    return (
      <div className={styles.shell}>
        <p className={styles.loader}>Loader...</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <button type="button" className={styles.backLink} onClick={() => router.push('/userdashboard')}>
        ← Tilbage til dashboard
      </button>

      <div className={styles.headerRow}>
        <h1 className={styles.title}>Abonnement</h1>
        <p className={styles.lead}>
          Vælg den plan der passer til dit forløb. Du kan skifte når som helst.
        </p>
      </div>

      <div className={styles.panel}>
        <div className={styles.currentLabel}>Dit nuværende abonnement</div>
        <div className={styles.currentPlan}>
          {availablePlans.find((p) => p.id === subscriptionPlanId)?.name ?? subscriptionPlanId}
        </div>

        <div className={styles.planList}>
          {availablePlans.map((plan) => {
            const isCurrent = plan.id === subscriptionPlanId
            const description =
              plan.description?.trim() || planBlurb[plan.id] || 'Abonnementsplan fra Mit Produkt.'
            return (
              <button
                key={plan.id}
                type="button"
                className={`${styles.planCard} ${isCurrent ? styles.planCardActive : ''}`}
                disabled={saving || isCurrent}
                onClick={() => selectPlan(plan.id)}
              >
                <div className={styles.planName}>{plan.name}</div>
                <div className={styles.planDesc}>{description}</div>
                {isCurrent ? <span className={styles.planBadge}>Aktiv plan</span> : null}
              </button>
            )
          })}
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
