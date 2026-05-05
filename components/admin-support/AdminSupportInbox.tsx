'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import styles from './adminSupportChat.module.css'

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
  sender_id: string
  conversation_id: string
}

const supportParticipantRoleLabelDa = (role: string | null | undefined) => {
  switch (role) {
    case 'professional':
      return 'Behandler'
    case 'user':
      return 'Bruger'
    case 'admin':
      return 'Administrator'
    default:
      return 'Ukendt rolle'
  }
}

export default function AdminSupportInbox() {
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [roleByPatientId, setRoleByPatientId] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoadingList(false)
      return
    }
    setUserId(user.id)

    const { data: rows, error: listErr } = await supabase
      .from('conversations')
      .select('id,patient_id,doctor_id,created_at')
      .eq('kind', 'admin')
      .order('created_at', { ascending: false })

    if (listErr) {
      setError(listErr.message)
      setLoadingList(false)
      return
    }

    const list = (rows ?? []) as Conversation[]
    setConversations(list)
    if (list.length > 0) setSelectedId((s) => s || list[0].id)

    const ids = Array.from(new Set(list.map((c) => c.patient_id)))
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id,full_name,role').in('id', ids)
      const nameMap: Record<string, string> = {}
      const roleMap: Record<string, string> = {}
      for (const p of profiles ?? []) {
        const row = p as { id: string; full_name: string | null; role: string | null }
        if (row.id && row.full_name) nameMap[row.id] = row.full_name
        if (row.id && row.role) roleMap[row.id] = row.role
      }
      setNamesById(nameMap)
      setRoleByPatientId(roleMap)
    } else {
      setNamesById({})
      setRoleByPatientId({})
    }

    setLoadingList(false)
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    const loadThread = async () => {
      if (!selectedId) {
        setMessages([])
        return
      }
      setLoadingThread(true)
      const { data, error: msgErr } = await supabase
        .from('messages')
        .select('id,body,created_at,sender_id,conversation_id')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true })

      if (msgErr) setError(msgErr.message)
      else setMessages((data ?? []) as Message[])
      setLoadingThread(false)
    }

    void loadThread()
  }, [selectedId])

  useEffect(() => {
    if (!threadRef.current) return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages.length, selectedId])

  const send = async () => {
    if (!userId || !selectedId || !body.trim() || sending) return
    setSending(true)
    setError(null)
    const { data, error: insErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedId,
        sender_id: userId,
        body: body.trim(),
      })
      .select('id,body,created_at,sender_id,conversation_id')
      .single()

    setSending(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    if (data) setMessages((m) => [...m, data as Message])
    setBody('')
  }

  const selected = conversations.find((c) => c.id === selectedId)
  const title = selected ? namesById[selected.patient_id] ?? 'Ukendt navn' : 'Vælg tråd'
  const selectedRole = selected ? roleByPatientId[selected.patient_id] : null
  const selectedRoleLabel = supportParticipantRoleLabelDa(selectedRole)

  return (
    <div className={styles.inboxShell}>
      <div className={styles.inboxList}>
        {loadingList ? (
          <div className={styles.empty} style={{ padding: 16 }}>
            Henter tråde…
          </div>
        ) : conversations.length === 0 ? (
          <div className={styles.empty} style={{ padding: 16 }}>
            Ingen support-tråde endnu.
          </div>
        ) : (
          conversations.map((c) => {
            const r = roleByPatientId[c.patient_id]
            const roleLabel = supportParticipantRoleLabelDa(r)
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.inboxRow} ${selectedId === c.id ? styles.inboxRowActive : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className={styles.inboxName}>{namesById[c.patient_id] ?? 'Ukendt'}</div>
                <div className={styles.inboxMeta}>
                  {roleLabel} · id {c.patient_id.slice(0, 8)}…
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className={styles.threadPanel}>
        <div className={styles.threadHead}>
          <span className={styles.threadHeadName}>{title}</span>
          {selected ? (
            <span
              className={`${styles.threadHeadRoleBadge} ${
                selectedRole === 'professional' ? styles.threadHeadRoleBadgeProfessional : ''
              }`}
            >
              {selectedRoleLabel}
            </span>
          ) : null}
        </div>
        {error ? <div className={styles.err}>{error}</div> : null}
        <div className={styles.thread} ref={threadRef} style={{ maxHeight: 360 }}>
          {loadingThread ? (
            <div className={styles.empty}>Loader…</div>
          ) : messages.length === 0 ? (
            <div className={styles.empty}>Ingen beskeder.</div>
          ) : (
            messages.map((m) => {
              const own = m.sender_id === userId
              return (
                <div key={m.id} className={`${styles.msgRow} ${own ? styles.msgRowOwn : ''}`}>
                  <div className={`${styles.bubble} ${own ? styles.bubbleOwn : styles.bubbleTheir}`}>{m.body}</div>
                  <div className={styles.time}>
                    {new Date(m.created_at).toLocaleString('da-DK', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className={styles.composer}>
          <textarea
            className={styles.input}
            rows={2}
            placeholder="Svar…"
            value={body}
            disabled={!selectedId}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <button type="button" className={styles.send} disabled={sending || !selectedId} onClick={() => void send()}>
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
