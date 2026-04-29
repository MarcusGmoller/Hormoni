'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './doctorPage.module.css'

type Appointment = {
  id: string
  user_id: string
  start_time: string
  end_time?: string | null
  status?: string
  notes?: string | null
  google_meet_url?: string | null
  meet_open_at?: string | null
}

type Conversation = {
  id: string
  patient_id: string
  doctor_id: string
  created_at?: string
}

type Message = {
  id: string
  body: string
  created_at: string
  conversation_id: string
  sender_id: string
}

type ProfileName = {
  id: string
  full_name: string | null
  role?: string | null
  email?: string | null
  contact_email?: string | null
}

type CprVaultRow = {
  user_id: string
  cpr_ciphertext: string | null
}

type NavView = 'patients' | 'messages' | 'calendar' | 'reporting' | 'stats' | 'settings'

type PatientRow = {
  id: string
  initials: string
  name: string
  age: string
  dob: string
  last: string | null
  next: string | null
  isActive: boolean
  pendingCount: number
  firstPendingAppointmentId: string | null
  nextTimestampMs: number | null
}

type ActivityRow = {
  id: string
  patient_id: string
  activity: 'message_reply' | 'meeting_held'
  minutes: number
  created_at: string
}

type ActivityHistoryGroup = {
  key: string
  patientId: string
  date: string
  messageMinutes: number
  videoMinutes: number
  messageId: string | null
  videoId: string | null
}

type ProfessionalSettings = {
  user_id: string
  bio: string | null
}

type OpenSlot = {
  id: string
  professional_id: string
  start_time: string
  end_time: string
  is_booked: boolean
  created_at?: string | null
  recurrence_pattern?: 'none' | 'weekly' | 'biweekly' | 'triweekly' | 'monthly' | null
}

type CalendarAppointmentDetails = {
  id: string
  patientName: string
  startTime: string
  endTime: string | null
  status: string
  notes: string | null
  googleMeetUrl: string | null
  meetOpenAt: string | null
}

type CalendarContextMenuState = {
  open: boolean
  x: number
  y: number
  date: string
  start: string
  end: string
}

type SettingsProfile = {
  id: string
  full_name: string | null
  email: string | null
  contact_email: string | null
}

const toTimeValue = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return '08:00'
  const hh = Math.min(23, Math.max(0, Number(match[1])))
  const mm = Math.min(59, Math.max(0, Number(match[2])))
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const addOneHour = (value: string) => {
  const [hhRaw, mmRaw] = toTimeValue(value).split(':')
  const hh = Number(hhRaw)
  const mm = Number(mmRaw)
  const next = new Date()
  next.setHours(hh, mm, 0, 0)
  next.setHours(next.getHours() + 1)
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
}

const formatTimeHHmm = (value: string) => {
  const date = new Date(value)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const getTimeParts = (value: string) => {
  const date = new Date(value)
  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
    label: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  }
}

