'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './dashboardPage.module.css'

const appointmentStatusDa = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'Bekræftet'
    case 'requested':
      return 'Afventer bekræftelse fra behandler'
    case 'cancelled':
      return 'Aflyst'
    default:
      return status
  }
}

type PlanRow = { id: string; name: string }

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: 'requested' | 'confirmed' | 'cancelled' | string
  professional_id: string
  notes?: string | null
  google_meet_url?: string | null
  meet_open_at?: string | null
}

type Message = {
  id: string
  body: string
  created_at: string
  sender_id: string
  conversation_id: string
}

type Conversation = {
  id: string
  patient_id: string
  doctor_id: string
  created_from_appointment_id: string | null
}

type Prescription = {
  id: string
  medication_name: string
  dosage: string | null
  instructions: string | null
  issued_at: string
  doctor_id: string
}

type HealthConditionLog = {
  id: string
  created_at: string
  symptom_scores: Record<string, number>
}

const treatmentJourneySteps = [
  {
    id: 'start',
    title: 'Start og første konsultation',
    summary: 'Book tid, forbered dig og mød op til video eller fremmøde.',
    body: [
      'Book en tid hos din gynækolog via “Book konsultation”. Du får besked, når tiden er bekræftet.',
      'Skriv gerne spørgsmål ned på forhånd, og hav dine helbredsoplysninger ved hånden. Det gør samtalen mere rolig og effektiv.',
      'Konsultationen er fortrolig. Du kan altid bede om forklaring af ord og anbefalinger undervejs.',
    ],
  },
  {
    id: 'plan',
    title: 'Udredning og behandlingsplan',
    summary: 'Sammen finder I årsag, muligheder og næste skridt.',
    body: [
      'Behandleren tager udgangspunkt i dine symptomer, sygehistorie og eventuelle prøver. I aftaler, hvad der giver mening for dig.',
      'Der kan være flere gode veje — medicin, livsstil, opfølgning eller kombinationer. Du skal vide, hvad du kan forvente de næste uger.',
    ],
  },
  {
    id: 'treatment',
    title: 'Behandling i gang',
    summary: 'Følg planen, notér virkning og kontakt ved tvivl.',
    body: [
      'Hvis du får medicin eller anden behandling, følg den vejledning, du har fået. Gem recept og dosering et sted, du nemt finder dem.',
      'Bivirkninger eller nye symptomer, der bekymrer dig, skal du tage alvorligt — skriv til behandler via beskeder eller ring efter aftale.',
    ],
  },
  {
    id: 'symptoms',
    title: 'Symptomtræning og egne noter',
    summary: 'Små registreringer giver bedre overblik over din udvikling.',
    body: [
      'Under “Symptomtræning” kan du logge, hvordan du har det over tid. Det hjælper både dig og gynækologen med at se mønstre.',
      'Jo mere regelmæssigt du registrerer, jo mere meningsfuldt bliver grafen på dit dashboard.',
    ],
  },
  {
    id: 'followup',
    title: 'Opfølgning og kontakt',
    summary: 'Hold kontakten — aftaler, beskeder og næste skridt.',
    body: [
      'Du kan skrive til din behandler under “Beskeder”, når I har en samtale kørende. Brug det til korte, konkrete spørgsmål.',
      'Nye eller forværrede symptomer, som du er usikker på, bør du altid tage op — enten i appen eller ved at booke en ny tid.',
    ],
  },
] as const

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('Bruger')
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<string>('free')
  const [availablePlans, setAvailablePlans] = useState<PlanRow[]>([])
  const [subscriptionSaving, setSubscriptionSaving] = useState(false)
  const [subscriptionFeedback, setSubscriptionFeedback] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({})
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [conversationsById, setConversationsById] = useState<Record<string, Conversation>>({})
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [prescriptionsError, setPrescriptionsError] = useState<string | null>(null)
  const [healthLogs, setHealthLogs] = useState<HealthConditionLog[]>([])
  const [healthLogsError, setHealthLogsError] = useState<string | null>(null)
  const [nextAppointmentDetailOpen, setNextAppointmentDetailOpen] = useState(false)
  const [patientUserId, setPatientUserId] = useState<string | null>(null)
  const [inboxSeenTick, setInboxSeenTick] = useState(0)
  const [openTreatmentStepId, setOpenTreatmentStepId] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const [{ data: profile, error }, { data: planRows, error: plansError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('profile_completed,role,full_name,subscription_tier')
          .eq('id', user.id)
          .single(),
        supabase.from('plans').select('id,name').order('id'),
      ])

      if (error) {
        console.error(error)
        router.push('/login')
        return
      }

      if (plansError) {
        console.error(plansError)
      }

      const plans = (planRows ?? []) as PlanRow[]
      setAvailablePlans(plans)
      const planIds = new Set(plans.map((p) => p.id))

      if (profile?.role === 'professional') {
        router.push('/gynaekolog-dashboard')
        return
      }

      if (!profile?.profile_completed) {
        router.push('/onboarding')
        return
      }

      setDisplayName(profile.full_name ?? 'Bruger')
      const rawTier = profile.subscription_tier ?? 'free'
      const legacyMapped =
        rawTier === 'starter'
          ? 'free'
          : rawTier === 'plus' || rawTier === 'premium'
            ? 'pro'
            : rawTier
      const resolvedPlanId = planIds.has(legacyMapped)
        ? legacyMapped
        : planIds.has('free')
          ? 'free'
          : plans[0]?.id ?? 'free'
      setSubscriptionPlanId(resolvedPlanId)
      setLoading(false)

      setAppointmentsLoading(true)
      setAppointmentsError(null)
      setMessagesLoading(true)
      setMessagesError(null)
      setPrescriptionsError(null)
      setHealthLogsError(null)

      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select('id,start_time,end_time,status,professional_id,notes,google_meet_url,meet_open_at')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })

      setAppointmentsLoading(false)

      if (apptsError) {
        setAppointmentsError(apptsError.message)
        return
      }

      const nextAppointments = (appts ?? []) as Appointment[]
      setAppointments(nextAppointments)

      const { data: rawPrescriptions, error: rawPrescriptionsError } = await supabase
        .from('prescriptions')
        .select('id,medication_name,dosage,instructions,issued_at,doctor_id')
        .eq('patient_id', user.id)
        .order('issued_at', { ascending: false })
        .limit(10)

      if (rawPrescriptionsError) {
        setPrescriptionsError(rawPrescriptionsError.message)
        setPrescriptions([])
      } else {
        setPrescriptions((rawPrescriptions ?? []) as Prescription[])
      }

      const { data: rawHealthLogs, error: rawHealthLogsError } = await supabase
        .from('user_health_condition_logs')
        .select('id,created_at,symptom_scores')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(30)

      if (rawHealthLogsError) {
        setHealthLogsError(rawHealthLogsError.message)
        setHealthLogs([])
      } else {
        setHealthLogs((rawHealthLogs ?? []) as HealthConditionLog[])
      }

      const { data: rawConversations, error: rawConversationsError } = await supabase
        .from('conversations')
        .select('id,patient_id,doctor_id,created_from_appointment_id')
        .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`)

      if (rawConversationsError) {
        setMessagesLoading(false)
        setMessagesError(rawConversationsError.message)
        setConversationsById({})
        setMessages([])
      } else {
        const nextConversations = (rawConversations ?? []) as Conversation[]
        const conversationMap = nextConversations.reduce<Record<string, Conversation>>((acc, conversation) => {
          acc[conversation.id] = conversation
          return acc
        }, {})
        setConversationsById(conversationMap)

        if (nextConversations.length === 0) {
          setMessagesLoading(false)
          setMessages([])
        } else {
          const conversationIds = nextConversations.map((conversation) => conversation.id)
          const { data: rawMessages, error: rawMessagesError } = await supabase
            .from('messages')
            .select('id,body,created_at,sender_id,conversation_id')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(20)

          setMessagesLoading(false)

          if (rawMessagesError) {
            setMessagesError(rawMessagesError.message)
            setMessages([])
          } else {
            setMessages((rawMessages ?? []) as Message[])
          }
        }
      }

      const relatedProfileIds = Array.from(
        new Set([
          ...nextAppointments.map((appointment) => appointment.professional_id),
          ...(((rawConversations ?? []) as Conversation[]).flatMap((conversation) => [
            conversation.patient_id,
            conversation.doctor_id,
          ])),
        ].filter((id) => id && id !== user.id))
      )

      if (relatedProfileIds.length === 0) {
        setProfileNamesById({})
        return
      }

      const { data: professionals } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', relatedProfileIds)

      const namesById = (professionals ?? []).reduce<Record<string, string>>((acc, professional: any) => {
        if (professional?.id && professional?.full_name) {
          acc[professional.id] = professional.full_name
        }

        return acc
      }, {})

      setProfileNamesById(namesById)
    }

    run()
  }, [router])

  const updateSubscriptionPlan = async (nextPlanId: string) => {
    if (subscriptionSaving || nextPlanId === subscriptionPlanId) return
    setSubscriptionSaving(true)
    setSubscriptionFeedback(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubscriptionSaving(false)
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ subscription_tier: nextPlanId })
      .eq('id', user.id)

    setSubscriptionSaving(false)

    if (error) {
      setSubscriptionFeedback(`Kunne ikke opdatere abonnement: ${error.message}`)
      return
    }

    setSubscriptionPlanId(nextPlanId)
    const label = availablePlans.find((p) => p.id === nextPlanId)?.name ?? nextPlanId
    setSubscriptionFeedback(`Abonnement opdateret til ${label}.`)
  }

  useEffect(() => {
    if (!nextAppointmentDetailOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNextAppointmentDetailOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextAppointmentDetailOpen])

  useEffect(() => {
    const onFocus = () => setInboxSeenTick((tick) => tick + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const now = new Date()
  const upcomingAppointments = appointments.filter(
    (appointment) => new Date(appointment.start_time).getTime() >= now.getTime()
  )
  const nextAppointment = [...upcomingAppointments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )[0]
  const treatmentDays = useMemo(() => {
    const nowMs = Date.now()
    const firstCompletedConsultation = appointments
      .filter((appointment) => {
        const startsAtMs = new Date(appointment.start_time).getTime()
        return appointment.status === 'confirmed' && startsAtMs <= nowMs
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]

    if (!firstCompletedConsultation) return 0

    const firstMs = new Date(firstCompletedConsultation.start_time).getTime()
    const daysSinceFirst = Math.floor((nowMs - firstMs) / (1000 * 60 * 60 * 24))
    return Math.max(0, daysSinceFirst)
  }, [appointments])
  const normalizedSubscriptionPlanId =
    subscriptionPlanId === 'starter'
      ? 'free'
      : subscriptionPlanId === 'plus' || subscriptionPlanId === 'premium'
        ? 'pro'
        : subscriptionPlanId
  const canUpgradeToPro = availablePlans.some((plan) => plan.id === 'pro')
  const shouldShowUpgradeCard = normalizedSubscriptionPlanId !== 'pro' && canUpgradeToPro
  const unreadDoctorMessagesCount = useMemo(() => {
    if (!patientUserId) return 0
    const seenRaw =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(`patient_messages_seen_at_${patientUserId}`)
        : null
    const seenAtMs = new Date(seenRaw ?? '1970-01-01T00:00:00.000Z').getTime()

    return messages.filter((message) => {
      const conversation = conversationsById[message.conversation_id]
      if (!conversation || conversation.patient_id !== patientUserId) return false
      if (message.sender_id !== conversation.doctor_id) return false
      return new Date(message.created_at).getTime() > seenAtMs
    }).length
  }, [messages, conversationsById, patientUserId, inboxSeenTick])
  const treatmentSteps = useMemo(() => {
    const sorted = [...appointments]
      .filter((appointment) => appointment.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 3)

    if (sorted.length === 0) {
      return [
        {
          id: 'no-appointments',
          title: 'Ingen planlagte konsultationer endnu',
          subtitle: 'Når du booker en tid hos gynækologen, vises forløbet her.',
          state: 'upcoming' as const,
        },
      ]
    }

    const nowMs = Date.now()
    const firstFutureIndex = sorted.findIndex((appointment) => new Date(appointment.start_time).getTime() > nowMs)

    return sorted.map((appointment, index) => {
      const start = new Date(appointment.start_time)
      const doctorName = profileNamesById[appointment.professional_id] ?? 'Gynækolog'
      const subtitle = `${start.toLocaleDateString('da-DK')} kl. ${start.toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
      })} • ${doctorName}`

      let state: 'completed' | 'current' | 'upcoming' = 'upcoming'
      if (firstFutureIndex === -1) {
        state = 'completed'
      } else if (index < firstFutureIndex) {
        state = 'completed'
      } else if (index === firstFutureIndex) {
        state = 'current'
      }

      return {
        id: appointment.id,
        title: `Konsultation (${appointmentStatusDa(appointment.status)})`,
        subtitle,
        state,
      }
    })
  }, [appointments, profileNamesById])
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

  if (loading) {
    return (
      <div className={styles.shell}>
        <p className={styles.loader}>Loader...</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Hej, {displayName}</h1>
          <p className={styles.lead}>Velkommen tilbage. Sådan går det med din rejse.</p>
          <button type="button" className={styles.profileBtn} onClick={() => router.push('/userdashboard/profile')}>
            Ret din profil
          </button>
        </div>
        {shouldShowUpgradeCard ? (
          <div className={styles.upgradeCard}>
            <div className={styles.upgradeTitle}>Opgrader til Pro</div>
            <p className={styles.upgradeMeta}>Få flere konsultationer og hurtigere adgang til tider.</p>
            <button
              type="button"
              className={styles.upgradeBtn}
              onClick={() => router.push('/userdashboard/subscription')}
            >
              Opgrader abonnement
            </button>
          </div>
        ) : null}
      </header>

      <section className={styles.content}>
        <div className={styles.quickGrid}>
          <button type="button" className={styles.quickCard} onClick={() => router.push('/professionals')}>
            <div className={styles.quickEmoji} aria-hidden="true">
              📅
            </div>
            <div className={styles.quickTitle}>Book konsultation</div>
            <div className={styles.quickMeta}>Næste ledige tid</div>
          </button>
          <button
            type="button"
            className={`${styles.quickCard} ${unreadDoctorMessagesCount > 0 ? styles.quickCardUnread : ''}`}
            onClick={() => router.push('/messages')}
            aria-label={
              unreadDoctorMessagesCount > 0
                ? `Beskeder, ${unreadDoctorMessagesCount} ulæste fra behandler`
                : 'Beskeder'
            }
          >
            {unreadDoctorMessagesCount > 0 ? (
              <span className={styles.quickUnreadBadge} aria-hidden="true">
                {unreadDoctorMessagesCount > 99 ? '99+' : unreadDoctorMessagesCount}
              </span>
            ) : null}
            <div className={styles.quickEmoji} aria-hidden="true">
              💬
            </div>
            <div className={styles.quickTitle}>Beskeder</div>
            <div className={styles.quickMeta}>
              {unreadDoctorMessagesCount > 0
                ? unreadDoctorMessagesCount === 1
                  ? '1 ulæst besked'
                  : `${unreadDoctorMessagesCount} ulæste beskeder`
                : 'Se dine beskeder'}
            </div>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => router.push('/health-log')}>
            <div className={styles.quickEmoji} aria-hidden="true">
              📈
            </div>
            <div className={styles.quickTitle}>Symptomtræning</div>
            <div className={styles.quickMeta}>Registrer i dag</div>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => router.push('/community')}>
            <div className={styles.quickEmoji} aria-hidden="true">
              👥
            </div>
            <div className={styles.quickTitle}>Community</div>
            <div className={styles.quickMeta}>Kommer snart</div>
          </button>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.panel}>
            <h2 className={styles.panelHeadline}>Din rejse</h2>
            <div className={styles.journeyBanner}>
              <div className={styles.journeyTop}>
                <div>
                  <div className={styles.journeyK}>Din fase</div>
                  <div className={styles.journeyV}>Perimenopause</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={styles.journeyK}>Dage i behandling</div>
                  <div className={styles.journeyV}>{treatmentDays}</div>
                </div>
              </div>
              <div className={styles.progressLabel}>Fremgang</div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} />
              </div>
            </div>

            <div className={styles.treatmentJourneyBlock}>
              <h3 className={styles.treatmentJourneyHeadline}>Din behandlingsrejse</h3>
              <p className={styles.treatmentJourneyIntro}>
                Tryk på et trin for at læse mere om, hvad du kan forvente i dit forløb. Ingen erstatning for
                personlig vejledning fra din behandler.
              </p>
              <div className={styles.journeyAccordion}>
                {treatmentJourneySteps.map((step) => {
                  const open = openTreatmentStepId === step.id
                  return (
                    <div key={step.id} className={styles.journeyAccordionItem}>
                      <button
                        type="button"
                        className={styles.journeyAccordionTrigger}
                        aria-expanded={open}
                        onClick={() => setOpenTreatmentStepId(open ? null : step.id)}
                      >
                        <span
                          className={`${styles.journeyAccordionChevron} ${open ? styles.journeyAccordionChevronOpen : ''}`}
                          aria-hidden
                        >
                          ▸
                        </span>
                        <span className={styles.journeyAccordionTitleCol}>
                          <span className={styles.journeyAccordionTitle}>{step.title}</span>
                          {!open ? (
                            <span className={styles.journeyAccordionSummary}>{step.summary}</span>
                          ) : null}
                        </span>
                      </button>
                      {open ? (
                        <div className={styles.journeyAccordionPanel}>
                          {step.body.map((paragraph, index) => (
                            <p key={index} className={styles.journeyAccordionPara}>
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.moodBox}>
              <h3 className={styles.moodTitle}>Hvordan har du det i dag?</h3>
              <div className={styles.moodGrid}>
                {[
                  ['😵', 'Dårligt'],
                  ['😕', 'Mindre godt'],
                  ['😐', 'Okay'],
                  ['🙂', 'Godt'],
                  ['😊', 'Rigtig godt'],
                ].map(([emoji, label]) => (
                  <button
                    key={label}
                    type="button"
                    className={styles.moodBtn}
                    onClick={() => router.push('/health-log')}
                  >
                    <div className={styles.moodEmoji}>{emoji}</div>
                    <div className={styles.moodLabel}>{label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.symptomBlock}>
              <div className={styles.graphHeaderRow}>
                <h2 className={styles.graphTitle}>Symptombehandling</h2>
                <button type="button" className={styles.linkAccent} onClick={() => router.push('/health-log')}>
                  Se detaljer →
                </button>
              </div>

              {healthLogsError && <div className={styles.errorBanner}>Fejl: {healthLogsError}</div>}

              {graphLogs.length < 2 ? (
                <div className={styles.emptyNote}>
                  Registrer symptomtræning mindst to gange for at se din udvikling.
                </div>
              ) : (
                <div>
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
              )}
            </div>
          </div>

          <aside className={styles.asideStack}>
            <div className={styles.panel}>
              <h2 className={styles.treatmentTitle}>Din behandlingsplan</h2>
              {prescriptionsError && <div className={styles.errorBanner}>Fejl: {prescriptionsError}</div>}
              <div className={styles.steps}>
                {treatmentSteps.map((step) => {
                  const stepClass =
                    step.state === 'completed'
                      ? styles.stepCompleted
                      : step.state === 'current'
                        ? styles.stepCurrent
                        : styles.stepUpcoming
                  const icon =
                    step.state === 'completed' ? '✓' : step.state === 'current' ? '→' : '○'

                  return (
                    <div key={step.id} className={`${styles.step} ${stepClass}`}>
                      <div className={styles.stepIcon}>{icon}</div>
                      <div>
                        <div className={styles.stepTitle}>{step.title}</div>
                        <div className={styles.stepSub}>{step.subtitle}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.nextLabel}>Næste aftale</div>
              {nextAppointment ? (
                <>
                  <div className={styles.nextTitle}>Video-konsultation</div>
                  <div className={styles.nextMeta}>
                    {profileNamesById[nextAppointment.professional_id] ?? 'Gynækolog'}
                  </div>
                  <div className={styles.nextWhen}>
                    {new Date(nextAppointment.start_time).toLocaleString('da-DK')}
                  </div>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => setNextAppointmentDetailOpen(true)}
                    >
                      Se detaljer
                    </button>
                    <button type="button" className={styles.btnPrimary} onClick={() => router.push('/professionals')}>
                      Book ny
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.nextMeta}>Ingen kommende aftaler endnu.</div>
              )}
              {appointmentsLoading && <div className={styles.nextWhen}>Opdaterer aftaler...</div>}
              {appointmentsError && <div className={styles.errorBanner}>Fejl: {appointmentsError}</div>}
            </div>

            <div className={styles.panel}>
              <div className={styles.nextLabel}>Abonnement</div>
              <div className={styles.subscriptionCurrent}>
                {availablePlans.find((p) => p.id === subscriptionPlanId)?.name ?? subscriptionPlanId}
              </div>
              <div className={styles.subscriptionMeta}>
                Du kan til enhver tid ændre din abonnementstype.
              </div>
              <div className={styles.subscriptionOptions}>
                {availablePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`${styles.subscriptionBtn} ${
                      plan.id === subscriptionPlanId ? styles.subscriptionBtnActive : ''
                    }`}
                    disabled={subscriptionSaving}
                    onClick={() => updateSubscriptionPlan(plan.id)}
                  >
                    {plan.name}
                  </button>
                ))}
              </div>
              {subscriptionFeedback && (
                <div
                  className={
                    subscriptionFeedback.startsWith('Kunne ikke')
                      ? styles.errorBanner
                      : styles.subscriptionSuccess
                  }
                >
                  {subscriptionFeedback}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {nextAppointmentDetailOpen && nextAppointment && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onClick={() => setNextAppointmentDetailOpen(false)}
        >
          <div
            className={styles.dialogPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="next-appt-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <h2 id="next-appt-dialog-title" className={styles.dialogTitle}>
                Din næste video-konsultation
              </h2>
              <button
                type="button"
                className={styles.dialogClose}
                aria-label="Luk"
                onClick={() => setNextAppointmentDetailOpen(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.dialogRow}>
                <span className={styles.dialogLabel}>Konsultationstype</span>
                <span className={styles.dialogValue}>Video-konsultation</span>
              </div>
              <div className={styles.dialogRow}>
                <span className={styles.dialogLabel}>Behandler</span>
                <span className={styles.dialogValue}>
                  {profileNamesById[nextAppointment.professional_id] ?? 'Gynækolog'}
                </span>
              </div>
              <div className={styles.dialogRow}>
                <span className={styles.dialogLabel}>Starttidspunkt</span>
                <span className={styles.dialogValue}>
                  {new Date(nextAppointment.start_time).toLocaleString('da-DK', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className={styles.dialogRow}>
                <span className={styles.dialogLabel}>Sluttidspunkt</span>
                <span className={styles.dialogValue}>
                  {new Date(nextAppointment.end_time).toLocaleString('da-DK', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className={styles.dialogRow}>
                <span className={styles.dialogLabel}>Status</span>
                <span className={styles.dialogValue}>{appointmentStatusDa(nextAppointment.status)}</span>
              </div>
              <div className={styles.dialogRow}>
                <span className={styles.dialogLabel}>Video-link</span>
                {nextAppointment.google_meet_url ? (
                  new Date().getTime() >= new Date(nextAppointment.meet_open_at ?? nextAppointment.start_time).getTime() ? (
                    <a
                      className={styles.linkAccent}
                      href={nextAppointment.google_meet_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Åbn Google Meet
                    </a>
                  ) : (
                    <span className={styles.dialogValueMuted}>
                      Aktiveres {new Date(nextAppointment.meet_open_at ?? nextAppointment.start_time).toLocaleString('da-DK')}
                    </span>
                  )
                ) : (
                  <span className={styles.dialogValueMuted}>Link oprettes ved booking.</span>
                )}
              </div>
              {nextAppointment.notes?.trim() ? (
                <div className={styles.dialogRow}>
                  <span className={styles.dialogLabel}>Noter fra behandler</span>
                  <p className={styles.dialogValueMuted}>{nextAppointment.notes.trim()}</p>
                </div>
              ) : null}
            </div>
            <div className={styles.dialogFooter}>
              <button
                type="button"
                className={styles.dialogFooterBtn}
                onClick={() => setNextAppointmentDetailOpen(false)}
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}