'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import docStyles from '@/app/doctor/doctorPage.module.css'

type Conversation = {
  id: string
  patient_id: string
  doctor_id: string
  created_from_appointment_id: string | null
  kind?: 'clinical' | 'admin' | string | null
  created_at?: string
}

type Message = {
  id: string
  body: string
  created_at: string
  sender_id: string
  conversation_id: string
}

type PatientBookingRow = {
  id: string
  professional_id: string
  status: string
  start_time: string
}

function sortConversationsList(list: Conversation[]) {
  return [...list].sort((a, b) => {
    if (a.kind === 'admin' && b.kind !== 'admin') return -1
    if (a.kind !== 'admin' && b.kind === 'admin') return 1
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
}

const appointmentStatusMetaDa = (status: string) => {
  if (status === 'confirmed') return 'Bekræftet tid'
  if (status === 'requested') return 'Afventer bekræftelse fra behandler'
  return status
}

function MessagesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [previewMessages, setPreviewMessages] = useState<Message[]>([])
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({})
  const [activeCounterpartName, setActiveCounterpartName] = useState<string | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientAppointments, setPatientAppointments] = useState<PatientBookingRow[]>([])
  const [startingWithProfessionalId, setStartingWithProfessionalId] = useState<string | null>(null)

  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const { data: rawConversations, error: conversationError } = await supabase
        .from('conversations')
        .select('id,patient_id,doctor_id,created_from_appointment_id,kind,created_at')
        .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (conversationError) {
        setLoading(false)
        setError(conversationError.message)
        return
      }

      let nextConversations = (rawConversations ?? []) as Conversation[]

      if (session?.access_token) {
        const ensureRes = await fetch('/api/support/ensure-admin-conversation', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (ensureRes.ok) {
          const ensureJson = (await ensureRes.json().catch(() => ({}))) as {
            conversationId?: string
            conversation?: Conversation
          }
          const ensured = ensureJson.conversation
          const cid = ensureJson.conversationId
          if (ensured?.id && !nextConversations.some((c) => c.id === ensured.id)) {
            nextConversations = [ensured, ...nextConversations]
          } else if (cid && !nextConversations.some((c) => c.id === cid)) {
            const { data: extra } = await supabase
              .from('conversations')
              .select('id,patient_id,doctor_id,created_from_appointment_id,kind,created_at')
              .eq('id', cid)
              .maybeSingle()
            if (extra) nextConversations = [extra as Conversation, ...nextConversations]
          }
        }
      }

      nextConversations = sortConversationsList(nextConversations)

      setConversations(nextConversations)

      const { data: bookingRows, error: bookingErr } = await supabase
        .from('appointments')
        .select('id,professional_id,status,start_time')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'requested'])
        .order('start_time', { ascending: false })

      if (bookingErr) {
        setPatientAppointments([])
      } else {
        setPatientAppointments((bookingRows ?? []) as PatientBookingRow[])
      }

      const conversationIds = nextConversations.map((c) => c.id)
      if (conversationIds.length > 0) {
        const { data: rawPreview } = await supabase
          .from('messages')
          .select('id,body,created_at,sender_id,conversation_id')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(120)
        setPreviewMessages((rawPreview ?? []) as Message[])
      } else {
        setPreviewMessages([])
      }

      const preferAdmin =
        searchParams.get('admin') === '1' || searchParams.get('thread') === 'admin'
      const adminConv = nextConversations.find((c) => c.kind === 'admin')
      const initial =
        preferAdmin && adminConv ? adminConv.id : nextConversations[0]?.id
      if (initial) setSelectedConversationId(initial)

      const bookingProIds = Array.from(
        new Set(((bookingErr ? [] : bookingRows) ?? []).map((a) => a.professional_id))
      )
      const relatedIds = Array.from(
        new Set([
          ...nextConversations.flatMap((c) => [c.patient_id, c.doctor_id]).filter(Boolean),
          ...bookingProIds,
        ])
      )

      if (relatedIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id,full_name').in('id', relatedIds)
        const names = (profiles ?? []).reduce<Record<string, string>>((acc, item: any) => {
          if (item?.id && item?.full_name) acc[item.id] = item.full_name
          return acc
        }, {})
        setProfileNamesById(names)
      }

      setLoading(false)
    }

    load()
  }, [router, searchParams])

  useEffect(() => {
    if (!userId) return
    localStorage.setItem(`patient_messages_seen_at_${userId}`, new Date().toISOString())
  }, [userId])

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversationId) {
        setMessages([])
        return
      }

      setThreadLoading(true)
      const { data, error: messageError } = await supabase
        .from('messages')
        .select('id,body,created_at,sender_id,conversation_id')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true })

      if (messageError) {
        setError(messageError.message)
        setThreadLoading(false)
        return
      }

      setMessages((data ?? []) as Message[])
      setThreadLoading(false)
    }

    void loadMessages()
  }, [selectedConversationId])

  useEffect(() => {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages.length, selectedConversationId])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  )

  const adminConversation = useMemo(
    () => conversations.find((c) => c.kind === 'admin') ?? null,
    [conversations]
  )

  const professionalsEligibleToStart = useMemo(() => {
    if (!userId) return []
    const byProfessional = new Map<string, PatientBookingRow>()
    for (const a of patientAppointments) {
      if (!byProfessional.has(a.professional_id)) {
        byProfessional.set(a.professional_id, a)
      }
    }
    const out: {
      professionalId: string
      appointmentId: string
      status: string
      startTime: string
    }[] = []
    for (const [professionalId, row] of byProfessional) {
      const hasThread = conversations.some(
        (c) => c.kind !== 'admin' && c.patient_id === userId && c.doctor_id === professionalId
      )
      if (!hasThread) {
        out.push({
          professionalId,
          appointmentId: row.id,
          status: row.status,
          startTime: row.start_time,
        })
      }
    }
    return out
  }, [userId, patientAppointments, conversations])

  const latestMessageByConversationId = useMemo(() => {
    return previewMessages.reduce<Record<string, Message>>((acc, message) => {
      const current = acc[message.conversation_id]
      if (!current || new Date(message.created_at).getTime() > new Date(current.created_at).getTime()) {
        acc[message.conversation_id] = message
      }
      return acc
    }, {})
  }, [previewMessages])

  const clinicalSidebarRows = useMemo(() => {
    if (!userId) return []
    const clinical = conversations.filter((c) => c.kind !== 'admin')
    return clinical
      .map((conversation) => {
        const counterpartId =
          conversation.patient_id === userId ? conversation.doctor_id : conversation.patient_id
        const name = profileNamesById[counterpartId] ?? 'Behandler'
        const initials =
          name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('') || 'B'
        const latest = latestMessageByConversationId[conversation.id] ?? null
        const needsReply = Boolean(latest && userId && latest.sender_id !== userId)
        return { conversation, name, initials, latest, needsReply }
      })
      .sort((a, b) => {
        const ta = a.latest ? new Date(a.latest.created_at).getTime() : 0
        const tb = b.latest ? new Date(b.latest.created_at).getTime() : 0
        return tb - ta
      })
  }, [conversations, userId, profileNamesById, latestMessageByConversationId])

  const adminPinnedLatest = adminConversation
    ? latestMessageByConversationId[adminConversation.id] ?? null
    : null

  const adminPinnedNeedsReply = Boolean(
    adminPinnedLatest && userId && adminPinnedLatest.sender_id !== userId
  )

  const isAdminThreadSelected = Boolean(
    adminConversation && selectedConversationId === adminConversation.id
  )

  const otherPartyId =
    selectedConversation && userId
      ? selectedConversation.patient_id === userId
        ? selectedConversation.doctor_id
        : selectedConversation.patient_id
      : null

  useEffect(() => {
    const loadActiveCounterpartName = async () => {
      if (!selectedConversation || !userId) {
        setActiveCounterpartName(null)
        return
      }

      if (selectedConversation.kind === 'admin') {
        setActiveCounterpartName(null)
        return
      }

      const counterpartId =
        selectedConversation.patient_id === userId
          ? selectedConversation.doctor_id
          : selectedConversation.patient_id

      if (!counterpartId) {
        setActiveCounterpartName(null)
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', counterpartId)
        .maybeSingle()

      if (profileError) {
        setActiveCounterpartName(null)
        return
      }

      setActiveCounterpartName(data?.full_name ?? null)
    }

    void loadActiveCounterpartName()
  }, [selectedConversation, userId])

  const profileFullName = otherPartyId ? profileNamesById[otherPartyId] : null
  const otherPartyName =
    selectedConversation?.kind === 'admin'
      ? 'Administrationen'
      : activeCounterpartName ||
        profileFullName ||
        (selectedConversation ? 'Behandler' : 'Beskeder')

  const sendMessage = async () => {
    if (!userId || !selectedConversationId) return
    if (!messageBody.trim()) return

    setSending(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversationId,
        sender_id: userId,
        body: messageBody.trim(),
      })
      .select('id,body,created_at,sender_id,conversation_id')
      .single()

    setSending(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    const inserted = data as Message
    setMessages((current) => [...current, inserted])
    setPreviewMessages((prev) => [inserted, ...prev])
    setMessageBody('')
  }

  const startClinicalConversation = async (professionalId: string) => {
    if (!userId || startingWithProfessionalId) return
    setStartingWithProfessionalId(professionalId)
    setError(null)

    const { data: appt } = await supabase
      .from('appointments')
      .select('id')
      .eq('user_id', userId)
      .eq('professional_id', professionalId)
      .in('status', ['confirmed', 'requested'])
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: inserted, error: insErr } = await supabase
      .from('conversations')
      .insert({
        patient_id: userId,
        doctor_id: professionalId,
        kind: 'clinical',
        created_from_appointment_id: appt?.id ?? null,
      })
      .select('id,patient_id,doctor_id,created_from_appointment_id,kind,created_at')
      .single()

    let conv = inserted as Conversation | null
    if (insErr) {
      const isDup = (insErr as { code?: string }).code === '23505'
      if (isDup) {
        const { data: existing } = await supabase
          .from('conversations')
          .select('id,patient_id,doctor_id,created_from_appointment_id,kind,created_at')
          .eq('patient_id', userId)
          .eq('doctor_id', professionalId)
          .maybeSingle()
        conv = (existing as Conversation) ?? null
      }
      if (!conv) {
        setError(insErr.message)
        setStartingWithProfessionalId(null)
        return
      }
    }

    setStartingWithProfessionalId(null)
    if (!conv?.id) return

    setConversations((prev) => sortConversationsList([...prev.filter((c) => c.id !== conv!.id), conv!]))
    setSelectedConversationId(conv.id)
  }

  if (loading) return <div className="text-sm text-slate-500">Loader beskeder...</div>

  return (
    <div className="wrap">
      <div className="backRow">
        <button type="button" onClick={() => router.push('/dashboard')} className="backBtn">
          ← Tilbage til overblik
        </button>
      </div>

      {error ? <div className="error">Fejl: {error}</div> : null}

      <div className={docStyles.messagesShell}>
        <aside className={docStyles.messagesSidebar}>
          <div className={docStyles.list}>
            {adminConversation ? (
              <button
                type="button"
                className={`${docStyles.row} ${docStyles.rowPinned} ${isAdminThreadSelected ? docStyles.rowActive : ''} ${adminPinnedNeedsReply ? docStyles.rowNeedsReply : ''}`}
                onClick={() => setSelectedConversationId(adminConversation.id)}
              >
                <div className={docStyles.avatar}>A</div>
                <div className={docStyles.rowMain}>
                  <div className={docStyles.name}>
                    <span className={docStyles.pinnedBadge}>Fastgjort</span>
                    Administrationen
                  </div>
                  <div className={docStyles.meta}>
                    {adminPinnedLatest?.body?.slice(0, 80) ??
                      'Skriv her ved problemer med platformen, din konto eller andet praktisk.'}
                  </div>
                </div>
                {adminPinnedNeedsReply ? <span className={docStyles.replyBadge}>Afventer svar</span> : null}
              </button>
            ) : null}

            {professionalsEligibleToStart.map((p) => {
              const name = profileNamesById[p.professionalId] ?? 'Din behandler'
              const initials =
                name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? '')
                  .join('') || '+'
              const busy = startingWithProfessionalId !== null
              return (
                <button
                  key={`start-${p.professionalId}`}
                  type="button"
                  disabled={busy}
                  className={`${docStyles.row} startConvRow`}
                  onClick={() => void startClinicalConversation(p.professionalId)}
                >
                  <div className={docStyles.avatar}>{initials}</div>
                  <div className={docStyles.rowMain}>
                    <div className={docStyles.name}>Start samtale med {name}</div>
                    <div className={docStyles.meta}>
                      {startingWithProfessionalId === p.professionalId
                        ? 'Opretter…'
                        : `${appointmentStatusMetaDa(p.status)} · ${new Date(p.startTime).toLocaleString('da-DK', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`}
                    </div>
                  </div>
                </button>
              )
            })}

            {clinicalSidebarRows.map((row) => (
              <button
                key={row.conversation.id}
                type="button"
                className={`${docStyles.row} ${selectedConversationId === row.conversation.id ? docStyles.rowActive : ''} ${row.needsReply ? docStyles.rowNeedsReply : ''}`}
                onClick={() => setSelectedConversationId(row.conversation.id)}
              >
                <div className={docStyles.avatar}>{row.initials}</div>
                <div className={docStyles.rowMain}>
                  <div className={docStyles.name}>{row.name}</div>
                  <div className={docStyles.meta}>
                    {row.latest?.body?.slice(0, 80) ?? 'Ingen beskeder endnu'}
                  </div>
                </div>
                {row.needsReply ? <span className={docStyles.replyBadge}>Afventer svar</span> : null}
              </button>
            ))}

            {clinicalSidebarRows.length === 0 && professionalsEligibleToStart.length === 0 ? (
              <div className={docStyles.metaMuted}>Ingen behandler-samtaler endnu. Book en konsultation for at skrive til en behandler.</div>
            ) : null}
          </div>
        </aside>

        <section className={docStyles.messageThread}>
          <div className={docStyles.threadTopbar}>
            <div className={docStyles.threadTitle}>{otherPartyName}</div>
          </div>

          <div className={docStyles.threadNotice}>
            <span aria-hidden="true">💬</span>
            <span>
              {selectedConversation?.kind === 'admin'
                ? 'Her skriver du med Hormoni-administrationen. Tråden er adskilt fra din behandler — skriv hvis der er problemer med platformen, din konto eller andet praktisk.'
                : 'Skriv med din behandler her. Samme tråd vises hos gynækologen.'}
            </span>
          </div>

          <div className={docStyles.threadMessages} ref={scrollerRef}>
            {threadLoading ? (
              <div className={docStyles.meta}>Loader beskeder...</div>
            ) : messages.length === 0 ? (
              <div className={docStyles.meta}>Ingen beskeder i denne tråd endnu.</div>
            ) : (
              messages.map((m) => {
                const own = m.sender_id === userId
                return (
                  <div key={m.id} className={`${docStyles.msgRow} ${own ? docStyles.msgOwn : docStyles.msgTheir}`}>
                    <div
                      className={`${docStyles.msgBubble} ${own ? docStyles.msgBubbleOwn : docStyles.msgBubbleTheir}`}
                    >
                      {m.body}
                    </div>
                    <div className={docStyles.msgTime}>
                      {new Date(m.created_at).toLocaleTimeString('da-DK', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className={docStyles.threadComposer}>
            <textarea
              className={docStyles.threadInput}
              rows={1}
              placeholder="Skriv besked..."
              value={messageBody}
              disabled={!selectedConversationId}
              onChange={(e) => setMessageBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <button
              type="button"
              className={docStyles.threadSendBtn}
              disabled={sending || !selectedConversationId}
              onClick={() => void sendMessage()}
            >
              {sending ? '…' : '➤'}
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .wrap {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0;
        }

        .backRow {
          margin-bottom: 14px;
        }

        .backBtn {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .backBtn:hover {
          background: #f9fafb;
        }

        .error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 12px;
        }

        :global(.startConvRow) {
          border: 1px dashed #c7d2fe;
          background: linear-gradient(90deg, rgba(99, 102, 241, 0.06) 0%, transparent 14px);
        }

        :global(.startConvRow:hover:not(:disabled)) {
          background: #f5f3ff;
        }

        :global(.startConvRow:disabled) {
          opacity: 0.7;
          cursor: wait;
        }
      `}</style>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loader beskeder...</div>}>
      <MessagesPageContent />
    </Suspense>
  )
}
