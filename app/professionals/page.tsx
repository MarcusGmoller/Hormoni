'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  getPatientBookingBlockState,
  PATIENT_BOOKING_CONSULTATION_MINUTES,
  patientBookConsultationSlot,
} from '@/lib/patientBookConsultation'
import styles from './professionalsPage.module.css'

type Professional = {
  user_id: string
  title: string | null
  bio: string | null
  professional_name: string | null
  public_profile: boolean
  approval_status: string
  full_name: string | null
}

type ProfessionalRowDb = {
  user_id: string
  title: string | null
  bio: string | null
  professional_name: string | null
  public_profile: boolean
  approval_status: string
}

type OpenSlot = {
  professional_id: string
  start_time: string
  end_time: string
}

type Appointment = {
  professional_id: string
  start_time: string
  end_time: string
  status: string
}

const CONSULTATION_MINUTES = PATIENT_BOOKING_CONSULTATION_MINUTES
const BUFFER_MINUTES = 5
const SLOT_STEP_MINUTES = CONSULTATION_MINUTES + BUFFER_MINUTES
const CONSULTATION_MS = CONSULTATION_MINUTES * 60 * 1000
const SLOT_STEP_MS = SLOT_STEP_MINUTES * 60 * 1000

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB && endA > startB

const localDayKey = (ms: number) => {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const startOfLocalDay = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const formatDayHeading = (firstSlotMs: number) => {
  const d = new Date(firstSlotMs)
  const today0 = startOfLocalDay(Date.now())
  const slotDay0 = startOfLocalDay(firstSlotMs)
  const tomorrow0 = today0 + 24 * 60 * 60 * 1000
  if (slotDay0 === today0) return 'I dag'
  if (slotDay0 === tomorrow0) return 'I morgen'
  const weekday = d.toLocaleDateString('da-DK', { weekday: 'long' })
  const capitalized = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : ''
  const rest = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })
  return `${capitalized} ${rest}`
}

const formatSlotTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })

/** Konsultationslængde matcher `expandOpenSlotWindows` (CONSULTATION_MINUTES). */
const formatSlotTimeRange = (startMs: number) => {
  const endMs = startMs + CONSULTATION_MS
  return `${formatSlotTime(startMs)}–${formatSlotTime(endMs)}`
}

const formatSlotAriaLabel = (startMs: number) => {
  const endMs = startMs + CONSULTATION_MS
  const dayPart = new Date(startMs).toLocaleString('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return `Book tid ${dayPart} kl. ${formatSlotTime(startMs)}–${formatSlotTime(endMs)}`
}

const formatBookingSummaryLine = (startMs: number) => {
  const endMs = startMs + CONSULTATION_MS
  const dayPart = new Date(startMs).toLocaleString('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const capitalized = dayPart ? dayPart.charAt(0).toUpperCase() + dayPart.slice(1) : ''
  return `${capitalized} kl. ${formatSlotTime(startMs)}–${formatSlotTime(endMs)}`
}

type DaySlotGroup = { key: string; label: string; starts: number[] }

type BookingModalState = {
  professionalId: string
  professionalName: string
  title: string | null
  slotStartMs: number
}

const groupSlotStartsByDay = (startsMs: number[]): DaySlotGroup[] => {
  const map = new Map<string, number[]>()
  for (const ms of startsMs) {
    const key = localDayKey(ms)
    const arr = map.get(key) ?? []
    arr.push(ms)
    map.set(key, arr)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayStarts]) => {
      const sorted = [...dayStarts].sort((x, y) => x - y)
      return {
        key,
        label: formatDayHeading(sorted[0]),
        starts: sorted,
      }
    })
}

