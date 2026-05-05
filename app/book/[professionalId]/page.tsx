'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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

type DerivedOpenSlot = {
  id: string
  start_time: string
  end_time: string
}

const CONSULTATION_MINUTES = 20
const BUFFER_MINUTES = 5
const SLOT_STEP_MINUTES = CONSULTATION_MINUTES + BUFFER_MINUTES
const CONSULTATION_MS = CONSULTATION_MINUTES * 60 * 1000
const SLOT_STEP_MS = SLOT_STEP_MINUTES * 60 * 1000

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB && endA > startB

export default function BookPage() {
  const router = useRouter()
  const params = useParams<{ professionalId: string }>()
  const searchParams = useSearchParams()
  const professionalId = params.professionalId
  const preselectedSlotStart = searchParams.get('slotStart')

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
        .select('user_id,title,professional_name,public_profile,approval_status')
        .eq('public_profile', true)
        .eq('approval_status', 'approved')

      if (prosError) {
        setError(prosError.message)
        return
      }

      const professionalsBase = (prosRows ?? []) as Array<{
        user_id: string
        title: string | null
        professional_name: string | null
        public_profile: boolean
      }>
      const ids = professionalsBase.map((p) => p.user_id)
      if (ids.length === 0) {
        setProfessionals([])
        return
      }

      const merged = professionalsBase.map((p) => ({
        user_id: p.user_id,
        title: p.title,
        full_name: p.professional_name ?? null,
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
        .select('user_id,title,professional_name,approval_status')
        .eq('user_id', selectedProfessionalId)
        .eq('approval_status', 'approved')
        .maybeSingle()

      if (error) {
        setError(error.message)
        return
      }

      const professionalData =
        (data as { user_id: string; title: string | null; professional_name: string | null } | null) ?? null
      if (!professionalData) {
        setProfessional(null)
        return
      }

      setProfessional({
        user_id: professionalData.user_id,
        title: professionalData.title,
        full_name: professionalData.professional_name ?? null,
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

  const expandedSlots = useMemo<DerivedOpenSlot[]>(() => {
    const nowMs = Date.now()
    const derived: DerivedOpenSlot[] = []

    for (const slot of openSlots) {
      const windowStart = new Date(slot.start_time).getTime()
      const windowEnd = new Date(slot.end_time).getTime()
      if (Number.isNaN(windowStart) || Number.isNaN(windowEnd) || windowEnd <= windowStart) continue

      let chunkStart = windowStart
      while (chunkStart + CONSULTATION_MS <= windowEnd) {
        if (chunkStart >= nowMs) {
          const chunkEnd = chunkStart + CONSULTATION_MS
          const isoStart = new Date(chunkStart).toISOString()
          const isoEnd = new Date(chunkEnd).toISOString()
          derived.push({
            id: `${slot.id}__${isoStart}`,
            start_time: isoStart,
            end_time: isoEnd,
          })
        }
        chunkStart += SLOT_STEP_MS
      }
    }

    return derived.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [openSlots])

  const availableSlots = useMemo(() => {
    return expandedSlots.filter((slot) => {
      const slotStart = new Date(slot.start_time).getTime()
      const slotEnd = new Date(slot.end_time).getTime()
      return !bookedAppointments.some((appointment) =>
        rangesOverlap(
          slotStart,
          slotEnd,
          new Date(appointment.start_time).getTime(),
          new Date(appointment.end_time).getTime()
        )
      )
    })
  }, [expandedSlots, bookedAppointments])

  useEffect(() => {
    if (!preselectedSlotStart) return
    const targetStart = Number(preselectedSlotStart)
    if (!Number.isFinite(targetStart)) return
    const targetIso = new Date(targetStart).toISOString()
    const match = availableSlots.find((slot) => slot.start_time === targetIso)
    if (match) setSelectedSlotId(match.id)
  }, [preselectedSlotStart, availableSlots])

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

    const { data: overlappingRows, error: overlappingError } = await supabase
      .from('appointments')
      .select('id')
      .eq('professional_id', selectedProfessionalId)
      .in('status', ['requested', 'confirmed'])
      .lt('start_time', selectedSlot.end_time)
      .gt('end_time', selectedSlot.start_time)
      .limit(1)

    if (overlappingError) {
      setSaving(false)
      setError(overlappingError.message)
      return
    }

    if ((overlappingRows ?? []).length > 0) {
      setSaving(false)
      setError('Tiden blev lige booket af en anden. Vælg venligst en ny tid.')
      return
    }

    const startTime = new Date(selectedSlot.start_time)
    const endTime = new Date(selectedSlot.end_time)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
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
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSaving(false)
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
