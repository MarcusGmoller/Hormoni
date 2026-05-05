'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './professionalsPage.module.css'

type Professional = {
  user_id: string
  title: string | null
  bio: string | null
  professional_name: string | null
  public_profile: boolean
  full_name: string | null
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

const CONSULTATION_MINUTES = 20
const BUFFER_MINUTES = 5
const SLOT_STEP_MINUTES = CONSULTATION_MINUTES + BUFFER_MINUTES
const CONSULTATION_MS = CONSULTATION_MINUTES * 60 * 1000
const SLOT_STEP_MS = SLOT_STEP_MINUTES * 60 * 1000

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB && endA > startB

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

      const nextProfessionals = ((professionals as any[]) ?? []).map((item) => ({
        ...item,
        full_name: item.professional_name ?? null,
      })) as Professional[]

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
                  <div style={{ marginTop: 10, fontSize: 13, color: '#475569' }}>
                    {slotStartsByProfessional[p.user_id]?.length ? (
                      <>
                        <strong style={{ color: '#334155' }}>Ledige tider:</strong>{' '}
                        {slotStartsByProfessional[p.user_id].slice(0, 5).map((slotStart, index) => (
                          <span key={slotStart}>
                            <button
                              type="button"
                              onClick={() => router.push(`/book/${p.user_id}?slotStart=${slotStart}`)}
                              style={{
                                color: '#0f172a',
                                textDecoration: 'underline',
                                background: 'transparent',
                                border: 0,
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                            >
                              {new Date(slotStart).toLocaleString('da-DK', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </button>
                            {index < Math.min(slotStartsByProfessional[p.user_id].length, 5) - 1 ? ' · ' : ''}
                          </span>
                        ))}
                        {slotStartsByProfessional[p.user_id].length > 5
                          ? ` (+${slotStartsByProfessional[p.user_id].length - 5} flere)`
                          : ''}
                      </>
                    ) : (
                      <span>Ingen ledige tider lige nu.</span>
                    )}
                  </div>
                </div>
                <div className={styles.cardAside}>
                  <button type="button" className={styles.bookBtn} onClick={() => router.push(`/book/${p.user_id}`)}>
                    Book tid
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
