'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './patientDetail.module.css'

type PatientProfile = {
  id: string
  full_name: string | null
  symptoms: string[] | null
  health_conditions: string[] | null
  medications: string | null
  additional_notes: string | null
}

type Prescription = {
  id: string
  medication_name: string
  dosage: string | null
  instructions: string | null
  issued_at: string
}

type HealthLog = {
  id: string
  created_at: string
  symptom_scores: Record<string, number>
  health_conditions: string[] | null
  notes: string | null
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

const formatDobFromCpr = (cpr: string | null | undefined): string => {
  if (!cpr) return '-'
  const digits = cpr.replace(/\D/g, '')
  if (digits.length < 6) return '-'
  const dd = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const yy = Number(digits.slice(4, 6))
  if (!dd || !mm || Number.isNaN(yy)) return '-'
  const currentYY = new Date().getFullYear() % 100
  const year = yy > currentYY ? 1900 + yy : 2000 + yy
  const dob = new Date(year, mm - 1, dd)
  if (dob.getFullYear() !== year || dob.getMonth() !== mm - 1 || dob.getDate() !== dd) return '-'
  return dob.toLocaleDateString('da-DK')
}

const getAgeFromCpr = (cpr: string | null | undefined): string => {
  if (!cpr) return '-'
  const digits = cpr.replace(/\D/g, '')
  if (digits.length < 6) return '-'
  const dd = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const yy = Number(digits.slice(4, 6))
  if (!dd || !mm || Number.isNaN(yy)) return '-'
  const now = new Date()
  const currentYY = now.getFullYear() % 100
  const year = yy > currentYY ? 1900 + yy : 2000 + yy
  let age = now.getFullYear() - year
  const hasHadBirthday = now.getMonth() > mm - 1 || (now.getMonth() === mm - 1 && now.getDate() >= dd)
  if (!hasHadBirthday) age -= 1
  return String(age)
}

function averageSymptomScore(scores: Record<string, number> | null | undefined): number | null {
  const vals = Object.values(scores ?? {}).filter((n) => typeof n === 'number' && !Number.isNaN(n))
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default function PatientDetailClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams<{ patientId: string }>()
  const patientId = params?.patientId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [cpr, setCpr] = useState<string | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
  const [historyMessages, setHistoryMessages] = useState<Message[]>([])
  const [openHealthLogIds, setOpenHealthLogIds] = useState<Record<string, boolean>>({})

  const displayName = useMemo(
    () => searchParams.get('name') ?? profile?.full_name ?? 'Patient',
    [searchParams, profile?.full_name]
  )

  useEffect(() => {
    const load = async () => {
      if (!patientId) return
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Ikke logget ind')
        setLoading(false)
        return
      }

      const [profileRes, vaultRes, rxRes, logsRes, convRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,full_name,symptoms,health_conditions,medications,additional_notes')
          .eq('id', patientId)
          .maybeSingle(),
        supabase.from('user_cpr_vault').select('cpr_ciphertext').eq('user_id', patientId).maybeSingle(),
        supabase
          .from('prescriptions')
          .select('id,medication_name,dosage,instructions,issued_at')
          .eq('patient_id', patientId)
          .order('issued_at', { ascending: false }),
        supabase
          .from('user_health_condition_logs')
          .select('id,created_at,symptom_scores,health_conditions,notes')
          .eq('user_id', patientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversations')
          .select('id')
          .eq('patient_id', patientId)
          .eq('doctor_id', user.id)
          .maybeSingle(),
      ])

      if (profileRes.error) {
        setError(profileRes.error.message)
        setLoading(false)
        return
      }
      if (!profileRes.data) {
        setError('Patient ikke fundet')
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(profileRes.data as PatientProfile)
      const vaultRow = vaultRes.data as { cpr_ciphertext: string | null } | null
      setCpr(vaultRow?.cpr_ciphertext ?? null)

      if (rxRes.error) setPrescriptions([])
      else setPrescriptions((rxRes.data ?? []) as Prescription[])

      if (logsRes.error) setHealthLogs([])
      else setHealthLogs((logsRes.data ?? []) as HealthLog[])

      const conv = convRes.data as { id: string } | null
      if (conv?.id) {
        const { data: msgRows, error: msgErr } = await supabase
          .from('messages')
          .select('id,conversation_id,sender_id,body,created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(50)
        if (!msgErr) setHistoryMessages((msgRows ?? []) as Message[])
        else setHistoryMessages([])
      } else {
        setHistoryMessages([])
      }

      setLoading(false)
    }

    void load()
  }, [patientId])

  const goBack = () => {
    const base = pathname.replace(/\/patients\/[^/]+$/, '')
    router.push(`${base}?view=patients`)
  }

  const allLogIds = healthLogs.map((l) => l.id)
  const allExpanded = allLogIds.length > 0 && allLogIds.every((id) => openHealthLogIds[id])
  const graphLogs = useMemo(() => {
    return [...healthLogs]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-7)
  }, [healthLogs])
  const graphPoints = useMemo(() => {
    const width = 620
    const height = 220
    const padLeft = 36
    const padRight = 16
    const padTop = 14
    const padBottom = 28
    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom
    const xStep = graphLogs.length > 1 ? plotWidth / (graphLogs.length - 1) : 0
    const toY = (value: number) => padTop + ((10 - value) / 10) * plotHeight

    const series = [
      { key: 'hedeture', label: 'Hedeture', color: '#D1826A' },
      { key: 'soevnkvalitet', label: 'Søvn', color: '#6C8F7D' },
      { key: 'energiniveau', label: 'Energi', color: '#95B0A0' },
    ] as const

    const pointsBySeries = series.map((serie) => {
      const points = graphLogs.map((log, index) => {
        const value = Number(log.symptom_scores?.[serie.key] ?? 0)
        return {
          x: padLeft + xStep * index,
          y: toY(value),
          value,
        }
      })
      return {
        ...serie,
        points,
        path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' '),
      }
    })

    const ticks = [0, 2, 4, 6, 8, 10]
    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotWidth,
      plotHeight,
      ticks,
      pointsBySeries,
      labels: graphLogs.map((log) =>
        new Date(log.created_at).toLocaleDateString('da-DK', { month: 'short', day: '2-digit' })
      ),
    }
  }, [graphLogs])

  const toggleAllLogs = () => {
    if (allExpanded) {
      setOpenHealthLogIds({})
    } else {
      const next: Record<string, boolean> = {}
      for (const id of allLogIds) next[id] = true
      setOpenHealthLogIds(next)
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <p className={styles.state}>Indlæser patient…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <button type="button" className={styles.backBtn} onClick={goBack}>
          ← Tilbage
        </button>
        <p className={styles.state}>{error}</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <button type="button" className={styles.backBtn} onClick={goBack}>
        ← Tilbage til patienter
      </button>

      <div className={styles.card}>
        <h1 className={styles.title}>{displayName}</h1>
        <p className={styles.meta}>
          Alder: {getAgeFromCpr(cpr)} · Fødselsdato (CPR): {formatDobFromCpr(cpr)}
        </p>

        {profile?.symptoms && profile.symptoms.length > 0 && (
          <section style={{ marginTop: 12 }}>
            <h2 className={styles.sectionTitle}>Symptomer</h2>
            <div className={styles.chips}>
              {profile.symptoms.map((s) => (
                <span key={s} className={styles.chip}>
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {profile?.health_conditions && profile.health_conditions.length > 0 && (
          <section style={{ marginTop: 12 }}>
            <h2 className={styles.sectionTitle}>Helbredstilstande</h2>
            <div className={styles.chips}>
              {profile.health_conditions.map((s) => (
                <span key={s} className={styles.chip}>
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {(profile?.medications?.trim() || profile?.additional_notes?.trim()) && (
          <section style={{ marginTop: 12 }}>
            {profile?.medications?.trim() ? (
              <>
                <h2 className={styles.sectionTitle}>Medicin</h2>
                <p className={styles.text}>{profile.medications}</p>
              </>
            ) : null}
            {profile?.additional_notes?.trim() ? (
              <>
                <h2 className={styles.sectionTitle} style={{ marginTop: 10 }}>
                  Noter
                </h2>
                <p className={styles.text}>{profile.additional_notes}</p>
              </>
            ) : null}
          </section>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Recepter</h2>
        {prescriptions.length === 0 ? (
          <p className={styles.empty}>Ingen recepter registreret.</p>
        ) : (
          <div className={styles.list}>
            {prescriptions.map((rx) => (
              <div key={rx.id} className={styles.listItem}>
                <div className={styles.itemTitle}>{rx.medication_name}</div>
                <div className={styles.itemMeta}>
                  {new Date(rx.issued_at).toLocaleString('da-DK')}
                  {rx.dosage ? ` · ${rx.dosage}` : ''}
                </div>
                {rx.instructions ? <p className={styles.itemText}>{rx.instructions}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.logSectionHeader}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            Sundhedslog
          </h2>
          {healthLogs.length > 0 ? (
            <button type="button" className={styles.toggleAllBtn} onClick={toggleAllLogs}>
              {allExpanded ? 'Skjul alle' : 'Vis alle'}
            </button>
          ) : null}
        </div>
        {healthLogs.length === 0 ? (
          <p className={styles.empty}>Ingen logposter.</p>
        ) : (
          <div className={styles.list}>
            {graphLogs.length >= 2 ? (
              <div className={styles.graphCard}>
                <div className={styles.graphWrap}>
                  <svg viewBox={`0 0 ${graphPoints.width} ${graphPoints.height}`} width="100%" height="auto">
                    {graphPoints.ticks.map((tick) => {
                      const y = graphPoints.padTop + ((10 - tick) / 10) * graphPoints.plotHeight
                      return (
                        <g key={tick}>
                          <line
                            x1={graphPoints.padLeft}
                            y1={y}
                            x2={graphPoints.width - graphPoints.padRight}
                            y2={y}
                            stroke="#E5E7EB"
                            strokeDasharray="2 3"
                          />
                          <text x={8} y={y + 4} fill="#6B7280" fontSize="10">
                            {tick}
                          </text>
                        </g>
                      )
                    })}

                    {graphPoints.labels.map((label, index) => {
                      const x =
                        graphPoints.padLeft +
                        (graphPoints.labels.length > 1
                          ? (graphPoints.plotWidth / (graphPoints.labels.length - 1)) * index
                          : 0)
                      return (
                        <text
                          key={`${label}-${index}`}
                          x={x}
                          y={graphPoints.height - 8}
                          fill="#6B7280"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {label}
                        </text>
                      )
                    })}

                    {graphPoints.pointsBySeries.map((serie) => (
                      <g key={serie.key}>
                        <path d={serie.path} fill="none" stroke={serie.color} strokeWidth="2.25" />
                        {serie.points.map((point, index) => (
                          <circle key={`${serie.key}-${index}`} cx={point.x} cy={point.y} r="3.5" fill={serie.color} />
                        ))}
                      </g>
                    ))}
                  </svg>
                </div>
                <div className={styles.legendRow}>
                  {graphPoints.pointsBySeries.map((serie) => (
                    <div key={serie.key}>
                      <span className={styles.legendDot} style={{ backgroundColor: serie.color }} />
                      <span>{serie.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {healthLogs.map((log) => {
              const open = !!openHealthLogIds[log.id]
              const avg = averageSymptomScore(log.symptom_scores)
              return (
                <div key={log.id} className={styles.listItem}>
                  <button
                    type="button"
                    className={styles.logHeader}
                    onClick={() =>
                      setOpenHealthLogIds((prev) => ({
                        ...prev,
                        [log.id]: !prev[log.id],
                      }))
                    }
                  >
                    <span className={`${styles.switch} ${open ? styles.switchOn : ''}`}>
                      <span className={styles.switchKnob} />
                    </span>
                    <div>
                      <div className={styles.itemTitle}>
                        {new Date(log.created_at).toLocaleString('da-DK')}
                      </div>
                      {avg != null ? (
                        <div className={styles.avgScore}>Gns. symptomscore: {avg}</div>
                      ) : null}
                    </div>
                  </button>
                  {open ? (
                    <div className={styles.logBody}>
                      {log.health_conditions && log.health_conditions.length > 0 ? (
                        <div className={styles.chips} style={{ marginBottom: 8 }}>
                          {log.health_conditions.map((c) => (
                            <span key={c} className={styles.chip}>
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {log.notes ? <p className={styles.itemText}>{log.notes}</p> : null}
                      {log.symptom_scores && Object.keys(log.symptom_scores).length > 0 ? (
                        <ul className={styles.list} style={{ marginTop: 8 }}>
                          {Object.entries(log.symptom_scores).map(([k, v]) => (
                            <li key={k} className={styles.itemMeta}>
                              {k}: {v}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Seneste beskeder</h2>
        {historyMessages.length === 0 ? (
          <p className={styles.empty}>Ingen beskeder i tråden.</p>
        ) : (
          <div className={styles.list}>
            {historyMessages.map((m) => (
              <div key={m.id} className={styles.listItem}>
                <div className={styles.itemMeta}>
                  {new Date(m.created_at).toLocaleString('da-DK')}
                  {m.sender_id === patientId ? ' · Patient' : ' · Dig'}
                </div>
                <p className={styles.itemText}>{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
