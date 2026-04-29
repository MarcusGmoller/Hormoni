'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Conversation = {
  id: string
  patient_id: string
  doctor_id: string
  created_from_appointment_id: string | null
}

type Message = {
  id: string
  body: string
  created_at: string
  sender_id: string
  conversation_id: string
}

type TimelineItem =
  | { type: 'date'; key: string; label: string }
  | { type: 'message'; key: string; message: Message }

const toDateKey = (value: string) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const formatDatePill = (value: string) => {
  const date = new Date(value)
  const today = new Date()
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  if (isToday) return 'I dag'
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })
}

export default function MessagesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({})
  const [activeCounterpartName, setActiveCounterpartName] = useState<string | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const { data: rawConversations, error: conversationError } = await supabase
        .from('conversations')
        .select('id,patient_id,doctor_id,created_from_appointment_id')
        .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (conversationError) {
        setLoading(false)
        setError(conversationError.message)
        return
      }

      const nextConversations = (rawConversations ?? []) as Conversation[]
      setConversations(nextConversations)
      if (nextConversations.length > 0) {
        setSelectedConversationId(nextConversations[0].id)
      }

      const relatedIds = Array.from(
        new Set(nextConversations.flatMap((c) => [c.patient_id, c.doctor_id]).filter(Boolean))
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
  }, [router])

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

      const { data, error: messageError } = await supabase
        .from('messages')
        .select('id,body,created_at,sender_id,conversation_id')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true })

      if (messageError) {
        setError(messageError.message)
        return
      }

      setMessages((data ?? []) as Message[])
    }

    loadMessages()
  }, [selectedConversationId])

  useEffect(() => {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages.length, selectedConversationId])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
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

    loadActiveCounterpartName()
  }, [selectedConversation, userId])

  const profileFullName = otherPartyId ? profileNamesById[otherPartyId] : null
  const otherPartyName =
    activeCounterpartName ||
    profileFullName ||
    (selectedConversation ? 'Gynækolog' : 'Samtale')

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = []
    let previousDateKey: string | null = null
    messages.forEach((m) => {
      const dateKey = toDateKey(m.created_at)
      if (dateKey !== previousDateKey) {
        items.push({ type: 'date', key: `date-${dateKey}`, label: formatDatePill(m.created_at) })
        previousDateKey = dateKey
      }
      items.push({ type: 'message', key: m.id, message: m })
    })
    return items
  }, [messages])

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

    setMessages((current) => [...current, data as Message])
    setMessageBody('')
  }

  if (loading) return <div className="text-sm text-slate-500">Loader beskeder...</div>

  return (
    <div className="wrap">
      <div className="backRow">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="backBtn"
        >
          ← Tilbage til overblik
        </button>
      </div>

      {error && <div className="error">Fejl: {error}</div>}

      <section className="shell">
        <header className="topbar">
          <div className="title">{otherPartyName}</div>

          {conversations.length > 1 && (
            <select
              className="select"
              value={selectedConversationId}
              onChange={(e) => setSelectedConversationId(e.target.value)}
            >
              {conversations.map((conversation) => {
                const counterpartId =
                  userId && conversation.patient_id === userId ? conversation.doctor_id : conversation.patient_id
                return (
                  <option key={conversation.id} value={conversation.id}>
                    {(counterpartId && profileNamesById[counterpartId]) ?? 'Samtale'}
                  </option>
                )
              })}
            </select>
          )}
        </header>

        <div className="notice">
          <span className="noticeIcon">💬</span>
          <span>Du kan altid skrive til din behandler. Vi svarer normalt inden for 24 timer på hverdage.</span>
        </div>

        <div ref={scrollerRef} className="messages">
          <div className="messagesInner">
            {timelineItems.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="dateRow">
                    <span className="datePill">{item.label}</span>
                  </div>
                )
              }

              const m = item.message
              const own = m.sender_id === userId

              return (
                <div key={item.key} className={`row ${own ? 'own' : 'their'}`}>
                  {!own && <div className="avatar" aria-hidden="true" />}

                  <div className="col">
                    {!own && <div className="name">{otherPartyName}</div>}

                    <div className={`bubble ${own ? 'bubbleOwn' : 'bubbleTheir'}`}>{m.body}</div>

                    <div className={`time ${own ? 'timeOwn' : 'timeTheir'}`}>
                      {new Date(m.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}

            {selectedConversationId && messages.length === 0 && (
              <div className="empty">Ingen beskeder i denne tråd endnu.</div>
            )}
          </div>
        </div>

        <footer className="composer">
          <textarea
            className="input"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Skriv din besked..."
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />

          <button className="sendBtn" type="button" onClick={sendMessage} disabled={sending || !selectedConversationId}>
            {sending ? '…' : '➤'}
          </button>
        </footer>
      </section>

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

        .shell {
          min-height: 560px;
          height: min(70vh, 720px);
          background: #f7f5f2;
          border: 1px solid #ece7e1;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .topbar {
          flex-shrink: 0;
          background: #ffffff;
          border-bottom: 1px solid #eee8e1;
          padding: 14px 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
        }

        .select {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          background: #fff;
        }

        .notice {
          flex-shrink: 0;
          margin: 12px 14px 0;
          background: #fffdfa;
          border: 1px solid #eee5dc;
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 13px;
          color: #374151;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .noticeIcon {
          line-height: 1;
          margin-top: 1px;
        }

        .messages {
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px 14px 12px;
        }

        .messagesInner {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
          justify-content: flex-end;
        }

        .messagesInner > .dateRow,
        .messagesInner > .row,
        .messagesInner > .empty {
          flex-shrink: 0;
        }

        .dateRow {
          display: flex;
          justify-content: center;
        }

        .datePill {
          font-size: 11px;
          color: #6b7280;
          background: #ececec;
          padding: 3px 10px;
          border-radius: 999px;
        }

        .row {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }

        .own {
          justify-content: flex-end;
        }

        .their {
          justify-content: flex-start;
        }

        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: #d9e3db;
          flex: 0 0 auto;
        }

        .col {
          max-width: 78%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .own .col {
          align-items: flex-end;
        }

        .name {
          font-size: 11px;
          color: #6b7280;
          padding-left: 4px;
        }

        .bubble {
          padding: 10px 12px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.35;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
          word-break: break-word;
          white-space: pre-wrap;
        }

        .bubbleTheir {
          background: #fffdfa;
          border: 1px solid #eee5dc;
          color: #1f2937;
          border-bottom-left-radius: 8px;
        }

        .bubbleOwn {
          background: #84a795;
          color: white;
          border: 0;
          border-bottom-right-radius: 8px;
        }

        .time {
          font-size: 11px;
          color: #9ca3af;
          padding: 0 6px;
        }

        .timeOwn {
          text-align: right;
        }

        .timeTheir {
          text-align: left;
        }

        .empty {
          background: #ffffff;
          border: 1px solid #eee8e1;
          border-radius: 14px;
          padding: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .composer {
          flex-shrink: 0;
          margin-top: auto;
          background: #ffffff;
          border-top: 1px solid #eee8e1;
          padding: 10px 10px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .input {
          flex: 1;
          resize: none;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          outline: none;
          line-height: 1.35;
          max-height: 120px;
          align-self: stretch;
        }

        .input:focus {
          border-color: #84a795;
        }

        .sendBtn {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          border: 0;
          background: #84a795;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
        }

        .sendBtn:disabled {
          opacity: 0.5;
          cursor: default;
        }
      `}</style>
    </div>
  )
}