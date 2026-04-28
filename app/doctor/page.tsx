'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Appointment = {
  id: string
  user_id: string
  professional_id: string
  start_time: string
  end_time: string
  status: string
}

type Message = {
  id: string
  body: string
  created_at: string
  sender_id: string
  recipient_id: string
  appointment_id: string | null
}

export default function DoctorPage() {
  const router = useRouter()

  const [items, setItems] = useState<Appointment[]>([])
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [doctorEmail, setDoctorEmail] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [patientNamesById, setPatientNamesById] = useState<Record<string, string>>({})
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    setMessageError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      setLoading(false)
      setError(profileError.message)
      return
    }

    if (profile?.role !== 'professional') {
      router.push('/userdashboard')
      return
    }

    setDoctorEmail(user.email ?? null)
    setDoctorId(user.id)

    const { data, error } = await supabase
      .from('appointments')
      .select('id,user_id,professional_id,start_time,end_time,status')
      .eq('professional_id', user.id)
      .eq('status', 'requested')
      .order('start_time', { ascending: true })

    const { data: allAppointmentData, error: allAppointmentsError } = await supabase
      .from('appointments')
      .select('id,user_id,professional_id,start_time,end_time,status')
      .eq('professional_id', user.id)
      .order('start_time', { ascending: false })

    const { data: rawMessages, error: rawMessagesError } = await supabase
      .from('messages')
      .select('id,body,created_at,sender_id,recipient_id,appointment_id')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20)

    setLoading(false)
    setMessagesLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (allAppointmentsError) {
      setError(allAppointmentsError.message)
      return
    }

    if (rawMessagesError) {
      setMessageError(rawMessagesError.message)
    }

    setItems((data ?? []) as any)
    const nextAllAppointments = (allAppointmentData ?? []) as Appointment[]
    setAllAppointments(nextAllAppointments)
    setMessages((rawMessages ?? []) as Message[])

    if (nextAllAppointments.length > 0) {
      setSelectedAppointmentId((current) => current || nextAllAppointments[0].id)
    }

    const patientIds = Array.from(
      new Set(nextAllAppointments.map((appointment) => appointment.user_id))
    )

    if (patientIds.length > 0) {
      const { data: patients } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', patientIds)

      const namesById = (patients ?? []).reduce<Record<string, string>>((acc, patient: any) => {
        if (patient?.id && patient?.full_name) {
          acc[patient.id] = patient.full_name
        }

        return acc
      }, {})

      setPatientNamesById(namesById)
    } else {
      setPatientNamesById({})
    }
  }

  useEffect(() => {
    load()
  }, [])

  const accept = async (id: string) => {
    setError(null)

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await load()
  }

  const sendMessage = async () => {
    if (!doctorId) return

    const selectedAppointment = allAppointments.find((appointment) => appointment.id === selectedAppointmentId)

    if (!selectedAppointment) {
      setMessageError('Vaelg en appointment foerst.')
      return
    }

    if (!messageBody.trim()) {
      setMessageError('Skriv en besked foerst.')
      return
    }

    setSendingMessage(true)
    setMessageError(null)

    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        appointment_id: selectedAppointment.id,
        sender_id: doctorId,
        recipient_id: selectedAppointment.user_id,
        body: messageBody.trim(),
      })
      .select('id,body,created_at,sender_id,recipient_id,appointment_id')
      .single()

    setSendingMessage(false)

    if (insertError) {
      setMessageError(insertError.message)
      return
    }

    setMessages((current) => [insertedMessage as Message, ...current])
    setMessageBody('')
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Gynækolog dashboard</h1>

      {doctorId && (
        <p className="text-sm text-gray-600 mb-4">
          Logget ind som: {doctorEmail} ({doctorId})
        </p>
      )}

      {loading && <div>Loader...</div>}
      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="text-gray-600 mt-6">
          Ingen booking-forespørgsler lige nu.
        </div>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">Booking-forespørgsler</h2>

          <div className="space-y-3">
            {items.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <div className="font-semibold">
                    {new Date(a.start_time).toLocaleString('da-DK')}
                    {' '}–{' '}
                    {new Date(a.end_time).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Patient: {patientNamesById[a.user_id] ?? a.user_id}
                  </div>
                  <div className="text-sm text-gray-600">Status: {a.status}</div>
                </div>

                <button onClick={() => accept(a.id)} className="rounded bg-black px-3 py-2 text-white">
                  Acceptér
                </button>
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
                {allAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {(patientNamesById[appointment.user_id] ?? 'Patient')} - {new Date(appointment.start_time).toLocaleDateString('da-DK')}
                  </option>
                ))}
              </select>

              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Skriv til patienten"
                className="min-h-24 w-full rounded border px-3 py-2 text-sm"
              />

              <button
                onClick={sendMessage}
                disabled={sendingMessage || allAppointments.length === 0}
                className="mt-3 w-full rounded bg-black px-4 py-3 text-white disabled:opacity-50"
              >
                {sendingMessage ? 'Sender...' : 'Send besked'}
              </button>
            </div>

            {messagesLoading && <div>Loader beskeder...</div>}

            {messageError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                Fejl: {messageError}
              </div>
            )}

            {!messagesLoading && !messageError && messages.length === 0 && (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                Ingen beskeder endnu.
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => {
                const otherPartyId =
                  message.sender_id === doctorId ? message.recipient_id : message.sender_id

                return (
                  <div key={message.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {patientNamesById[otherPartyId] ?? 'Patient'}
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