const formatWeekdayDa = (value: string) => {
  const label = new Date(value).toLocaleDateString('da-DK', { weekday: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const recurrenceLabel = (pattern: OpenSlot['recurrence_pattern']) => {
  if (pattern === 'weekly') return 'Hver uge'
  if (pattern === 'biweekly') return 'Hver anden uge'
  if (pattern === 'triweekly') return 'Hver tredje uge'
  if (pattern === 'monthly') return 'Hver måned'
  return 'Enkelt'
}

const DIGITAL_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? 0 : 30
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
})

const RECURRENCE_OCCURRENCES_BY_TYPE: Record<
  'none' | 'weekly' | 'biweekly' | 'triweekly' | 'monthly',
  number
> = {
  none: 1,
  weekly: 1,
  biweekly: 1,
  triweekly: 1,
  monthly: 1,
}

export default function DoctorPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const currentView: NavView =
    viewParam === 'patients' ||
    viewParam === 'messages' ||
    viewParam === 'calendar' ||
    viewParam === 'reporting' ||
    viewParam === 'stats' ||
    viewParam === 'settings'
      ? viewParam
      : 'patients'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patientNamesById, setPatientNamesById] = useState<Record<string, string>>({})
  const [patientEmailsById, setPatientEmailsById] = useState<Record<string, string>>({})
  const [patientProfilesById, setPatientProfilesById] = useState<Record<string, ProfileName>>({})
  const [cprByPatientId, setCprByPatientId] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversationMessages, setConversationMessages] = useState<Message[]>([])
  const [conversationMessagesLoading, setConversationMessagesLoading] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesScrollerRef = useRef<HTMLDivElement | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')
  const [statsMonth, setStatsMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [reportPatientId, setReportPatientId] = useState('')
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reportMessageMinutes, setReportMessageMinutes] = useState('')
  const [reportVideoMinutes, setReportVideoMinutes] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportFeedback, setReportFeedback] = useState<string | null>(null)
  const [reportedActivities, setReportedActivities] = useState<ActivityRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyEditingKey, setHistoryEditingKey] = useState<string | null>(null)
  const [historyEditMessageMinutes, setHistoryEditMessageMinutes] = useState('')
  const [historyEditVideoMinutes, setHistoryEditVideoMinutes] = useState('')
  const [professionalSettings, setProfessionalSettings] = useState<ProfessionalSettings | null>(null)
  const [bioDraft, setBioDraft] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([])
  const [newSlotDate, setNewSlotDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newSlotStart, setNewSlotStart] = useState('08:00')
  const [newSlotEnd, setNewSlotEnd] = useState('08:30')
  const [newSlotRecurrence, setNewSlotRecurrence] = useState<
    'none' | 'weekly' | 'biweekly' | 'triweekly' | 'monthly'
  >('none')
  const [newSlotOccurrences, setNewSlotOccurrences] = useState('1')
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editSlotDate, setEditSlotDate] = useState('')
  const [editSlotStart, setEditSlotStart] = useState('')
  const [editSlotEnd, setEditSlotEnd] = useState('')
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [selectedCalendarAppointment, setSelectedCalendarAppointment] = useState<CalendarAppointmentDetails | null>(null)
  const [acceptingAppointmentId, setAcceptingAppointmentId] = useState<string | null>(null)
  const [calendarContextMenu, setCalendarContextMenu] = useState<CalendarContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    date: '',
    start: '08:00',
    end: '08:30',
  })
  const [calendarContextFeedback, setCalendarContextFeedback] = useState<string | null>(null)
  const [selectedCalendarOpenSlot, setSelectedCalendarOpenSlot] = useState<OpenSlot | null>(null)
  const [calendarEditStart, setCalendarEditStart] = useState('08:00')
  const [calendarEditEnd, setCalendarEditEnd] = useState('09:00')
  const [calendarSlotFeedback, setCalendarSlotFeedback] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setDoctorId(user.id)

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .limit(1)
      const profile = profileRows?.[0]

      if (profileError) {
        setLoading(false)
        setError(profileError.message)
        return
      }

      if (profile?.role !== 'professional') {
        router.push('/userdashboard')
        return
      }

      const { data: rawAppointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('id,user_id,start_time,end_time,status,notes,google_meet_url,meet_open_at')
        .eq('professional_id', user.id)
        .order('start_time', { ascending: false })

      if (appointmentError) {
        setLoading(false)
        setError(appointmentError.message)
        return
      }

      const nextAppointments = (rawAppointments ?? []) as Appointment[]
      setAppointments(nextAppointments)

      const patientIds = Array.from(new Set(nextAppointments.map((a) => a.user_id)))
      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from('profiles')
          .select('id,full_name,role,email,contact_email')
          .in('id', patientIds)

        const profiles = (patients ?? []) as ProfileName[]
        const namesById = profiles.reduce<Record<string, string>>((acc, p) => {
          if (p?.id && p?.full_name) acc[p.id] = p.full_name
          return acc
        }, {})
        const profileById = profiles.reduce<Record<string, ProfileName>>((acc, p) => {
          if (p?.id) acc[p.id] = p
          return acc
        }, {})
        setPatientNamesById(namesById)
        setPatientProfilesById(profileById)
        const emailsById = profiles.reduce<Record<string, string>>((acc, p) => {
          const email = p?.contact_email ?? p?.email
          if (p?.id && email) acc[p.id] = email
          return acc
        }, {})
        setPatientEmailsById(emailsById)

        const { data: cprRows } = await supabase
          .from('user_cpr_vault')
          .select('user_id,cpr_ciphertext')
          .in('user_id', patientIds)
        const cprMap = ((cprRows ?? []) as CprVaultRow[]).reduce<Record<string, string>>((acc, row) => {
          if (row?.user_id && row?.cpr_ciphertext) acc[row.user_id] = row.cpr_ciphertext
          return acc
        }, {})
        setCprByPatientId(cprMap)
      } else {
        setPatientNamesById({})
        setPatientProfilesById({})
        setPatientEmailsById({})
        setCprByPatientId({})
      }

      const { data: rawConversations, error: conversationError } = await supabase
        .from('conversations')
        .select('id,patient_id,doctor_id,created_at')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false })

      if (conversationError) {
        setMessagesLoading(false)
        setError(conversationError.message)
      } else {
        const conversations = (rawConversations ?? []) as Conversation[]
        setConversations(conversations)
        if (conversations.length > 0) {
          setSelectedConversationId((current) => current || conversations[0].id)
        }
        if (conversations.length === 0) {
          setMessages([])
          setMessagesLoading(false)
        } else {
          const conversationIds = conversations.map((c) => c.id)
          const patientIdsFromConversations = Array.from(new Set(conversations.map((c) => c.patient_id)))
          const missingProfileIds = patientIdsFromConversations.filter((id) => !patientNamesById[id])
          if (missingProfileIds.length > 0) {
            const { data: missingProfiles } = await supabase
              .from('profiles')
              .select('id,full_name,role,email,contact_email')
              .in('id', missingProfileIds)
            setPatientNamesById((current) => {
              const merged = { ...current }
              for (const profile of (missingProfiles ?? []) as ProfileName[]) {
                if (profile?.id && profile?.full_name) {
                  merged[profile.id] = profile.full_name
                }
              }
              return merged
            })
            setPatientProfilesById((current) => {
              const merged = { ...current }
              for (const profile of (missingProfiles ?? []) as ProfileName[]) {
                if (profile?.id) {
                  merged[profile.id] = profile
                }
              }
              return merged
            })
            setPatientEmailsById((current) => {
              const merged = { ...current }
              for (const profile of (missingProfiles ?? []) as ProfileName[]) {
                const email = profile?.contact_email ?? profile?.email
                if (profile?.id && email) {
                  merged[profile.id] = email
                }
              }
              return merged
            })
            const { data: missingCprRows } = await supabase
              .from('user_cpr_vault')
              .select('user_id,cpr_ciphertext')
              .in('user_id', missingProfileIds)
            setCprByPatientId((current) => {
              const merged = { ...current }
              for (const row of (missingCprRows ?? []) as CprVaultRow[]) {
                if (row?.user_id && row?.cpr_ciphertext) {
                  merged[row.user_id] = row.cpr_ciphertext
                }
              }
              return merged
            })
          }

          const { data: rawMessages, error: rawMessagesError } = await supabase
            .from('messages')
            .select('id,body,created_at,conversation_id,sender_id')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(50)

          if (rawMessagesError) {
            setError(rawMessagesError.message)
            setMessages([])
          } else {
            setMessages((rawMessages ?? []) as Message[])
          }
          setMessagesLoading(false)
        }
      }

      const { data: activityRows } = await supabase
        .from('professional_activity')
        .select('id,patient_id,activity,minutes,created_at')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500)
      setReportedActivities((activityRows ?? []) as ActivityRow[])
      await loadOpenSlots(user.id)

      setLoading(false)
    }

    load()
  }, [router])

  useEffect(() => {
    const loadConversationMessages = async () => {
      if (!selectedConversationId) {
        setConversationMessages([])
        return
      }

      setConversationMessagesLoading(true)
      const { data, error: messageError } = await supabase
        .from('messages')
        .select('id,body,created_at,conversation_id,sender_id')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true })

      if (messageError) {
        setConversationMessages([])
        setError(messageError.message)
      } else {
        setConversationMessages((data ?? []) as Message[])
      }
      setConversationMessagesLoading(false)
    }

    loadConversationMessages()
  }, [selectedConversationId])

  useEffect(() => {
    if (!messagesScrollerRef.current) return
    messagesScrollerRef.current.scrollTop = messagesScrollerRef.current.scrollHeight
  }, [conversationMessages, selectedConversationId])

  useEffect(() => {
    if (!doctorId || currentView !== 'messages') return
    localStorage.setItem(`doctor_messages_seen_at_${doctorId}`, new Date().toISOString())
  }, [currentView, doctorId, selectedConversationId, conversationMessages.length])

  const getDobFromCpr = (cpr: string | null | undefined): string | null => {
    if (!cpr) return null
    const digits = cpr.replace(/\D/g, '')
    if (digits.length < 6) return null
    const dd = Number(digits.slice(0, 2))
    const mm = Number(digits.slice(2, 4))
    const yy = Number(digits.slice(4, 6))
    if (!dd || !mm || Number.isNaN(yy)) return null
    const now = new Date()
    const currentYY = now.getFullYear() % 100
    const year = yy > currentYY ? 1900 + yy : 2000 + yy
    const dobDate = new Date(year, mm - 1, dd)
    if (
      dobDate.getFullYear() !== year ||
      dobDate.getMonth() !== mm - 1 ||
      dobDate.getDate() !== dd
    ) {
      return null
    }
    return dobDate.toLocaleDateString('da-DK')
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
    const dobDate = new Date(year, mm - 1, dd)
    if (
      dobDate.getFullYear() !== year ||
      dobDate.getMonth() !== mm - 1 ||
      dobDate.getDate() !== dd
    ) {
      return '-'
    }
    let age = now.getFullYear() - year
    const hasHadBirthday =
      now.getMonth() > mm - 1 || (now.getMonth() === mm - 1 && now.getDate() >= dd)
    if (!hasHadBirthday) age -= 1
    return String(age)
  }

  const patients = useMemo<PatientRow[]>(() => {
    const now = new Date()
    const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
      if (!acc[a.user_id]) acc[a.user_id] = []
      acc[a.user_id].push(a)
      return acc
    }, {})

    return Object.entries(grouped)
      .map<PatientRow | null>(([patientId, patientAppointments]) => {
        const profile = patientProfilesById[patientId]
        if (profile && profile.role && profile.role !== 'user') return null
        const sorted = [...patientAppointments].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        const pendingForPatient = sorted.filter(
          (a) => a.status === 'requested' && new Date(a.start_time).getTime() >= now.getTime()
        )
        const last = [...sorted].reverse().find((a) => new Date(a.start_time) <= now)?.start_time ?? null
        const next = sorted.find((a) => new Date(a.start_time) > now)?.start_time ?? null
        const name = patientNamesById[patientId] ?? 'Ukendt patient'
        const initials = name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('') || 'P'

        const row: PatientRow = {
          id: patientId,
          initials,
          name,
          age: getAgeFromCpr(cprByPatientId[patientId]),
          dob: getDobFromCpr(cprByPatientId[patientId]) ?? '-',
          last,
          next,
          isActive: Boolean(next),
          pendingCount: pendingForPatient.length,
          firstPendingAppointmentId: pendingForPatient[0]?.id ?? null,
          nextTimestampMs: next ? new Date(next).getTime() : null,
        }
        return row
      })
      .filter((patient): patient is PatientRow => patient !== null)
      .sort((a, b) => {
        if (a.nextTimestampMs !== null && b.nextTimestampMs !== null) {
          return a.nextTimestampMs - b.nextTimestampMs
        }
        if (a.nextTimestampMs !== null) return -1
        if (b.nextTimestampMs !== null) return 1
        return a.name.localeCompare(b.name, 'da-DK')
      })
  }, [appointments, patientNamesById, patientProfilesById, cprByPatientId])

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return patients
    return patients.filter((p) => p.name.toLowerCase().includes(query))
  }, [patients, search])

  const pendingPatients = useMemo(() => {
    return patients.filter((patient) => patient.pendingCount > 0)
  }, [patients])
  const visiblePendingCount = pendingPatients.reduce((sum, patient) => sum + patient.pendingCount, 0)

  const pendingAppointments = useMemo(() => {
    const now = Date.now()
    return appointments
      .filter(
        (appointment) =>
          appointment.status === 'requested' &&
          new Date(appointment.start_time).getTime() >= now
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [appointments])

  const reportPatientOptions = useMemo(() => {
    return patients.map((patient) => ({ id: patient.id, name: patient.name }))
  }, [patients])

  useEffect(() => {
    if (reportPatientId) return
    if (reportPatientOptions.length === 0) return
    setReportPatientId(reportPatientOptions[0].id)
  }, [reportPatientId, reportPatientOptions])

  const loadReportedActivities = async (professionalId: string) => {
    setHistoryLoading(true)
    const { data, error: activityError } = await supabase
      .from('professional_activity')
      .select('id,patient_id,activity,minutes,created_at')
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (activityError) {
      setReportFeedback(`Kunne ikke hente historik: ${activityError.message}`)
      setReportedActivities([])
    } else {
      setReportedActivities((data ?? []) as ActivityRow[])
    }
    setHistoryLoading(false)
  }

  useEffect(() => {
    if (!doctorId) return
    if (currentView !== 'reporting') return
    loadReportedActivities(doctorId)
  }, [doctorId, currentView])

  const loadSettingsData = async (professionalId: string) => {
    const [{ data: professionalRows }, { data: profileRows }] = await Promise.all([
      supabase
        .from('professionals')
        .select('user_id,bio')
        .eq('user_id', professionalId)
        .limit(1),
      supabase
        .from('profiles')
        .select('id,full_name,email,contact_email')
        .eq('id', professionalId)
        .limit(1),
    ])

    const settingsRow = (professionalRows?.[0] ?? null) as ProfessionalSettings | null
    setProfessionalSettings(settingsRow)
    setBioDraft(settingsRow?.bio ?? '')
    const profileRow = (profileRows?.[0] ?? null) as SettingsProfile | null
    setSettingsProfile(profileRow)
    setNameDraft(profileRow?.full_name ?? '')
    setEmailDraft(profileRow?.contact_email ?? profileRow?.email ?? '')
  }

  const loadOpenSlots = async (professionalId: string) => {
    const { data: slotRows } = await supabase
      .from('professional_open_slots')
      .select('id,professional_id,start_time,end_time,is_booked,created_at,recurrence_pattern')
      .eq('professional_id', professionalId)
      .order('start_time', { ascending: true })
    setOpenSlots((slotRows ?? []) as OpenSlot[])
  }

  useEffect(() => {
    if (!doctorId) return
    if (currentView !== 'settings') return
    loadSettingsData(doctorId)
    loadOpenSlots(doctorId)
  }, [doctorId, currentView])

  useEffect(() => {
    if (!calendarContextMenu.open) return
    setCalendarContextFeedback(null)
    const close = () => {
      setCalendarContextMenu((current) => ({ ...current, open: false }))
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [calendarContextMenu.open])

  const isRecurringSlot = (slot: OpenSlot) =>
    Boolean(slot.recurrence_pattern && slot.recurrence_pattern !== 'none')

  const getOpenSlotGroupKey = (slot: OpenSlot) => slot.created_at ?? slot.id

  const appointmentsByDate = useMemo(() => {
    return appointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
      const date = new Date(appointment.start_time)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      if (!acc[key]) acc[key] = []
      acc[key].push(appointment)
      return acc
    }, {})
  }, [appointments])

  const openSlotsByDate = useMemo(() => {
    return openSlots.reduce<Record<string, OpenSlot[]>>((acc, slot) => {
      const date = new Date(slot.start_time)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      if (!acc[key]) acc[key] = []
      acc[key].push(slot)
      return acc
    }, {})
  }, [openSlots])

  const sortedOpenSlots = useMemo(() => {
    return [...openSlots].sort((a, b) => {
      const recurringDelta = Number(isRecurringSlot(b)) - Number(isRecurringSlot(a))
      if (recurringDelta !== 0) return recurringDelta
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    })
  }, [openSlots])

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const leading = (firstOfMonth.getDay() + 6) % 7
    const total = 42

    return Array.from({ length: total }, (_, index) => {
      const dayOffset = index - leading + 1
      const date = new Date(year, month, dayOffset)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const inCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth
      const dayAppointments = (appointmentsByDate[key] ?? []).sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      const dayOpenSlots = (openSlotsByDate[key] ?? []).sort(
        (a, b) => {
          const recurringDelta = Number(isRecurringSlot(b)) - Number(isRecurringSlot(a))
          if (recurringDelta !== 0) return recurringDelta
          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        }
      )

      return {
        key,
        date,
        inCurrentMonth,
        appointments: dayAppointments,
        openSlots: dayOpenSlots,
      }
    })
  }, [appointmentsByDate, openSlotsByDate, calendarMonth])

  const weekCells = useMemo(() => {
    const anchor = new Date(calendarMonth)
    const mondayOffset = (anchor.getDay() + 6) % 7
    const weekStart = new Date(anchor)
    weekStart.setDate(anchor.getDate() - mondayOffset)

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const dayAppointments = (appointmentsByDate[key] ?? []).sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      const dayOpenSlots = (openSlotsByDate[key] ?? []).sort(
        (a, b) => {
          const recurringDelta = Number(isRecurringSlot(b)) - Number(isRecurringSlot(a))
          if (recurringDelta !== 0) return recurringDelta
          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        }
      )

      return {
        key,
        date,
        inCurrentMonth: true,
        appointments: dayAppointments,
        openSlots: dayOpenSlots,
      }
    })
  }, [appointmentsByDate, openSlotsByDate, calendarMonth])

  const weekHourRows = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    return hours.map((hour) => {
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        days: weekCells.map((day) => {
          const getOverlappingOpenSlotsForHour = (h: number) => {
            const hourStart = new Date(day.date)
            hourStart.setHours(h, 0, 0, 0)
            const hourEnd = new Date(day.date)
            hourEnd.setHours(h + 1, 0, 0, 0)
            return day.openSlots.filter((slot) => {
              const slotStart = new Date(slot.start_time).getTime()
              const slotEnd = new Date(slot.end_time).getTime()
              return slotStart < hourEnd.getTime() && slotEnd > hourStart.getTime()
            })
          }

          const appointments = day.appointments.filter(
            (appointment) => getTimeParts(appointment.start_time).hour === hour
          )
          const overlappingOpenSlots = getOverlappingOpenSlotsForHour(hour)
          const hasOpenSlotCoverage = overlappingOpenSlots.length > 0
          const hasOpenSlotPreviousHour = getOverlappingOpenSlotsForHour(hour - 1).length > 0
          const hasOpenSlotNextHour = getOverlappingOpenSlotsForHour(hour + 1).length > 0
          return {
            dayKey: day.key,
            date: day.date,
            appointments,
            openSlots: overlappingOpenSlots,
            hasOpenSlotCoverage,
            startsOpenRange: hasOpenSlotCoverage && !hasOpenSlotPreviousHour,
            endsOpenRange: hasOpenSlotCoverage && !hasOpenSlotNextHour,
          }
        }),
      }
    })
  }, [weekCells])

  const monthLabel = useMemo(
    () => calendarMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }),
    [calendarMonth]
  )
  const todayKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])
  const weekLabel = useMemo(() => {
    const first = weekCells[0]?.date
    const last = weekCells[6]?.date
    if (!first || !last) return ''
    return `${first.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' })} - ${last.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }, [weekCells])
  const statsMonthLabel = useMemo(
    () => statsMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }),
    [statsMonth]
  )

  const statsRange = useMemo(() => {
    const from = new Date(statsMonth.getFullYear(), statsMonth.getMonth(), 1)
    const to = new Date(statsMonth.getFullYear(), statsMonth.getMonth() + 1, 1)
    return { from, to }
  }, [statsMonth])

  const activitiesInStatsMonth = useMemo(() => {
    return reportedActivities.filter((activity) => {
      const t = new Date(activity.created_at).getTime()
      return t >= statsRange.from.getTime() && t < statsRange.to.getTime()
    })
  }, [reportedActivities, statsRange])

  const consultationRatePerHour = 1200
  const messageRatePerHour = 800

  const consultationMinutesTotal = useMemo(() => {
    return activitiesInStatsMonth.reduce((sum, activity) => {
      if (activity.activity !== 'meeting_held') return sum
      return sum + activity.minutes
    }, 0)
  }, [activitiesInStatsMonth])

  const messageMinutesTotal = useMemo(() => {
    return activitiesInStatsMonth.reduce((sum, activity) => {
      if (activity.activity !== 'message_reply') return sum
      return sum + activity.minutes
    }, 0)
  }, [activitiesInStatsMonth])

  const totalHours = (consultationMinutesTotal + messageMinutesTotal) / 60
  const estimatedHonorar =
    (consultationMinutesTotal / 60) * consultationRatePerHour + (messageMinutesTotal / 60) * messageRatePerHour

  const consultationsByPatient = useMemo(() => {
    const grouped = activitiesInStatsMonth.reduce<
      Record<string, { patientId: string; count: number; minutes: number; latest: string }>
    >((acc, activity) => {
      if (activity.activity !== 'meeting_held') return acc
      const key = activity.patient_id
      if (!acc[key]) {
        acc[key] = { patientId: key, count: 0, minutes: 0, latest: activity.created_at }
      }
      acc[key].count += 1
      acc[key].minutes += activity.minutes
      if (new Date(activity.created_at).getTime() > new Date(acc[key].latest).getTime()) {
        acc[key].latest = activity.created_at
      }
      return acc
    }, {})

    return Object.values(grouped).sort((a, b) => b.minutes - a.minutes)
  }, [activitiesInStatsMonth])

  const messagesByPatient = useMemo(() => {
    const grouped = activitiesInStatsMonth.reduce<
      Record<string, { patientId: string; count: number; minutes: number; latest: string }>
    >((acc, activity) => {
      if (activity.activity !== 'message_reply') return acc
      const patientId = activity.patient_id
      if (!acc[patientId]) {
        acc[patientId] = { patientId, count: 0, minutes: 0, latest: activity.created_at }
      }
      acc[patientId].count += 1
      acc[patientId].minutes += activity.minutes
      if (new Date(activity.created_at).getTime() > new Date(acc[patientId].latest).getTime()) {
        acc[patientId].latest = activity.created_at
      }
      return acc
    }, {})

    return Object.values(grouped).sort((a, b) => b.minutes - a.minutes)
  }, [activitiesInStatsMonth])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  )

  const selectedPatientName = selectedConversation
    ? patientNamesById[selectedConversation.patient_id] ?? 'Patient'
    : 'Beskeder'

  const latestMessageByConversationId = useMemo(() => {
    return messages.reduce<Record<string, Message>>((acc, message) => {
      const current = acc[message.conversation_id]
      if (!current || new Date(message.created_at).getTime() > new Date(current.created_at).getTime()) {
        acc[message.conversation_id] = message
      }
      return acc
    }, {})
  }, [messages])

  const conversationRows = useMemo(() => {
    return conversations
      .map((conversation) => {
        const name = patientNamesById[conversation.patient_id] ?? 'Patient'
        const initials =
          name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('') || 'P'
        const latest = latestMessageByConversationId[conversation.id] ?? null
        const needsReply = Boolean(latest && doctorId && latest.sender_id !== doctorId)
        return { conversation, name, initials, latest, needsReply }
      })
      .sort((a, b) => {
        const ta = a.latest ? new Date(a.latest.created_at).getTime() : 0
        const tb = b.latest ? new Date(b.latest.created_at).getTime() : 0
        return tb - ta
      })
  }, [conversations, patientNamesById, latestMessageByConversationId, doctorId])

  const sendMessage = async () => {
    if (!doctorId || !selectedConversationId || !messageBody.trim()) return
    setSendingMessage(true)
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversationId,
        sender_id: doctorId,
        body: messageBody.trim(),
      })
      .select('id,body,created_at,conversation_id,sender_id')
      .limit(1)

    setSendingMessage(false)
    if (sendError) {
      setError(sendError.message)
      return
    }

    const inserted = (data?.[0] ?? null) as Message | null
    if (!inserted) return
    setConversationMessages((current) => [...current, inserted])
    setMessages((current) => [inserted, ...current])
    setMessageBody('')
  }

  const acceptAppointmentRequest = async (appointmentId: string) => {
    if (!doctorId) return
    const appointment = appointments.find((row) => row.id === appointmentId)
    if (!appointment) return

    setAcceptingAppointmentId(appointmentId)
    setError(null)

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointmentId)

    if (updateError) {
      setAcceptingAppointmentId(null)
      setError(`Kunne ikke godkende tid: ${updateError.message}`)
      return
    }

    let conversationId: string | null = null
    const { data: existingConversationRows } = await supabase
      .from('conversations')
      .select('id,professional_id,patient_id,appointment_id,created_at')
      .eq('professional_id', doctorId)
      .eq('patient_id', appointment.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
    const existingConversation = (existingConversationRows?.[0] ?? null) as Conversation | null
    conversationId = existingConversation?.id ?? null

    if (!conversationId) {
      const { data: insertedConversationRows } = await supabase
        .from('conversations')
        .insert({
          professional_id: doctorId,
          patient_id: appointment.user_id,
          appointment_id: appointment.id,
        })
        .select('id,professional_id,patient_id,appointment_id,created_at')
        .limit(1)
      conversationId = ((insertedConversationRows?.[0] ?? null) as Conversation | null)?.id ?? null
    }

    if (conversationId) {
      const slotDate = new Date(appointment.start_time).toLocaleDateString('da-DK')
      const slotTime = new Date(appointment.start_time).toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
      })
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: doctorId,
        body: `Din tid er godkendt af gynækologen: ${slotDate} kl. ${slotTime}.`,
      })
    }

    const email = patientEmailsById[appointment.user_id]
    if (email) {
      await fetch('/api/appointment-accepted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          patientName: patientNamesById[appointment.user_id] ?? 'Patient',
          appointmentTime: appointment.start_time,
          googleMeetUrl: appointment.google_meet_url ?? null,
          meetOpenAt: appointment.meet_open_at ?? null,
        }),
      })
    }

    const { data: updatedRows } = await supabase
      .from('appointments')
      .select('id,user_id,start_time,end_time,status,notes,google_meet_url,meet_open_at')
      .eq('professional_id', doctorId)
      .order('start_time', { ascending: true })
    setAppointments((updatedRows ?? []) as Appointment[])
    setAcceptingAppointmentId(null)
  }

  const submitTimeReport = async () => {
    if (!doctorId) return
    if (!reportPatientId) {
      setReportFeedback('Vælg en patient.')
      return
    }

    const messageMinutes = Number(reportMessageMinutes || 0)
    const videoMinutes = Number(reportVideoMinutes || 0)
    if (messageMinutes <= 0 && videoMinutes <= 0) {
      setReportFeedback('Indtast minutter for mindst én aktivitet.')
      return
    }

    const reportRows: Array<{
      professional_id: string
      patient_id: string
      activity: 'message_reply' | 'meeting_held'
      minutes: number
      created_at: string
    }> = []

    const baseTimestamp = new Date(`${reportDate}T12:00:00`).toISOString()
    if (messageMinutes > 0) {
      reportRows.push({
        professional_id: doctorId,
        patient_id: reportPatientId,
        activity: 'message_reply',
        minutes: messageMinutes,
        created_at: baseTimestamp,
      })
    }
    if (videoMinutes > 0) {
      reportRows.push({
        professional_id: doctorId,
        patient_id: reportPatientId,
        activity: 'meeting_held',
        minutes: videoMinutes,
        created_at: baseTimestamp,
      })
    }

    setReportSubmitting(true)
    setReportFeedback(null)
    const { error: insertError } = await supabase
      .from('professional_activity')
      .insert(reportRows)

    setReportSubmitting(false)
    if (insertError) {
      setReportFeedback(`Kunne ikke indberette tid: ${insertError.message}`)
      return
    }

    setReportMessageMinutes('')
    setReportVideoMinutes('')
    setReportFeedback('Tid er indberettet.')
    await loadReportedActivities(doctorId)
  }

  const groupedActivityHistory = useMemo<ActivityHistoryGroup[]>(() => {
    const grouped = reportedActivities.reduce<Record<string, ActivityHistoryGroup>>((acc, row) => {
      const date = new Date(row.created_at).toISOString().slice(0, 10)
      const key = `${row.patient_id}__${date}`
      if (!acc[key]) {
        acc[key] = {
          key,
          patientId: row.patient_id,
          date,
          messageMinutes: 0,
          videoMinutes: 0,
          messageId: null,
          videoId: null,
        }
      }
      if (row.activity === 'message_reply') {
        acc[key].messageMinutes += row.minutes
        acc[key].messageId = row.id
      }
      if (row.activity === 'meeting_held') {
        acc[key].videoMinutes += row.minutes
        acc[key].videoId = row.id
      }
      return acc
    }, {})

    return Object.values(grouped).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [reportedActivities])

  const startEditHistoryRow = (row: ActivityHistoryGroup) => {
    setHistoryEditingKey(row.key)
    setHistoryEditMessageMinutes(String(row.messageMinutes))
    setHistoryEditVideoMinutes(String(row.videoMinutes))
    setReportFeedback(null)
  }

  const cancelEditHistoryRow = () => {
    setHistoryEditingKey(null)
    setHistoryEditMessageMinutes('')
    setHistoryEditVideoMinutes('')
  }

  const saveHistoryRow = async (row: ActivityHistoryGroup) => {
    if (!doctorId) return
    const messageMinutes = Math.max(0, Number(historyEditMessageMinutes || 0))
    const videoMinutes = Math.max(0, Number(historyEditVideoMinutes || 0))
    const createdAt = new Date(`${row.date}T12:00:00`).toISOString()

    setReportSubmitting(true)
    setReportFeedback(null)

    if (row.messageId) {
      if (messageMinutes > 0) {
        const { error: updateError } = await supabase
          .from('professional_activity')
          .update({ minutes: messageMinutes })
          .eq('id', row.messageId)
        if (updateError) {
          setReportSubmitting(false)
          setReportFeedback(`Kunne ikke opdatere beskeder: ${updateError.message}`)
          return
        }
      } else {
        const { error: deleteError } = await supabase
          .from('professional_activity')
          .delete()
          .eq('id', row.messageId)
        if (deleteError) {
          setReportSubmitting(false)
          setReportFeedback(`Kunne ikke slette beskedtid: ${deleteError.message}`)
          return
        }
      }
    } else if (messageMinutes > 0) {
      const { error: insertError } = await supabase
        .from('professional_activity')
        .insert({
          professional_id: doctorId,
          patient_id: row.patientId,
          activity: 'message_reply',
          minutes: messageMinutes,
          created_at: createdAt,
        })
      if (insertError) {
        setReportSubmitting(false)
        setReportFeedback(`Kunne ikke oprette beskedtid: ${insertError.message}`)
        return
      }
    }

    if (row.videoId) {
      if (videoMinutes > 0) {
        const { error: updateError } = await supabase
          .from('professional_activity')
          .update({ minutes: videoMinutes })
          .eq('id', row.videoId)
        if (updateError) {
          setReportSubmitting(false)
          setReportFeedback(`Kunne ikke opdatere videotid: ${updateError.message}`)
          return
        }
      } else {
        const { error: deleteError } = await supabase
          .from('professional_activity')
          .delete()
          .eq('id', row.videoId)
        if (deleteError) {
          setReportSubmitting(false)
          setReportFeedback(`Kunne ikke slette videotid: ${deleteError.message}`)
          return
        }
      }
    } else if (videoMinutes > 0) {
      const { error: insertError } = await supabase
        .from('professional_activity')
        .insert({
          professional_id: doctorId,
          patient_id: row.patientId,
          activity: 'meeting_held',
          minutes: videoMinutes,
          created_at: createdAt,
        })
      if (insertError) {
        setReportSubmitting(false)
        setReportFeedback(`Kunne ikke oprette videotid: ${insertError.message}`)
        return
      }
    }

    setReportSubmitting(false)
    setReportFeedback('Indberetning opdateret.')
    setHistoryEditingKey(null)
    setHistoryEditMessageMinutes('')
    setHistoryEditVideoMinutes('')
    await loadReportedActivities(doctorId)
  }

  const deleteHistoryRow = async (row: ActivityHistoryGroup) => {
    if (!doctorId) return
    const ids = [row.messageId, row.videoId].filter((id): id is string => Boolean(id))
    if (ids.length === 0) return

    setReportSubmitting(true)
    setReportFeedback(null)
    const { error: deleteError } = await supabase
      .from('professional_activity')
      .delete()
      .in('id', ids)
    setReportSubmitting(false)

    if (deleteError) {
      setReportFeedback(`Kunne ikke slette indberetning: ${deleteError.message}`)
      return
    }
    setReportFeedback('Indberetning slettet.')
    await loadReportedActivities(doctorId)
  }

  const saveProfessionalBio = async () => {
    if (!doctorId) return
    setSettingsSaving(true)
    setSettingsFeedback(null)

    const { error: upsertError } = await supabase
      .from('professionals')
      .upsert(
        {
          user_id: doctorId,
          bio: bioDraft.trim() || null,
          public_profile: true,
        },
        { onConflict: 'user_id' }
      )

    setSettingsSaving(false)
    if (upsertError) {
      setSettingsFeedback(`Kunne ikke gemme bio: ${upsertError.message}`)
      return
    }
    setSettingsFeedback('Bio gemt.')
    await loadSettingsData(doctorId)
  }

  const saveProfileIdentity = async () => {
    if (!doctorId) return
    const nextName = nameDraft.trim()
    const nextEmail = emailDraft.trim().toLowerCase()
    if (!nextName) {
      setSettingsFeedback('Navn må ikke være tomt.')
      return
    }
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setSettingsFeedback('Indtast en gyldig email.')
      return
    }

    setSettingsSaving(true)
    setSettingsFeedback(null)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: nextName,
        email: nextEmail,
        contact_email: nextEmail,
      })
      .eq('id', doctorId)

    if (profileError) {
      setSettingsSaving(false)
      setSettingsFeedback(`Kunne ikke gemme navn/email: ${profileError.message}`)
      return
    }

    if (settingsProfile?.email !== nextEmail) {
      const { error: authError } = await supabase.auth.updateUser({ email: nextEmail })
      if (authError) {
        setSettingsSaving(false)
        setSettingsFeedback(
          `Navn gemt, men auth-email kunne ikke opdateres: ${authError.message}`
        )
        await loadSettingsData(doctorId)
        return
      }
    }

    setSettingsSaving(false)
    setSettingsFeedback('Navn og email gemt.')
    await loadSettingsData(doctorId)
  }

  const createOpenSlot = async () => {
    if (!doctorId) return
    if (settingsSaving) return
    if (!newSlotDate || !newSlotStart || !newSlotEnd) {
      setSettingsFeedback('Udfyld dato, start og slut.')
      return
    }

    const start = new Date(`${newSlotDate}T${newSlotStart}:00`)
    const end = new Date(`${newSlotDate}T${newSlotEnd}:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setSettingsFeedback('Sluttid skal være efter starttid.')
      return
    }

    const occurrences = RECURRENCE_OCCURRENCES_BY_TYPE[newSlotRecurrence]
    const recurrenceStepDays =
      newSlotRecurrence === 'weekly'
        ? 7
        : newSlotRecurrence === 'biweekly'
          ? 14
          : newSlotRecurrence === 'triweekly'
            ? 21
            : 0
    const rows = Array.from({ length: occurrences }, (_, index) => {
      const slotStart = new Date(start)
      const slotEnd = new Date(end)
      if (newSlotRecurrence === 'monthly') {
        slotStart.setMonth(slotStart.getMonth() + index)
        slotEnd.setMonth(slotEnd.getMonth() + index)
      } else if (recurrenceStepDays > 0) {
        slotStart.setDate(slotStart.getDate() + recurrenceStepDays * index)
        slotEnd.setDate(slotEnd.getDate() + recurrenceStepDays * index)
      }
      return {
        professional_id: doctorId,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        is_booked: false,
        recurrence_pattern: newSlotRecurrence,
      }
    })

    setSettingsSaving(true)
    setSettingsFeedback(null)
    const { error: insertError } = await supabase
      .from('professional_open_slots')
      .insert(rows)
    setSettingsSaving(false)

    if (insertError) {
      if (
        insertError.message.includes('professional_open_slots_unique_slot') ||
        insertError.message.toLowerCase().includes('duplicate key')
      ) {
        setSettingsFeedback('Du har allerede oprettet en tid i dette tidsrum')
      } else {
        setSettingsFeedback(`Kunne ikke oprette tidsrum: ${insertError.message}`)
      }
      return
    }
    setSettingsFeedback(rows.length > 1 ? `${rows.length} åbne tidsrum oprettet.` : 'Åbent tidsrum oprettet.')
    await loadOpenSlots(doctorId)
    if (currentView === 'settings') await loadSettingsData(doctorId)
  }

  const createOpenSlotFromCalendarMenu = async () => {
    if (!doctorId) return
    const date = calendarContextMenu.date
    const start = toTimeValue(calendarContextMenu.start)
    const end = toTimeValue(calendarContextMenu.end)
    if (!date || !start || !end) {
      setCalendarContextFeedback('Udfyld dato, start og slut.')
      return
    }
    const startDate = new Date(`${date}T${start}:00`)
    const endDate = new Date(`${date}T${end}:00`)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setCalendarContextFeedback('Ugyldig start/sluttid.')
      return
    }
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1)
    }
    if (startDate.getTime() <= Date.now()) {
      setCalendarContextFeedback('Tidsrum skal være i fremtiden.')
      return
    }

    setSettingsSaving(true)
    setCalendarContextFeedback(null)
    const { error: insertError } = await supabase
      .from('professional_open_slots')
      .insert({
        professional_id: doctorId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        is_booked: false,
        recurrence_pattern: 'none',
      })
    setSettingsSaving(false)

    if (insertError) {
      setCalendarContextFeedback(`Kunne ikke oprette tidsrum: ${insertError.message}`)
      return
    }

    setCalendarContextFeedback('Åbent tidsrum oprettet fra kalender.')
    setCalendarContextMenu((current) => ({ ...current, open: false }))
    await loadOpenSlots(doctorId)
  }

  const deleteOpenSlot = async (slotId: string) => {
    if (!doctorId) return
    setSettingsSaving(true)
    setSettingsFeedback(null)
    const { error: deleteError } = await supabase
      .from('professional_open_slots')
      .delete()
      .eq('id', slotId)
      .eq('professional_id', doctorId)
    setSettingsSaving(false)
    if (deleteError) {
      setSettingsFeedback(`Kunne ikke slette tidsrum: ${deleteError.message}`)
      return
    }
    setSettingsFeedback('Tidsrum slettet.')
    await loadOpenSlots(doctorId)
    if (currentView === 'settings') await loadSettingsData(doctorId)
  }

  const openCalendarOpenSlotEditor = (slot: OpenSlot) => {
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    setSelectedCalendarOpenSlot(slot)
    setCalendarEditStart(startTime)
    setCalendarEditEnd(endTime)
    setCalendarSlotFeedback(null)
  }

  const saveCalendarOpenSlotEdit = async () => {
    if (!doctorId || !selectedCalendarOpenSlot) return
    const groupKey = getOpenSlotGroupKey(selectedCalendarOpenSlot)
    const groupSlots = openSlots.filter((slot) => getOpenSlotGroupKey(slot) === groupKey)
    const scopeSlots = groupSlots.length > 1 ? groupSlots : [selectedCalendarOpenSlot]
    const [startHour, startMinute] = toTimeValue(calendarEditStart).split(':').map(Number)
    const [endHour, endMinute] = toTimeValue(calendarEditEnd).split(':').map(Number)
    const firstStart = new Date(scopeSlots[0].start_time)
    firstStart.setHours(startHour, startMinute, 0, 0)
    if (firstStart.getTime() <= Date.now()) {
      setCalendarSlotFeedback('Tidsrum skal være i fremtiden.')
      return
    }

    setSettingsSaving(true)
    setCalendarSlotFeedback(null)
    const updateResults = await Promise.all(
      scopeSlots.map((slot) => {
        const slotStart = new Date(slot.start_time)
        const slotEnd = new Date(slot.start_time)
        slotStart.setHours(startHour, startMinute, 0, 0)
        slotEnd.setHours(endHour, endMinute, 0, 0)
        if (slotEnd <= slotStart) slotEnd.setDate(slotEnd.getDate() + 1)
        return supabase
          .from('professional_open_slots')
          .update({ start_time: slotStart.toISOString(), end_time: slotEnd.toISOString() })
          .eq('id', slot.id)
          .eq('professional_id', doctorId)
      })
    )
    setSettingsSaving(false)
    const updateError = updateResults.find((result) => result.error)?.error
    if (updateError) {
      setCalendarSlotFeedback(`Kunne ikke opdatere tidsrum: ${updateError.message}`)
      return
    }
    setSelectedCalendarOpenSlot(null)
    await loadOpenSlots(doctorId)
  }

  const deleteCalendarOpenSlot = async () => {
    if (!doctorId || !selectedCalendarOpenSlot) return
    // Delete only this specific instance.
    setSettingsSaving(true)
    setCalendarSlotFeedback(null)
    const { error: deleteError } = await supabase
      .from('professional_open_slots')
      .delete()
      .eq('id', selectedCalendarOpenSlot.id)
      .eq('professional_id', doctorId)
    setSettingsSaving(false)
    if (deleteError) {
      setCalendarSlotFeedback(`Kunne ikke slette tidsrum: ${deleteError.message}`)
      return
    }
    setSelectedCalendarOpenSlot(null)
    await loadOpenSlots(doctorId)
  }

  const startEditOpenSlot = (slot: OpenSlot) => {
    setEditingSlotId(slot.id)
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const isoDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    setEditSlotDate(isoDate)
    setEditSlotStart(startTime)
    setEditSlotEnd(endTime)
    setSettingsFeedback(null)
  }

  const cancelEditOpenSlot = () => {
    setEditingSlotId(null)
    setEditSlotDate('')
    setEditSlotStart('')
    setEditSlotEnd('')
  }

  const saveOpenSlotEdit = async () => {
    if (!doctorId || !editingSlotId) return
    if (!editSlotDate || !editSlotStart || !editSlotEnd) {
      setSettingsFeedback('Udfyld dato, start og slut for tidsrummet.')
      return
    }
    const start = new Date(`${editSlotDate}T${editSlotStart}:00`)
    const end = new Date(`${editSlotDate}T${editSlotEnd}:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setSettingsFeedback('Sluttid skal være efter starttid.')
      return
    }

    const targetSlot = openSlots.find((slot) => slot.id === editingSlotId)
    if (!targetSlot) return
    const groupKey = getOpenSlotGroupKey(targetSlot)
    const groupSlots = openSlots.filter((slot) => getOpenSlotGroupKey(slot) === groupKey)
    const scopeSlots = groupSlots.length > 1 ? groupSlots : [targetSlot]

    setSettingsSaving(true)
    setSettingsFeedback(null)
    const updateResults = await Promise.all(
      scopeSlots.map((slot) => {
        const slotStart = new Date(slot.start_time)
        const slotEnd = new Date(slot.start_time)
        slotStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
        slotEnd.setHours(end.getHours(), end.getMinutes(), 0, 0)
        if (slotEnd <= slotStart) slotEnd.setDate(slotEnd.getDate() + 1)
        return supabase
          .from('professional_open_slots')
          .update({
            start_time: slotStart.toISOString(),
            end_time: slotEnd.toISOString(),
          })
          .eq('id', slot.id)
          .eq('professional_id', doctorId)
      })
    )
    setSettingsSaving(false)
    const updateError = updateResults.find((result) => result.error)?.error
    if (updateError) {
      setSettingsFeedback(`Kunne ikke opdatere tidsrum: ${updateError.message}`)
      return
    }
    setSettingsFeedback(groupSlots.length > 1 ? 'Gentagelse opdateret.' : 'Tidsrum opdateret.')
    cancelEditOpenSlot()
    await loadOpenSlots(doctorId)
    if (currentView === 'settings') await loadSettingsData(doctorId)
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {{
              patients: 'Patienter',
              messages: 'Beskeder',
              calendar: 'Kalender',
              reporting: 'Indberet tid',
              stats: 'Aktivitetsrapport',
              settings: 'Indstillinger',
            }[currentView]}
          </h1>
        </div>

        {currentView === 'patients' && (
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <input
              className={styles.search}
              placeholder="Søg patienter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </header>

      <section className={styles.content}>
        {loading && <div className={styles.meta}>Loader...</div>}
        {error && <div className={styles.meta}>Fejl: {error}</div>}

        {currentView === 'patients' && (
          <>
            <section className={styles.patientSection}>
              <div className={styles.patientSectionHeader}>
                <h2 className={styles.patientSectionTitle}>Afventer godkendelse</h2>
                {!loading && (
                  <span className={`${styles.badge} ${styles.badgeInactive}`}>
                    {visiblePendingCount} booking{visiblePendingCount === 1 ? '' : 'er'}
                  </span>
                )}
              </div>
              <div className={styles.list}>
                {!loading && visiblePendingCount > 0 && (
                  <div className={styles.threadNotice}>
                    <span aria-hidden="true">🔔</span>
                    <span>
                      {visiblePendingCount} booking{visiblePendingCount > 1 ? 'er' : ''} afventer
                      din godkendelse.
                    </span>
                  </div>
                )}
                {!loading && pendingPatients.length === 0 && (
                  <div className={styles.meta}>Ingen patienter afventer godkendelse.</div>
                )}
                {!loading && pendingPatients.map((patient) => (
                  <button
                    key={`pending-${patient.id}`}
                    className={styles.row}
                    type="button"
                    onClick={() =>
                      router.push(
                        `${pathname}/patients/${patient.id}?name=${encodeURIComponent(patient.name)}`
                      )
                    }
                  >
                    <div className={styles.avatar}>{patient.initials}</div>
                    <div className={styles.rowMain}>
                      <div className={styles.name}>{patient.name}</div>
                      <div className={styles.meta}>Age {patient.age} • DOB: {patient.dob}</div>
                      <div className={styles.meta2}>
                        <span>
                          📅 Sidste: {patient.last ? new Date(patient.last).toLocaleDateString('da-DK') : '-'}
                        </span>
                        <span>
                          🗓️ Næste: {patient.next ? new Date(patient.next).toLocaleDateString('da-DK') : '-'}
                        </span>
                      </div>
                    </div>
                    <span className={`${styles.badge} ${styles.pendingBadge}`}>
                      {patient.pendingCount} afventer
                    </span>
                    {patient.firstPendingAppointmentId && (
                      <span
                        role="button"
                        tabIndex={0}
                        className={styles.approveBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (acceptingAppointmentId === patient.firstPendingAppointmentId) return
                          acceptAppointmentRequest(patient.firstPendingAppointmentId as string)
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          e.stopPropagation()
                          if (acceptingAppointmentId === patient.firstPendingAppointmentId) return
                          acceptAppointmentRequest(patient.firstPendingAppointmentId as string)
                        }}
                        aria-disabled={acceptingAppointmentId === patient.firstPendingAppointmentId}
                      >
                        {acceptingAppointmentId === patient.firstPendingAppointmentId ? 'Godkender...' : 'Godkend tid'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.patientSection}>
              <div className={styles.patientSectionHeader}>
                <h2 className={styles.patientSectionTitle}>Alle patienter</h2>
              </div>
              <div className={styles.list}>
                {!loading && filteredPatients.map((patient, index) => (
                  <button
                    key={patient.id}
                    className={`${styles.row} ${index === 0 ? styles.rowActive : ''}`}
                    type="button"
                    onClick={() =>
                      router.push(
                        `${pathname}/patients/${patient.id}?name=${encodeURIComponent(patient.name)}`
                      )
                    }
                  >
                    <div className={styles.avatar}>{patient.initials}</div>
                    <div className={styles.rowMain}>
                      <div className={styles.name}>{patient.name}</div>
                      <div className={styles.meta}>Age {patient.age} • DOB: {patient.dob}</div>
                      <div className={styles.meta2}>
                        <span>
                          📅 Sidste: {patient.last ? new Date(patient.last).toLocaleDateString('da-DK') : '-'}
                        </span>
                        <span>
                          🗓️ Næste: {patient.next ? new Date(patient.next).toLocaleDateString('da-DK') : '-'}
                        </span>
                      </div>
                    </div>
                    <span className={`${styles.badge} ${patient.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                      {patient.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {patient.pendingCount > 0 && (
                      <span className={`${styles.badge} ${styles.pendingBadge}`}>
                        {patient.pendingCount} afventer
                      </span>
                    )}
                    {patient.firstPendingAppointmentId && (
                      <span
                        role="button"
                        tabIndex={0}
                        className={styles.approveBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (acceptingAppointmentId === patient.firstPendingAppointmentId) return
                          acceptAppointmentRequest(patient.firstPendingAppointmentId as string)
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          e.stopPropagation()
                          if (acceptingAppointmentId === patient.firstPendingAppointmentId) return
                          acceptAppointmentRequest(patient.firstPendingAppointmentId as string)
                        }}
                        aria-disabled={acceptingAppointmentId === patient.firstPendingAppointmentId}
                      >
                        {acceptingAppointmentId === patient.firstPendingAppointmentId ? 'Godkender...' : 'Godkend tid'}
                      </span>
                    )}
                  </button>
                ))}

                {!loading && filteredPatients.length === 0 && (
                  <div className={styles.meta}>Ingen patienter fundet.</div>
                )}
              </div>
            </section>
          </>
        )}

        {currentView === 'messages' && (
          <div className={styles.messagesShell}>
            <aside className={styles.messagesSidebar}>
              {messagesLoading ? (
                <div className={styles.meta}>Loader samtaler...</div>
              ) : conversationRows.length === 0 ? (
                <div className={styles.meta}>Ingen samtaler fundet.</div>
              ) : (
                <div className={styles.list}>
                  {conversationRows.map((row) => (
                    <button
                      key={row.conversation.id}
                      type="button"
                      className={`${styles.row} ${selectedConversationId === row.conversation.id ? styles.rowActive : ''} ${row.needsReply ? styles.rowNeedsReply : ''}`}
                      onClick={() => setSelectedConversationId(row.conversation.id)}
                    >
                      <div className={styles.avatar}>{row.initials}</div>
                      <div className={styles.rowMain}>
                        <div className={styles.name}>{row.name}</div>
                        <div className={styles.meta}>
                          {row.latest?.body?.slice(0, 80) ?? 'Ingen beskeder endnu'}
                        </div>
                      </div>
                      {row.needsReply && <span className={styles.replyBadge}>Afventer svar</span>}
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className={styles.messageThread}>
              <div className={styles.threadTopbar}>
                <div className={styles.threadTitle}>{selectedPatientName}</div>
              </div>

              <div className={styles.threadNotice}>
                <span aria-hidden="true">💬</span>
                <span>Skriv med patienten her. Svarene vises i samme tråd som hos bruger.</span>
              </div>

              <div className={styles.threadMessages} ref={messagesScrollerRef}>
                {conversationMessagesLoading ? (
                  <div className={styles.meta}>Loader beskeder...</div>
                ) : conversationMessages.length === 0 ? (
                  <div className={styles.meta}>Ingen beskeder i denne tråd endnu.</div>
                ) : (
                  conversationMessages.map((message) => {
                    const own = message.sender_id === doctorId
                    return (
                      <div key={message.id} className={`${styles.msgRow} ${own ? styles.msgOwn : styles.msgTheir}`}>
                        <div className={`${styles.msgBubble} ${own ? styles.msgBubbleOwn : styles.msgBubbleTheir}`}>
                          {message.body}
                        </div>
                        <div className={styles.msgTime}>
                          {new Date(message.created_at).toLocaleTimeString('da-DK', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className={styles.threadComposer}>
                <textarea
                  className={styles.threadInput}
                  rows={1}
                  placeholder="Skriv besked..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.threadSendBtn}
                  onClick={sendMessage}
                  disabled={sendingMessage || !selectedConversationId}
                >
                  {sendingMessage ? '…' : '➤'}
                </button>
              </div>
            </section>
          </div>
        )}

        {currentView === 'calendar' && (
          <div className={styles.calendarStack}>
            <div className={styles.calendarWrap}>
              <div className={styles.calendarHeader}>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() =>
                    setCalendarMonth((current) =>
                      calendarView === 'month'
                        ? new Date(current.getFullYear(), current.getMonth() - 1, 1)
                        : new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7)
                    )
                  }
                >
                  ‹
                </button>
                <div className={styles.calendarMonth}>
                  {calendarView === 'month' ? monthLabel : weekLabel}
                </div>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() =>
                    setCalendarMonth((current) =>
                      calendarView === 'month'
                        ? new Date(current.getFullYear(), current.getMonth() + 1, 1)
                        : new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7)
                    )
                  }
                >
                  ›
                </button>
              </div>
              <div className={styles.calendarViewToggle}>
                <button
                  type="button"
                  className={`${styles.calendarToggleBtn} ${calendarView === 'month' ? styles.calendarToggleBtnActive : ''}`}
                  onClick={() => setCalendarView('month')}
                >
                  Måned
                </button>
                <button
                  type="button"
                  className={`${styles.calendarToggleBtn} ${calendarView === 'week' ? styles.calendarToggleBtnActive : ''}`}
                  onClick={() => {
                    const now = new Date()
                    setCalendarView('week')
                    setCalendarMonth(now)
                    setNewSlotDate(
                      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                    )
                  }}
                >
                  Uge
                </button>
                <button
                  type="button"
                  className={styles.calendarToggleBtn}
                  onClick={() => {
                    const now = new Date()
                    setCalendarView('week')
                    setCalendarMonth(now)
                    setNewSlotDate(
                      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                    )
                  }}
                >
                  Dagsdato
                </button>
              </div>

              {calendarView === 'month' ? (
                <>
                  <div className={styles.weekdays}>
                    {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((day) => (
                      <div key={day} className={styles.weekday}>{day}</div>
                    ))}
                  </div>

                  <div className={styles.calendarGrid}>
                    {calendarCells.map((cell) => (
                      <div
                        key={cell.key}
                        className={`${styles.dayCell} ${cell.inCurrentMonth ? '' : styles.dayCellMuted} ${
                          newSlotDate === cell.key ? styles.dayCellSelected : ''
                        } ${todayKey === cell.key ? styles.dayCellToday : ''}`}
                        onClick={() => setNewSlotDate(cell.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setNewSlotDate(cell.key)
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setNewSlotDate(cell.key)
                          setCalendarContextMenu({
                            open: true,
                            x: e.clientX,
                            y: e.clientY,
                            date: cell.key,
                            start: '08:00',
                            end: '08:30',
                          })
                        }}
                      >
                        <div className={`${styles.dayNumber} ${todayKey === cell.key ? styles.dayNumberToday : ''}`}>
                          {cell.date.getDate()}
                        </div>
                        <div className={styles.dayAppointments}>
                          {cell.appointments.slice(0, 2).map((appointment) => (
                            <button
                              key={appointment.id}
                              type="button"
                              className={styles.dayAppointment}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCalendarAppointment({
                                  id: appointment.id,
                                  patientName: patientNamesById[appointment.user_id] ?? 'Patient',
                                  startTime: appointment.start_time,
                                  endTime: appointment.end_time ?? null,
                                  status: appointment.status ?? 'requested',
                                  notes: appointment.notes ?? null,
                                  googleMeetUrl: appointment.google_meet_url ?? null,
                                  meetOpenAt: appointment.meet_open_at ?? null,
                                })
                              }}
                            >
                              {formatTimeHHmm(appointment.start_time)}{' '}
                              {patientNamesById[appointment.user_id] ?? 'Patient'}
                            </button>
                          ))}
                          {cell.openSlots.slice(0, 2).map((slot) => (
                            <div
                              key={slot.id}
                              className={`${styles.dayOpenSlot} ${isRecurringSlot(slot) ? styles.dayOpenSlotRecurring : ''}`}
                            >
                              {isRecurringSlot(slot) ? 'Gentagelse' : 'Åbent'} {new Date(slot.start_time).toLocaleTimeString('da-DK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}-
                              {new Date(slot.end_time).toLocaleTimeString('da-DK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          ))}
                          {cell.appointments.length > 2 && (
                            <div className={styles.moreAppointments}>+{cell.appointments.length - 2} flere</div>
                          )}
                          {cell.openSlots.length > 2 && (
                            <div className={styles.moreAppointments}>+{cell.openSlots.length - 2} åbne</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.weekTable}>
                  <div className={styles.weekHeaderCell} />
                  {weekCells.map((day) => (
                    <div
                      key={day.key}
                      className={`${styles.weekHeaderCell} ${
                        day.date.getDay() === 0 || day.date.getDay() === 6 ? styles.weekHeaderWeekend : ''
                      } ${todayKey === day.key ? styles.weekHeaderToday : ''}`}
                    >
                      {day.date.toLocaleDateString('da-DK', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </div>
                  ))}
                  {weekHourRows.map((row) => (
                    <div key={`row-${row.hour}`} className={styles.weekRowGroup}>
                      <div className={styles.weekTimeCell}>{row.label}</div>
                      {row.days.map((day) => (
                        <div
                          key={`${day.dayKey}-${row.hour}`}
                          className={`${styles.weekHourCell} ${day.hasOpenSlotCoverage ? styles.weekHourCellOpen : ''} ${
                            todayKey === day.dayKey ? styles.weekHourCellToday : ''
                          } ${
                            day.hasOpenSlotCoverage && day.startsOpenRange ? styles.weekHourCellOpenStart : ''
                          } ${
                            day.hasOpenSlotCoverage && day.endsOpenRange ? styles.weekHourCellOpenEnd : ''
                          } ${
                            day.hasOpenSlotCoverage && !day.startsOpenRange && !day.endsOpenRange ? styles.weekHourCellOpenMid : ''
                          }`}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setNewSlotDate(day.dayKey)
                            setCalendarContextMenu({
                              open: true,
                              x: e.clientX,
                              y: e.clientY,
                              date: day.dayKey,
                              start: `${String(row.hour).padStart(2, '0')}:00`,
                              end: addOneHour(`${String(row.hour).padStart(2, '0')}:00`),
                            })
                          }}
                        >
                          {day.hasOpenSlotCoverage && (
                            <div
                              className={`${styles.weekOpenBlock} ${
                                day.startsOpenRange ? styles.weekOpenBlockStart : ''
                              } ${
                                day.endsOpenRange ? styles.weekOpenBlockEnd : ''
                              } ${
                                !day.startsOpenRange && !day.endsOpenRange ? styles.weekOpenBlockMid : ''
                              }`}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                const primarySlot = day.openSlots[0]
                                if (primarySlot) openCalendarOpenSlotEditor(primarySlot)
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter' && e.key !== ' ') return
                                e.preventDefault()
                                e.stopPropagation()
                                const primarySlot = day.openSlots[0]
                                if (primarySlot) openCalendarOpenSlotEditor(primarySlot)
                              }}
                            >
                              {day.startsOpenRange ? (isRecurringSlot(day.openSlots[0]) ? 'Gentagelse' : 'Åbent') : ''}
                            </div>
                          )}
                          {day.appointments.map((appointment) => (
                            <button
                              key={appointment.id}
                              type="button"
                              className={`${styles.dayAppointment} ${styles.weekAppointment}`}
                              style={{
                                top: `${Math.round((getTimeParts(appointment.start_time).minute / 60) * 44) + 4}px`,
                              }}
                              onClick={() =>
                                setSelectedCalendarAppointment({
                                  id: appointment.id,
                                  patientName: patientNamesById[appointment.user_id] ?? 'Patient',
                                  startTime: appointment.start_time,
                                  endTime: appointment.end_time ?? null,
                                  status: appointment.status ?? 'requested',
                                  notes: appointment.notes ?? null,
                                  googleMeetUrl: appointment.google_meet_url ?? null,
                                  meetOpenAt: appointment.meet_open_at ?? null,
                                })
                              }
                            >
                              {getTimeParts(appointment.start_time).label}{' '}
                              {patientNamesById[appointment.user_id] ?? 'Patient'}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {calendarContextMenu.open && (
              <div
                className={styles.calendarContextMenu}
                style={{ top: calendarContextMenu.y, left: calendarContextMenu.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.calendarContextTitle}>
                  Opret tidsrum · {new Date(calendarContextMenu.date).toLocaleDateString('da-DK')}
                </div>
                <div className={styles.calendarContextRow}>
                  <label className={styles.settingsField}>
                    <span>Start</span>
                    <select
                      className={styles.settingsControl}
                      value={toTimeValue(calendarContextMenu.start)}
                      onChange={(e) =>
                        setCalendarContextMenu((current) => {
                          const nextStart = toTimeValue(e.target.value)
                          const currentEnd = toTimeValue(current.end)
                          const endDate = new Date(`${current.date}T${currentEnd}:00`)
                          const startDate = new Date(`${current.date}T${nextStart}:00`)
                          return {
                            ...current,
                            start: nextStart,
                            end: endDate <= startDate ? addOneHour(nextStart) : currentEnd,
                          }
                        })
                      }
                    >
                      {DIGITAL_TIME_OPTIONS.map((time) => (
                        <option key={`start-${time}`} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.settingsField}>
                    <span>Slut</span>
                    <select
                      className={styles.settingsControl}
                      value={toTimeValue(calendarContextMenu.end)}
                      onChange={(e) =>
                        setCalendarContextMenu((current) => ({ ...current, end: toTimeValue(e.target.value) }))
                      }
                    >
                      {DIGITAL_TIME_OPTIONS.map((time) => (
                        <option key={`end-${time}`} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className={styles.settingsPrimaryBtn}
                  onClick={createOpenSlotFromCalendarMenu}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Gemmer...' : 'Opret tidsrum'}
                </button>
                {calendarContextFeedback && <div className={styles.meta}>{calendarContextFeedback}</div>}
              </div>
            )}

          </div>
        )}

        {selectedCalendarAppointment && (
          <div
            className={styles.appointmentModalBackdrop}
            onClick={() => setSelectedCalendarAppointment(null)}
          >
            <div className={styles.appointmentModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.appointmentModalHeader}>
                <h3 className={styles.settingsTitle}>Aftale information</h3>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() => setSelectedCalendarAppointment(null)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.appointmentInfoGrid}>
                <div><strong>Patient:</strong> {selectedCalendarAppointment.patientName}</div>
                <div>
                  <strong>Dato:</strong>{' '}
                  {new Date(selectedCalendarAppointment.startTime).toLocaleDateString('da-DK')}
                </div>
                <div>
                  <strong>Start:</strong>{' '}
                  {formatTimeHHmm(selectedCalendarAppointment.startTime)}
                </div>
                <div>
                  <strong>Slut:</strong>{' '}
                  {selectedCalendarAppointment.endTime
                    ? formatTimeHHmm(selectedCalendarAppointment.endTime)
                    : '-'}
                </div>
                <div><strong>Status:</strong> {selectedCalendarAppointment.status}</div>
                <div><strong>Aftale-id:</strong> {selectedCalendarAppointment.id}</div>
                <div className={styles.fullWidthInfo}>
                  <strong>Google Meet:</strong>{' '}
                  {selectedCalendarAppointment.googleMeetUrl ? (
                    new Date().getTime() >=
                    new Date(
                      selectedCalendarAppointment.meetOpenAt ?? selectedCalendarAppointment.startTime
                    ).getTime() ? (
                      <a href={selectedCalendarAppointment.googleMeetUrl} target="_blank" rel="noreferrer">
                        Åbn mødelink
                      </a>
                    ) : (
                      <span>
                        Aktiveres{' '}
                        {new Date(
                          selectedCalendarAppointment.meetOpenAt ?? selectedCalendarAppointment.startTime
                        ).toLocaleString('da-DK')}
                      </span>
                    )
                  ) : (
                    <span>Ikke oprettet endnu.</span>
                  )}
                </div>
              </div>
              <div className={styles.reportHistory}>
                <h4 className={styles.reportHistoryTitle}>Noter</h4>
                <p className={styles.text}>
                  {selectedCalendarAppointment.notes || 'Ingen noter tilknyttet aftalen.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedCalendarOpenSlot && (
          <div
            className={styles.appointmentModalBackdrop}
            onClick={() => setSelectedCalendarOpenSlot(null)}
          >
            <div className={styles.appointmentModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.appointmentModalHeader}>
                <h3 className={styles.settingsTitle}>Rediger åbent tidsrum</h3>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() => setSelectedCalendarOpenSlot(null)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.calendarContextRow}>
                <label className={styles.settingsField}>
                  <span>Start</span>
                  <select
                    className={styles.settingsControl}
                    value={toTimeValue(calendarEditStart)}
                    onChange={(e) => {
                      const nextStart = toTimeValue(e.target.value)
                      const currentEnd = toTimeValue(calendarEditEnd)
                      const endDate = new Date(`${new Date(selectedCalendarOpenSlot.start_time).toISOString().slice(0, 10)}T${currentEnd}:00`)
                      const startDate = new Date(`${new Date(selectedCalendarOpenSlot.start_time).toISOString().slice(0, 10)}T${nextStart}:00`)
                      setCalendarEditStart(nextStart)
                      if (endDate <= startDate) setCalendarEditEnd(addOneHour(nextStart))
                    }}
                  >
                    {DIGITAL_TIME_OPTIONS.map((time) => (
                      <option key={`calendar-edit-start-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.settingsField}>
                  <span>Slut</span>
                  <select
                    className={styles.settingsControl}
                    value={toTimeValue(calendarEditEnd)}
                    onChange={(e) => setCalendarEditEnd(toTimeValue(e.target.value))}
                  >
                    {DIGITAL_TIME_OPTIONS.map((time) => (
                      <option key={`calendar-edit-end-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.reportHistoryActions}>
                <button
                  type="button"
                  className={styles.settingsPrimaryBtn}
                  onClick={saveCalendarOpenSlotEdit}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Gemmer...' : 'Gem ændring'}
                </button>
                <button
                  type="button"
                  className={styles.settingsDangerBtn}
                  onClick={deleteCalendarOpenSlot}
                  disabled={settingsSaving}
                >
                  Slet tidsrum
                </button>
              </div>
              {calendarSlotFeedback && <div className={styles.meta}>{calendarSlotFeedback}</div>}
            </div>
          </div>
        )}

        {currentView === 'reporting' && (
          <section className={styles.reportCard}>
            <h3 className={styles.reportTitle}>Indberet tid</h3>
            <p className={styles.reportMeta}>
              Fordel arbejdstid på besvarede beskeder og videokonsultationer. Gemmes i DB.
            </p>
            <div className={styles.reportGrid}>
              <label className={styles.reportField}>
                <span>Patient</span>
                <select
                  className={styles.reportControl}
                  value={reportPatientId}
                  onChange={(e) => setReportPatientId(e.target.value)}
                >
                  <option value="">Vælg patient</option>
                  {reportPatientOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.reportField}>
                <span>Dato</span>
                <input
                  className={styles.reportControl}
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </label>
              <label className={styles.reportField}>
                <span>Beskeder (min)</span>
                <input
                  className={styles.reportControl}
                  type="number"
                  min="0"
                  step="1"
                  value={reportMessageMinutes}
                  onChange={(e) => setReportMessageMinutes(e.target.value)}
                  placeholder="fx 20"
                />
              </label>
              <label className={styles.reportField}>
                <span>Videokonsultation (min)</span>
                <input
                  className={styles.reportControl}
                  type="number"
                  min="0"
                  step="1"
                  value={reportVideoMinutes}
                  onChange={(e) => setReportVideoMinutes(e.target.value)}
                  placeholder="fx 45"
                />
              </label>
            </div>
            <div className={styles.reportActions}>
              <button
                type="button"
                className={styles.reportSubmitBtn}
                onClick={submitTimeReport}
                disabled={reportSubmitting}
              >
                {reportSubmitting ? 'Gemmer...' : 'Indberet tid'}
              </button>
              {reportFeedback && <span className={styles.reportFeedback}>{reportFeedback}</span>}
            </div>

            <div className={styles.reportHistory}>
              <h4 className={styles.reportHistoryTitle}>Indberettet historik</h4>
              {historyLoading ? (
                <div className={styles.meta}>Loader historik...</div>
              ) : groupedActivityHistory.length === 0 ? (
                <div className={styles.meta}>Ingen indberetninger endnu.</div>
              ) : (
                <div className={styles.reportHistoryRows}>
                  {groupedActivityHistory.map((row) => {
                    const isEditing = historyEditingKey === row.key
                    return (
                      <div key={row.key} className={styles.reportHistoryRow}>
                        <div className={styles.reportHistoryMeta}>
                          <div className={styles.name}>{patientNamesById[row.patientId] ?? 'Patient'}</div>
                          <div className={styles.meta}>{new Date(row.date).toLocaleDateString('da-DK')}</div>
                        </div>
                        <div className={styles.reportHistoryFields}>
                          <label className={styles.reportFieldSmall}>
                            <span>Beskeder (min)</span>
                            <input
                              className={styles.reportControlSmall}
                              type="number"
                              min="0"
                              value={isEditing ? historyEditMessageMinutes : String(row.messageMinutes)}
                              disabled={!isEditing}
                              onChange={(e) => setHistoryEditMessageMinutes(e.target.value)}
                            />
                          </label>
                          <label className={styles.reportFieldSmall}>
                            <span>Videokonsultation (min)</span>
                            <input
                              className={styles.reportControlSmall}
                              type="number"
                              min="0"
                              value={isEditing ? historyEditVideoMinutes : String(row.videoMinutes)}
                              disabled={!isEditing}
                              onChange={(e) => setHistoryEditVideoMinutes(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className={styles.reportHistoryActions}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className={styles.reportRowBtn}
                                onClick={() => saveHistoryRow(row)}
                                disabled={reportSubmitting}
                              >
                                Gem
                              </button>
                              <button
                                type="button"
                                className={styles.reportRowBtnGhost}
                                onClick={cancelEditHistoryRow}
                                disabled={reportSubmitting}
                              >
                                Annuller
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.reportRowBtn}
                              onClick={() => startEditHistoryRow(row)}
                            >
                              Rediger
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.reportRowDeleteBtn}
                            onClick={() => deleteHistoryRow(row)}
                            disabled={reportSubmitting}
                          >
                            Slet
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {currentView === 'stats' && (
          <div className={styles.statsShell}>
            <div className={styles.statsTopRow}>
              <div className={styles.statsMonthNav}>
                <button
                  type="button"
                  className={styles.statsNavBtn}
                  onClick={() =>
                    setStatsMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                  }
                >
                  ‹
                </button>
                <span className={styles.statsMonthLabel}>{statsMonthLabel}</span>
                <button
                  type="button"
                  className={styles.statsNavBtn}
                  onClick={() =>
                    setStatsMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                  }
                >
                  ›
                </button>
              </div>
              <div className={styles.statsActions}>
                <button type="button" className={styles.statsActionBtn}>Eksporter CSV</button>
                <button type="button" className={styles.statsActionPrimary}>Eksporter PDF</button>
              </div>
            </div>

            <div className={styles.statsCards}>
              <div className={styles.statsCard}>
                <div className={styles.statsCardLabel}>Videokonsultationer</div>
                <div className={styles.statsCardValue}>
                  {activitiesInStatsMonth.filter((a) => a.activity === 'meeting_held').length}
                </div>
                <div className={styles.statsCardMeta}>
                  {(consultationMinutesTotal / 60).toFixed(1)} timer total
                </div>
              </div>
              <div className={styles.statsCard}>
                <div className={styles.statsCardLabel}>Beskeder besvaret</div>
                <div className={styles.statsCardValue}>
                  {activitiesInStatsMonth.filter((a) => a.activity === 'message_reply').length}
                </div>
                <div className={styles.statsCardMeta}>
                  {(messageMinutesTotal / 60).toFixed(1)} timer total
                </div>
              </div>
              <div className={styles.statsCard}>
                <div className={styles.statsCardLabel}>Total Tid</div>
                <div className={styles.statsCardValue}>{totalHours.toFixed(1)}</div>
                <div className={styles.statsCardMeta}>timer i måneden</div>
              </div>
              <div className={styles.statsCard}>
                <div className={styles.statsCardLabel}>Estimeret Honorar</div>
                <div className={styles.statsCardValue}>
                  {Math.round(estimatedHonorar).toLocaleString('da-DK')} kr
                </div>
                <div className={styles.statsCardMeta}>Baseret på takster</div>
              </div>
            </div>

            <div className={styles.ratesCard}>
              <div className={styles.ratesTitle}>Takster</div>
              <div className={styles.ratesGrid}>
                <div>Videokonsultation: {consultationRatePerHour} kr/time</div>
                <div>Beskeder: {messageRatePerHour} kr/time</div>
              </div>
            </div>

            <div className={styles.statsDetailGrid}>
              <section className={styles.statsDetailCard}>
                <h3 className={styles.statsDetailTitle}>Videokonsultationer Detaljer</h3>
                <div className={styles.statsRows}>
                  {consultationsByPatient.length === 0 && (
                    <div className={styles.meta}>Ingen videokonsultationer i denne måned.</div>
                  )}
                  {consultationsByPatient.map((item) => (
                    <div key={item.patientId} className={styles.statsRow}>
                      <div>
                        <div className={styles.name}>{patientNamesById[item.patientId] ?? 'Patient'}</div>
                        <div className={styles.meta}>{item.count} konsultation(er)</div>
                      </div>
                      <div className={styles.statsRowRight}>
                        <div className={styles.meta}>{new Date(item.latest).toLocaleDateString('da-DK')}</div>
                        <div className={styles.statsMinutes}>{item.minutes} min</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.statsFooter}>
                  <span>Total:</span>
                  <span>{consultationMinutesTotal} min ({(consultationMinutesTotal / 60).toFixed(1)} timer)</span>
                </div>
                <div className={styles.statsFooter}>
                  <span>Honorar:</span>
                  <span>
                    {Math.round((consultationMinutesTotal / 60) * consultationRatePerHour).toLocaleString('da-DK')} kr
                  </span>
                </div>
              </section>

              <section className={styles.statsDetailCard}>
                <h3 className={styles.statsDetailTitle}>Beskeder Detaljer</h3>
                <div className={styles.statsRows}>
                  {messagesByPatient.length === 0 && (
                    <div className={styles.meta}>Ingen beskeder i denne måned.</div>
                  )}
                  {messagesByPatient.map((item) => (
                    <div key={item.patientId} className={styles.statsRow}>
                      <div>
                        <div className={styles.name}>{patientNamesById[item.patientId] ?? 'Patient'}</div>
                        <div className={styles.meta}>{item.count} besked(er)</div>
                      </div>
                      <div className={styles.statsRowRight}>
                        <div className={styles.meta}>{new Date(item.latest).toLocaleDateString('da-DK')}</div>
                        <div className={styles.statsMinutes}>{item.minutes} min</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.statsFooter}>
                  <span>Total:</span>
                  <span>{messageMinutesTotal} min ({(messageMinutesTotal / 60).toFixed(1)} timer)</span>
                </div>
                <div className={styles.statsFooter}>
                  <span>Honorar:</span>
                  <span>
                    {Math.round((messageMinutesTotal / 60) * messageRatePerHour).toLocaleString('da-DK')} kr
                  </span>
                </div>
              </section>
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div className={styles.settingsShell}>
            <section className={styles.settingsCard}>
              <h3 className={styles.settingsTitle}>Profil indstillinger</h3>
              <div className={styles.settingsGrid}>
                <label className={styles.settingsField}>
                  <span>Navn</span>
                  <input
                    className={styles.settingsControl}
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Fulde navn"
                  />
                </label>
                <label className={styles.settingsField}>
                  <span>Email</span>
                  <input
                    className={styles.settingsControl}
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="email@eksempel.dk"
                  />
                </label>
              </div>
              <button
                type="button"
                className={styles.settingsPrimaryBtn}
                onClick={saveProfileIdentity}
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Gemmer...' : 'Gem navn og email'}
              </button>
              <label className={styles.settingsField}>
                <span>Bio</span>
                <textarea
                  className={styles.settingsTextarea}
                  rows={4}
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="Skriv en kort bio om din kliniske erfaring..."
                />
              </label>
              <button
                type="button"
                className={styles.settingsPrimaryBtn}
                onClick={saveProfessionalBio}
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Gemmer...' : 'Gem bio'}
              </button>
            </section>

            <section className={styles.settingsCard}>
              <h3 className={styles.settingsTitle}>Opret tidsrum til booking</h3>
              <div className={styles.settingsGrid}>
                <label className={styles.settingsField}>
                  <span>Dato</span>
                  <input
                    className={styles.settingsControl}
                    type="date"
                    value={newSlotDate}
                    onChange={(e) => setNewSlotDate(e.target.value)}
                  />
                </label>
                <label className={styles.settingsField}>
                  <span>Start</span>
                  <input
                    className={styles.settingsControl}
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                  />
                </label>
                <label className={styles.settingsField}>
                  <span>Slut</span>
                  <input
                    className={styles.settingsControl}
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                  />
                </label>
                <label className={styles.settingsField}>
                  <span>Gentagelse</span>
                  <select
                    className={styles.settingsControl}
                    value={newSlotRecurrence}
                    onChange={(e) =>
                      setNewSlotRecurrence(
                        e.target.value as 'none' | 'weekly' | 'biweekly' | 'triweekly' | 'monthly'
                      )
                    }
                  >
                    <option value="none">Ingen</option>
                    <option value="weekly">Hver uge</option>
                    <option value="biweekly">Hver anden uge</option>
                    <option value="triweekly">Hver tredje uge</option>
                    <option value="monthly">Hver måned</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                className={styles.settingsPrimaryBtn}
                onClick={createOpenSlot}
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Gemmer...' : 'Opret åbent tidsrum'}
              </button>

              <div className={styles.openSlotsList}>
                {openSlots.length === 0 ? (
                  <div className={styles.meta}>Ingen åbne tidsrum endnu.</div>
                ) : (
                  sortedOpenSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`${styles.openSlotRow} ${isRecurringSlot(slot) ? styles.openSlotRowRecurring : ''}`}
                    >
                      {editingSlotId === slot.id ? (
                        <>
                          <div className={styles.openSlotEditGrid}>
                            <label className={styles.settingsField}>
                              <span>Dato</span>
                              <input
                                className={styles.settingsControl}
                                type="date"
                                value={editSlotDate}
                                onChange={(e) => setEditSlotDate(e.target.value)}
                              />
                            </label>
                            <label className={styles.settingsField}>
                              <span>Start</span>
                              <input
                                className={styles.settingsControl}
                                type="time"
                                value={editSlotStart}
                                onChange={(e) => setEditSlotStart(e.target.value)}
                              />
                            </label>
                            <label className={styles.settingsField}>
                              <span>Slut</span>
                              <input
                                className={styles.settingsControl}
                                type="time"
                                value={editSlotEnd}
                                onChange={(e) => setEditSlotEnd(e.target.value)}
                              />
                            </label>
                          </div>
                          <div className={styles.reportHistoryActions}>
                            <button
                              type="button"
                              className={styles.reportRowBtn}
                              onClick={saveOpenSlotEdit}
                              disabled={settingsSaving}
                            >
                              Gem
                            </button>
                            <button
                              type="button"
                              className={styles.reportRowBtnGhost}
                              onClick={cancelEditOpenSlot}
                              disabled={settingsSaving}
                            >
                              Annuller
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className={styles.name}>
                              {isRecurringSlot(slot)
                                ? `${formatWeekdayDa(slot.start_time)}`
                                : new Date(slot.start_time).toLocaleDateString('da-DK')}{' '}
                              ·{' '}
                              {new Date(slot.start_time).toLocaleTimeString('da-DK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(slot.end_time).toLocaleTimeString('da-DK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div
                              className={`${styles.meta} ${isRecurringSlot(slot) ? styles.metaRecurring : ''}`}
                            >
                              {slot.is_booked
                                ? 'Booket'
                                : isRecurringSlot(slot)
                                  ? `Gentagelse · ${recurrenceLabel(slot.recurrence_pattern)}`
                                  : 'Åben'}
                            </div>
                          </div>
                          <div className={styles.reportHistoryActions}>
                            <button
                              type="button"
                              className={styles.reportRowBtn}
                              onClick={() => startEditOpenSlot(slot)}
                              disabled={slot.is_booked}
                            >
                              Rediger
                            </button>
                            <button
                              type="button"
                              className={styles.settingsDangerBtn}
                              onClick={() => deleteOpenSlot(slot.id)}
                              disabled={settingsSaving || slot.is_booked}
                            >
                              Slet
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {settingsFeedback && (
              <div
                className={`${styles.meta} ${
                  settingsFeedback.includes('Du har allerede oprettet en tid i dette tidsrum')
                    ? styles.metaError
                    : ''
                }`}
              >
                {settingsFeedback}
              </div>
            )}
            {professionalSettings?.user_id && <div className={styles.meta}>Profil klar til redigering.</div>}
          </div>
        )}

        {currentView !== 'patients' && currentView !== 'messages' && currentView !== 'calendar' && currentView !== 'reporting' && currentView !== 'stats' && currentView !== 'settings' && (
          <div className={styles.meta}>Denne sektion er under opbygning.</div>
        )}
      </section>
    </div>
  )
}
