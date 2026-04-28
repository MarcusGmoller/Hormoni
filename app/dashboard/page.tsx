'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: 'requested' | 'confirmed' | 'cancelled' | string
  professional_id: string
}

type Message = {
  id: string
  body: string
  created_at: string
  sender_id: string
  recipient_id: string
  appointment_id: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({})
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('profile_completed,role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error(error)
        router.push('/login')
        return
      }

      if (profile?.role === 'professional') {
        router.push('/gynaekolog-dashboard')
        return
      }

      if (!profile?.profile_completed) {
        router.push('/onboarding')
        return
      }

      setUserId(user.id)
      setLoading(false)

      setAppointmentsLoading(true)
      setAppointmentsError(null)
      setMessagesLoading(true)
      setMessagesError(null)

      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select('id,start_time,end_time,status,professional_id')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(10)

      setAppointmentsLoading(false)

      if (apptsError) {
        setAppointmentsError(apptsError.message)
        return
      }

      const nextAppointments = (appts ?? []) as Appointment[]
      setAppointments(nextAppointments)

      if (nextAppointments.length > 0) {
        setSelectedAppointmentId((current) => current || nextAppointments[0].id)
      }

      const { data: rawMessages, error: rawMessagesError } = await supabase
        .from('messages')
        .select('id,body,created_at,sender_id,recipient_id,appointment_id')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20)

      setMessagesLoading(false)

      if (rawMessagesError) {
        setMessagesError(rawMessagesError.message)
      } else {
        setMessages((rawMessages ?? []) as Message[])
      }

      const relatedProfileIds = Array.from(
        new Set([
          ...nextAppointments.map((appointment) => appointment.professional_id),
          ...((rawMessages ?? []) as Message[]).flatMap((message) => [message.sender_id, message.recipient_id]),
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

  const logout = async () => {
    setLoggingOut(true)
    const { error } = await supabase.auth.signOut()
    setLoggingOut(false)

    if (error) {
      console.error(error)
      return
    }

    router.push('/login')
    router.refresh()
  }

  const sendMessage = async () => {
    if (!userId) return

    const selectedAppointment = appointments.find((appointment) => appointment.id === selectedAppointmentId)

    if (!selectedAppointment) {
      setMessagesError('Vaelg en appointment foerst.')
      return
    }

    if (!messageBody.trim()) {
      setMessagesError('Skriv en besked foerst.')
      return
    }

    setSendingMessage(true)
    setMessagesError(null)

    const payload = {
      appointment_id: selectedAppointment.id,
      sender_id: userId,
      recipient_id: selectedAppointment.professional_id,
      body: messageBody.trim(),
    }

    const { data: insertedMessage, error } = await supabase
      .from('messages')
      .insert(payload)
      .select('id,body,created_at,sender_id,recipient_id,appointment_id')
      .single()

    setSendingMessage(false)

    if (error) {
      setMessagesError(error.message)
      return
    }

    setMessages((current) => [insertedMessage as Message, ...current])
    setMessageBody('')
  }

  const now = new Date()
  const upcomingAppointments = appointments.filter(
    (appointment) => new Date(appointment.start_time).getTime() >= now.getTime()
  )
  const confirmedAppointments = appointments.filter((appointment) => appointment.status === 'confirmed')
  const requestedAppointments = appointments.filter((appointment) => appointment.status === 'requested')

  if (loading) return <main className="p-6">Loader...</main>

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bruger dashboard</h1>
          <p className="text-gray-600">Faa et hurtigt overblik over dine bookinger og beskeder.</p>
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="border rounded px-4 py-2"
        >
          {loggingOut ? 'Logger ud...' : 'Log ud'}
        </button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-gray-500">Kommende bookinger</div>
          <div className="mt-2 text-3xl font-semibold">{upcomingAppointments.length}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-gray-500">Bekraeftede tider</div>
          <div className="mt-2 text-3xl font-semibold">{confirmedAppointments.length}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-gray-500">Aabne forespoergsler</div>
          <div className="mt-2 text-3xl font-semibold">{requestedAppointments.length}</div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Appointments</h2>
            <span className="text-sm text-gray-500">Seneste 10</span>
          </div>

          {appointmentsLoading && <div>Loader bookinger...</div>}

          {appointmentsError && (
            <div className="mb-4 text-red-600">Fejl: {appointmentsError}</div>
          )}

          {!appointmentsLoading && !appointmentsError && appointments.length === 0 && (
            <div className="rounded-xl bg-gray-50 p-4 text-gray-600">
              Du har ingen bookinger endnu.
            </div>
          )}

          <div className="space-y-3">
            {appointments.map((a) => (
              <div key={a.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {new Date(a.start_time).toLocaleString('da-DK')}
                    {' '}–{' '}
                    {new Date(a.end_time).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <span className="rounded-full border px-2 py-1 text-sm">
                    {a.status}
                  </span>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  Gynækolog: {profileNamesById[a.professional_id] ?? a.professional_id}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Messages</h2>
            <span className="text-sm text-gray-500">{messages.length}</span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border p-4">
              <div className="mb-3 text-sm font-medium">Ny besked</div>

              <select
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
                className="mb-3 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Vaelg appointment</option>
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {(profileNamesById[appointment.professional_id] ?? 'Gynaekolog')} - {new Date(appointment.start_time).toLocaleDateString('da-DK')}
                  </option>
                ))}
              </select>

              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Skriv til din gynaekolog"
                className="min-h-24 w-full rounded border px-3 py-2 text-sm"
              />

              <button
                onClick={sendMessage}
                disabled={sendingMessage || appointments.length === 0}
                className="mt-3 w-full rounded bg-black px-4 py-3 text-white disabled:opacity-50"
              >
                {sendingMessage ? 'Sender...' : 'Send besked'}
              </button>
            </div>

            {messagesLoading && <div>Loader beskeder...</div>}

            {messagesError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                Fejl: {messagesError}
              </div>
            )}

            {!messagesLoading && !messagesError && messages.length === 0 && (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                Du har ingen beskeder endnu.
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => {
                const otherPartyId =
                  message.sender_id === userId ? message.recipient_id : message.sender_id

                return (
                  <div key={message.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {profileNamesById[otherPartyId] ?? 'Gynaekolog'}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">
                        {new Date(message.created_at).toLocaleString('da-DK')}
                      </div>
                    </div>

                    <p className="mt-2 text-sm text-gray-700">{message.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}