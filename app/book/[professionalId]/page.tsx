'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ProfessionalDetails = {
  user_id: string
  title: string | null
  full_name: string | null
}

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  google_meet_url?: string | null
  meet_open_at?: string | null
}

type OpenSlot = {
  id: string
  start_time: string
  end_time: string
  is_booked: boolean
}

export default function BookPage() {
  const router = useRouter()
  const params = useParams<{ professionalId: string }>()
  const professionalId = params.professionalId

  const [professionals, setProfessionals] = useState<ProfessionalDetails[]>([])
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(professionalId)
  const [professional, setProfessional] = useState<ProfessionalDetails | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([])
  const [bookedAppointments, setBookedAppointments] = useState<Appointment[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [freePlanBookingBlocked, setFreePlanBookingBlocked] = useState(false)
  const [freePlanBookingHint, setFreePlanBookingHint] = useState<string | null>(null)

  useEffect(() => {
    setSelectedProfessionalId(professionalId)
  }, [professionalId])

  useEffect(() => {
    const loadBookingEligibility = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setFreePlanBookingBlocked(false)
        setFreePlanBookingHint(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle()

      const raw = profile?.subscription_tier ?? 'free'
      const tier =
        raw === 'starter'
          ? 'free'
          : raw === 'plus' || raw === 'premium'
            ? 'pro'
            : raw

      if (tier !== 'free') {
        setFreePlanBookingBlocked(false)
        setFreePlanBookingHint(null)
        return
      }

      const { count, error: countError } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['requested', 'confirmed'])

      if (countError) {
        console.error(countError)
        setFreePlanBookingBlocked(false)
        setFreePlanBookingHint(null)
        return
      }

      const blocked = (count ?? 0) >= 1
      setFreePlanBookingBlocked(blocked)
      setFreePlanBookingHint(
        blocked
          ? 'Med gratis abonnement kan du kun booke én konsultation ad gangen. Opgrader til Pro under Abonnement på dit dashboard, eller aflys din nuværende tid hos gynækologen før du booker en ny.'
          : null
      )
    }

    loadBookingEligibility()
  }, [])

  useEffect(() => {
    const loadProfessionals = async () => {
      const { data: prosRows, error: prosError } = await supabase
        .from('professionals')
        .select('user_id,title,public_profile,profiles!inner(role)')
        .eq('public_profile', true)
        .eq('profiles.role', 'professional')

      if (prosError) {
        setError(prosError.message)
        return
      }

      const professionalsBase = (prosRows ?? []) as Array<{
        user_id: string
        title: string | null
        public_profile: boolean
      }>
      const ids = professionalsBase.map((p) => p.user_id)
      if (ids.length === 0) {
        setProfessionals([])
        return
      }

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', ids)

      const namesById = (profileRows ?? []).reduce<Record<string, string>>((acc, row: any) => {
        if (row?.id && row?.full_name) acc[row.id] = row.full_name
        return acc
      }, {})

      const merged = professionalsBase.map((p) => ({
        user_id: p.user_id,
        title: p.title,
        full_name: namesById[p.user_id] ?? null,
      }))

      setProfessionals(merged)
      if (!merged.some((p) => p.user_id === selectedProfessionalId) && merged[0]) {
        setSelectedProfessionalId(merged[0].user_id)
      }
    }

    loadProfessionals()
  }, [selectedProfessionalId])

  useEffect(() => {
    const loadProfessional = async () => {
      if (!selectedProfessionalId) return
      const { data, error } = await supabase
        .from('professionals')
        .select('user_id,title,profiles!inner(role)')
        .eq('user_id', selectedProfessionalId)
        .eq('profiles.role', 'professional')
        .maybeSingle()

      if (error) {
        setError(error.message)
        return
      }

      const professionalData = (data as { user_id: string; title: string | null } | null) ?? null
      if (!professionalData) {
        setProfessional(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', professionalData.user_id)
        .maybeSingle()

      setProfessional({
        user_id: professionalData.user_id,
        title: professionalData.title,
        full_name: profile?.full_name ?? null,
      })
    }

    loadProfessional()
  }, [selectedProfessionalId])

  useEffect(() => {
    const loadTakenSlots = async () => {
      if (!selectedProfessionalId) {
        setBookedAppointments([])
        setOpenSlots([])
        return
      }

      setLoadingSlots(true)

      const nowIso = new Date().toISOString()

      const [{ data: apptData, error: apptError }, { data: openSlotData, error: openSlotError }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id,start_time,end_time,status')
          .eq('professional_id', selectedProfessionalId)
          .in('status', ['requested', 'confirmed'])
          .gte('start_time', nowIso),
        supabase
          .from('professional_open_slots')
          .select('id,start_time,end_time,is_booked')
          .eq('professional_id', selectedProfessionalId)
          .eq('is_booked', false)
          .gte('start_time', nowIso)
          .order('start_time', { ascending: true }),
      ])

      setLoadingSlots(false)

      if (apptError) {
        setError(apptError.message)
        return
      }

      if (openSlotError) {
        setError(openSlotError.message)
        return
      }

      setBookedAppointments((apptData as Appointment[]) ?? [])
      setOpenSlots((openSlotData as OpenSlot[]) ?? [])
    }

    loadTakenSlots()
  }, [selectedProfessionalId])

  useEffect(() => {
    setSelectedSlotId('')
  }, [selectedProfessionalId])

  const availableSlots = useMemo(() => {
    return openSlots.filter((slot) => {
      const slotStart = new Date(slot.start_time).getTime()
      const slotEnd = new Date(slot.end_time).getTime()
      return !bookedAppointments.some((appointment) => {
        const appointmentStart = new Date(appointment.start_time).getTime()
        const appointmentEnd = new Date(appointment.end_time).getTime()
        return slotStart < appointmentEnd && slotEnd > appointmentStart
      })
    })
  }, [openSlots, bookedAppointments])

  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.id === selectedSlotId) ?? null,
    [availableSlots, selectedSlotId]
  )

  const save = async () => {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!selectedSlot) {
      setError('Vælg et ledigt tidspunkt.')
      setSaving(false)
      return
    }

    if (freePlanBookingBlocked) {
      setError(freePlanBookingHint ?? 'Du kan ikke booke flere tider på gratis abonnement.')
      setSaving(false)
      return
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle()
    const rawTier = profileRow?.subscription_tier ?? 'free'
    const normalizedTier =
      rawTier === 'starter'
        ? 'free'
        : rawTier === 'plus' || rawTier === 'premium'
          ? 'pro'
          : rawTier
    if (normalizedTier === 'free') {
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['requested', 'confirmed'])
      if ((count ?? 0) >= 1) {
        setSaving(false)
        setError(
          'Med gratis abonnement kan du kun booke én konsultation ad gangen. Opgrader til Pro på dit dashboard, eller aflys din nuværende tid først.'
        )
        return
      }
    }

    const { data: claimedSlots, error: claimError } = await supabase
      .from('professional_open_slots')
      .update({ is_booked: true })
      .eq('id', selectedSlot.id)
      .eq('professional_id', selectedProfessionalId)
      .eq('is_booked', false)
      .select('id,start_time,end_time')
      .limit(1)

    if (claimError || !claimedSlots || claimedSlots.length === 0) {
      setSaving(false)
      setError('Tiden blev lige booket af en anden. Vælg venligst en ny tid.')
      return
    }

    const claimed = claimedSlots[0] as { id: string; start_time: string; end_time: string }
    const startTime = new Date(claimed.start_time)
    const endTime = new Date(claimed.end_time)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      await supabase
        .from('professional_open_slots')
        .update({ is_booked: false })
        .eq('id', claimed.id)
        .eq('professional_id', selectedProfessionalId)
      setSaving(false)
      setError('Du skal være logget ind for at booke. Prøv at logge ind igen.')
      return
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
        professionalId: selectedProfessionalId,
      }),
    })

    const meetPayload = (await meetRes.json().catch(() => ({}))) as {
      googleMeetUrl?: string
      meetOpenAt?: string
      error?: string
    }

    if (!meetRes.ok || !meetPayload.googleMeetUrl || !meetPayload.meetOpenAt) {
      await supabase
        .from('professional_open_slots')
        .update({ is_booked: false })
        .eq('id', claimed.id)
        .eq('professional_id', selectedProfessionalId)
      setSaving(false)
      setError(
        meetPayload.error ??
          'Kunne ikke oprette videomøde (Google Calendar). Tjek server-konfiguration eller prøv igen.'
      )
      return
    }

    const { error: insertError } = await supabase
      .from('appointments')
      .insert({
        user_id: user.id,
        professional_id: selectedProfessionalId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'requested',
        google_meet_url: meetPayload.googleMeetUrl,
        meet_open_at: meetPayload.meetOpenAt,
      })

    if (insertError) {
      await supabase
        .from('professional_open_slots')
        .update({ is_booked: false })
        .eq('id', claimed.id)
        .eq('professional_id', selectedProfessionalId)
    }

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.push('/userdashboard')
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-black text-slate-900">Book tid</h1>
      {professional && (
        <p className="mb-4 text-gray-600">
          Vælger tid hos: <span className="font-medium">{professional.full_name ?? 'Gynækolog'}</span>
          {professional.title ? ` (${professional.title})` : ''}
        </p>
      )}

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      {freePlanBookingBlocked && freePlanBookingHint && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="mb-2">{freePlanBookingHint}</p>
          <Link href="/userdashboard" className="font-medium text-amber-900 underline">
            Gå til dashboard og abonnement →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        <select
          className="border p-2 w-full"
          value={selectedProfessionalId}
          onChange={(e) => setSelectedProfessionalId(e.target.value)}
        >
          {professionals.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {(p.full_name ?? 'Gynækolog') + (p.title ? ` (${p.title})` : '')}
            </option>
          ))}
        </select>
        <div>
          <div className="mb-2 text-sm font-medium">Ledige tider</div>
          {loadingSlots ? (
            <div className="text-sm text-gray-600">Finder ledige tider...</div>
          ) : availableSlots.length === 0 ? (
            <div className="rounded border bg-gray-50 p-3 text-sm text-gray-600">
              Ingen ledige tider for denne gynækolog.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableSlots.map((slot) => {
                const selected = selectedSlotId === slot.id
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={[
                      'rounded border px-3 py-2 text-sm text-left',
                      selected ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {new Date(slot.start_time).toLocaleDateString('da-DK')} ·{' '}
                    {new Date(slot.start_time).toLocaleTimeString('da-DK', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving || freePlanBookingBlocked}
          className="bg-black text-white rounded px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Opretter...' : 'Send booking'}
        </button>
      </div>
    </div>
  )
}
