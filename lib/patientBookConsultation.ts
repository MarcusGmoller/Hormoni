import type { SupabaseClient } from '@supabase/supabase-js'

export const PATIENT_BOOKING_CONSULTATION_MINUTES = 20

const CONSULTATION_MS = PATIENT_BOOKING_CONSULTATION_MINUTES * 60 * 1000

export type PatientBookResult =
  | { ok: true }
  | { ok: false; error: string; kind?: 'auth' | 'blocked' | 'validation' | 'overlap' | 'session' | 'meet' | 'db' }

/**
 * Samme regler som den tidligere book-side: Free-plan, overlap, Google Meet, insert requested.
 */
export async function getPatientBookingBlockState(supabase: SupabaseClient): Promise<{
  blocked: boolean
  hint: string | null
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { blocked: false, hint: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, has_ever_subscribed_pro')
    .eq('id', user.id)
    .maybeSingle()

  const raw = profile?.subscription_tier ?? 'free'
  const tier =
    raw === 'starter' ? 'free' : raw === 'plus' || raw === 'premium' ? 'pro' : raw

  if (tier !== 'free') return { blocked: false, hint: null }

  if (profile?.has_ever_subscribed_pro) {
    return {
      blocked: true,
      hint: 'Som tidligere betalende kunde har du ikke adgang til gratis konsultation på Free. Opgrader til Pro under Abonnement for at booke.',
    }
  }

  const { count, error: countError } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['requested', 'confirmed'])

  if (countError) return { blocked: false, hint: null }

  const blocked = (count ?? 0) >= 1
  return {
    blocked,
    hint: blocked
      ? 'Med gratis abonnement kan du kun booke én konsultation ad gangen. Opgrader til Pro under Abonnement på dit dashboard, eller aflys din nuværende tid hos gynækologen før du booker en ny.'
      : null,
  }
}

export async function patientBookConsultationSlot(
  supabase: SupabaseClient,
  args: { professionalId: string; slotStartMs: number }
): Promise<PatientBookResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, kind: 'auth', error: 'Du skal være logget ind for at booke.' }
  }

  const block = await getPatientBookingBlockState(supabase)
  if (block.blocked) {
    return {
      ok: false,
      kind: 'blocked',
      error: block.hint ?? 'Du kan ikke booke med dit nuværende abonnement.',
    }
  }

  const startTime = new Date(args.slotStartMs)
  const endTime = new Date(args.slotStartMs + CONSULTATION_MS)
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { ok: false, kind: 'validation', error: 'Ugyldigt tidspunkt.' }
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()
  const rawTier = profileRow?.subscription_tier ?? 'free'
  const normalizedTier =
    rawTier === 'starter' ? 'free' : rawTier === 'plus' || rawTier === 'premium' ? 'pro' : rawTier

  if (normalizedTier === 'free') {
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['requested', 'confirmed'])
    if ((count ?? 0) >= 1) {
      return {
        ok: false,
        kind: 'blocked',
        error:
          'Med gratis abonnement kan du kun booke én konsultation ad gangen. Opgrader til Pro på dit dashboard, eller aflys din nuværende tid først.',
      }
    }
  }

  const { data: overlappingRows, error: overlappingError } = await supabase
    .from('appointments')
    .select('id')
    .eq('professional_id', args.professionalId)
    .in('status', ['requested', 'confirmed'])
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())
    .limit(1)

  if (overlappingError) {
    return { ok: false, kind: 'overlap', error: overlappingError.message }
  }

  if ((overlappingRows ?? []).length > 0) {
    return {
      ok: false,
      kind: 'overlap',
      error: 'Tiden blev lige booket af en anden. Vælg venligst en ny tid.',
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) {
    return {
      ok: false,
      kind: 'session',
      error: 'Du skal være logget ind for at booke. Prøv at logge ind igen.',
    }
  }

  const meetRes = await fetch('/api/appointments/google-meet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      professionalId: args.professionalId,
    }),
  })

  const meetPayload = (await meetRes.json().catch(() => ({}))) as {
    googleMeetUrl?: string
    meetOpenAt?: string
    error?: string
  }

  if (!meetRes.ok || !meetPayload.googleMeetUrl || !meetPayload.meetOpenAt) {
    return {
      ok: false,
      kind: 'meet',
      error:
        meetPayload.error ??
        'Kunne ikke oprette videomøde (Google Calendar). Tjek server-konfiguration eller prøv igen.',
    }
  }

  const { error: insertError } = await supabase.from('appointments').insert({
    user_id: user.id,
    professional_id: args.professionalId,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: 'requested',
    google_meet_url: meetPayload.googleMeetUrl,
    meet_open_at: meetPayload.meetOpenAt,
  })

  if (insertError) {
    return { ok: false, kind: 'db', error: insertError.message }
  }

  return { ok: true }
}