const expandOpenSlotWindows = (slots: OpenSlot[]) => {
  const nowMs = Date.now()
  const chunksByProfessional = new Map<string, number[]>()

  for (const slot of slots) {
    const windowStart = new Date(slot.start_time).getTime()
    const windowEnd = new Date(slot.end_time).getTime()
    if (Number.isNaN(windowStart) || Number.isNaN(windowEnd) || windowEnd <= windowStart) continue

    let chunkStart = windowStart
    while (chunkStart + CONSULTATION_MS <= windowEnd) {
      if (chunkStart >= nowMs) {
        const current = chunksByProfessional.get(slot.professional_id) ?? []
        current.push(chunkStart)
        chunksByProfessional.set(slot.professional_id, current)
      }
      chunkStart += SLOT_STEP_MS
    }
  }

  for (const [professionalId, starts] of chunksByProfessional) {
    const uniqueSorted = Array.from(new Set(starts)).sort((a, b) => a - b)
    chunksByProfessional.set(professionalId, uniqueSorted)
  }

  return chunksByProfessional
}

export default function ProfessionalsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Professional[]>([])
  const [slotStartsByProfessional, setSlotStartsByProfessional] = useState<Record<string, number[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [bookingModal, setBookingModal] = useState<BookingModalState | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [freePlanBlocked, setFreePlanBlocked] = useState(false)
  const [freePlanHint, setFreePlanHint] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { blocked, hint } = await getPatientBookingBlockState(supabase)
      setFreePlanBlocked(blocked)
      setFreePlanHint(hint)
    })()
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: professionals, error: loadError } = await supabase
        .from('professionals')
        .select('user_id,title,bio,professional_name,public_profile,approval_status')
        .eq('public_profile', true)
        .eq('approval_status', 'approved')

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      const nextProfessionals: Professional[] = ((professionals ?? []) as ProfessionalRowDb[]).map((item) => ({
        ...item,
        full_name: item.professional_name ?? null,
      }))

      const professionalIds = nextProfessionals.map((professional) => professional.user_id)
      if (professionalIds.length === 0) {
        setItems(nextProfessionals)
        setSlotStartsByProfessional({})
        setLoading(false)
        return
      }

      const mergedProfessionals = nextProfessionals
      setItems(mergedProfessionals)

      const nowIso = new Date().toISOString()
      const mergedProfessionalIds = mergedProfessionals.map((professional) => professional.user_id)
      const [{ data: openSlotRows }, { data: appointmentRows }] = await Promise.all([
        supabase
          .from('professional_open_slots')
          .select('professional_id,start_time,end_time')
          .eq('is_booked', false)
          .in('professional_id', mergedProfessionalIds)
          .gte('end_time', nowIso),
        supabase
          .from('appointments')
          .select('professional_id,start_time,end_time,status')
          .in('professional_id', mergedProfessionalIds)
          .in('status', ['requested', 'confirmed'])
          .gte('end_time', nowIso),
      ])

      const expandedStarts = expandOpenSlotWindows((openSlotRows ?? []) as OpenSlot[])
      const appointmentsByProfessional = ((appointmentRows ?? []) as Appointment[]).reduce<Record<string, Appointment[]>>(
        (acc, appointment) => {
          const current = acc[appointment.professional_id] ?? []
          current.push(appointment)
          acc[appointment.professional_id] = current
          return acc
        },
        {}
      )

      const visibleStartsByProfessional: Record<string, number[]> = {}
      for (const professionalId of mergedProfessionalIds) {
        const appointments = appointmentsByProfessional[professionalId] ?? []
        const starts = expandedStarts.get(professionalId) ?? []
        visibleStartsByProfessional[professionalId] = starts.filter((startMs) => {
          const endMs = startMs + CONSULTATION_MS
          return !appointments.some((appointment) =>
            rangesOverlap(
              startMs,
              endMs,
              new Date(appointment.start_time).getTime(),
              new Date(appointment.end_time).getTime()
            )
          )
        })
      }
      setSlotStartsByProfessional(visibleStartsByProfessional)
      setLoading(false)
    }

    run()
  }, [])

  const openBookingModal = async (p: Professional, slotStartMs: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { blocked, hint } = await getPatientBookingBlockState(supabase)
    setFreePlanBlocked(blocked)
    setFreePlanHint(hint)
    setModalError(null)
    setBookingModal({
      professionalId: p.user_id,
      professionalName: p.full_name ?? 'Behandler',
      title: p.title ?? null,
      slotStartMs,
    })
  }

  const closeBookingModal = () => {
    setBookingModal(null)
    setModalError(null)
    setBookingSubmitting(false)
  }

  const confirmBooking = async () => {
    if (!bookingModal || freePlanBlocked) return
    setBookingSubmitting(true)
    setModalError(null)
    const result = await patientBookConsultationSlot(supabase, {
      professionalId: bookingModal.professionalId,
      slotStartMs: bookingModal.slotStartMs,
    })
    setBookingSubmitting(false)
    if (!result.ok) {
      if (result.kind === 'auth') {
        router.push('/login')
        return
      }
      setModalError(result.error)
      return
    }
    router.push('/userdashboard')
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Book konsultation</h1>
          <p className={styles.lead}>Vælg en gynækolog og book et tidspunkt til video-konsultation.</p>
        </div>
      </header>

      <section className={styles.content}>
        {error && <div className={styles.errorBanner}>Fejl: {error}</div>}

        {loading ? (
          <p className={styles.loading}>Henter gynækologer…</p>
        ) : items.length === 0 && !error ? (
          <div className={styles.empty}>Ingen offentlige profiler at vise lige nu.</div>
        ) : (
          <div className={styles.list}>
            {items.map((p) => (
              <article key={p.user_id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.name}>{p.full_name ?? 'Ukendt navn'}</div>
                  {p.title ? <div className={styles.titleLine}>{p.title}</div> : null}
                  {p.bio ? (
                    <p className={styles.bio}>{p.bio}</p>
                  ) : (
                    <p className={styles.bio} style={{ color: '#94a3b8' }}>
                      Ingen bio angivet.
                    </p>
                  )}
                  {(() => {
                    const starts = slotStartsByProfessional[p.user_id] ?? []
                    if (!starts.length) {
                      return <div className={styles.noSlots}>Ingen ledige tider lige nu.</div>
                    }
                    const byDay = groupSlotStartsByDay(starts)
                    return (
                      <div className={styles.slotsSection}>
                        <h2 className={styles.slotsHeading}>Ledige tider</h2>
                        {byDay.map((day) => (
                          <div key={day.key} className={styles.slotsDayBlock}>
                            <div className={styles.slotsDayLabel}>{day.label}</div>
                            <div className={styles.slotsChipRow}>
                              {day.starts.map((slotStart) => (
                                <button
                                  key={slotStart}
                                  type="button"
                                  className={styles.slotChip}
                                  aria-label={formatSlotAriaLabel(slotStart)}
                                  onClick={() => void openBookingModal(p, slotStart)}
                                >
                                  {formatSlotTimeRange(slotStart)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {bookingModal ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBookingModal()
          }}
        >
          <div
            className={styles.modalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="booking-modal-title" className={styles.modalTitle}>
              Book video-konsultation
            </h2>
            <p className={styles.modalSubtitle}>
              Hos <strong>{bookingModal.professionalName}</strong>
              {bookingModal.title ? ` · ${bookingModal.title}` : ''}
            </p>
            <p className={styles.modalTime}>{formatBookingSummaryLine(bookingModal.slotStartMs)}</p>
            <ul className={styles.modalList}>
              <li>Konsultationen foregår online som videosamtale (Google Meet).</li>
              <li>Varighed ca. {PATIENT_BOOKING_CONSULTATION_MINUTES} minutter — som vist i tidsrummet.</li>
              <li>Dette er en forespørgsel: behandleren skal godkende tiden. Du får besked, når den er bekræftet.</li>
              <li>Praktisk info og mødelink finder du på dit dashboard efter booking.</li>
            </ul>
            {freePlanBlocked && freePlanHint ? <div className={styles.modalWarn}>{freePlanHint}</div> : null}
            {modalError ? <div className={styles.modalErr}>{modalError}</div> : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                disabled={bookingSubmitting}
                onClick={closeBookingModal}
              >
                Annuller
              </button>
              <button
                type="button"
                className={styles.modalBtnPrimary}
                disabled={bookingSubmitting || freePlanBlocked}
                onClick={() => void confirmBooking()}
              >
                {bookingSubmitting ? 'Booker…' : 'Book denne tid'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
