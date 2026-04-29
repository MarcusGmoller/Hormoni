'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const SYMPTOMS = [
  { key: 'hedeture', label: 'Hedeture', emoji: '🔥' },
  { key: 'nattesved', label: 'Nattesved', emoji: '💦' },
  { key: 'soevnkvalitet', label: 'Søvnkvalitet', emoji: '😴' },
  { key: 'humoer', label: 'Humør', emoji: '😊' },
  { key: 'energiniveau', label: 'Energiniveau', emoji: '⚡' },
  { key: 'sexlyst', label: 'Sexlyst', emoji: '💕' },
] as const

/** 0–10 skala: lav → moderat → høj */
const scoreBandDa = (value: number) => {
  const v = Math.max(0, Math.min(10, Math.round(value)))
  if (v <= 3) return 'Lav'
  if (v <= 6) return 'Moderat'
  return 'Høj'
}

type HealthLog = {
  id: string
  symptom_scores: Record<string, number>
  notes: string | null
  created_at: string
}

export default function HealthLogPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<HealthLog[]>([])
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today')
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(SYMPTOMS.map((symptom) => [symptom.key, 5]))
  )
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editingScores, setEditingScores] = useState<Record<string, number>>({})
  const [editingNotes, setEditingNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  const averageScore = useMemo(() => {
    const values = Object.values(scores)
    if (values.length === 0) return 0
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
  }, [scores])

  const loadLogs = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data, error: loadError } = await supabase
      .from('user_health_condition_logs')
      .select('id,symptom_scores,notes,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (loadError) {
      setError(loadError.message)
      return
    }

    setLogs((data as HealthLog[]) ?? [])
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const publish = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: insertError } = await supabase.from('user_health_condition_logs').insert({
      user_id: user.id,
      health_conditions: [],
      symptom_scores: scores,
      notes: notes.trim() || null,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccessMessage('Symptomer er gemt.')
    setNotes('')
    await loadLogs()
    setActiveTab('history')
  }

  const startEdit = (log: HealthLog) => {
    setEditingLogId(log.id)
    setEditingScores(
      Object.fromEntries(
        SYMPTOMS.map((symptom) => [symptom.key, Number(log.symptom_scores?.[symptom.key] ?? 0)])
      )
    )
    setEditingNotes(log.notes ?? '')
    setError(null)
    setSuccessMessage(null)
  }

  const saveEdit = async () => {
    if (!editingLogId) return

    setUpdating(true)
    setError(null)
    setSuccessMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('user_health_condition_logs')
      .update({
        symptom_scores: editingScores,
        notes: editingNotes.trim() || null,
      })
      .eq('id', editingLogId)
      .eq('user_id', user.id)

    setUpdating(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccessMessage('Helbredslog er opdateret.')
    setEditingLogId(null)
    await loadLogs()
  }

  const todayTitle = `I dag · ${new Date().toLocaleDateString('da-DK')}`

  return (
    <div className="wrap">
      <div className="backRow">
        <button type="button" onClick={() => router.push('/dashboard')} className="backBtn">
          ← Tilbage til overblik
        </button>
      </div>

      {error && <div className="banner bannerError">Fejl: {error}</div>}
      {successMessage && <div className="banner bannerSuccess">{successMessage}</div>}

      <section className="shell">
        <header className="topbar">
          <div className="title">Symptomlog</div>
          <div className="subtitle">
            {activeTab === 'today' ? todayTitle : 'Tidligere indsendelser'}
          </div>
          <div className="tabRow">
            <button
              type="button"
              className={`tab ${activeTab === 'today' ? 'tabActive' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              Registrer i dag
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'history' ? 'tabActive' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Se historik
            </button>
          </div>
        </header>

        <div className="notice">
          <span className="noticeIcon" aria-hidden="true">
            📈
          </span>
          <span>Vurder hvert symptom på en skala fra 0–10. Du kan opdatere den seneste registrering under historik.</span>
        </div>

        {activeTab === 'today' && (
          <div className="body">
            <div className="symptomList">
              {SYMPTOMS.map((symptom) => (
                <div key={symptom.key} className="symptomCard">
                  <div className="symptomHead">
                    <div>
                      <div className="symptomLabel">
                        <span className="symptomEmoji" aria-hidden="true">
                          {symptom.emoji}
                        </span>
                        {symptom.label}
                      </div>
                      <div className="symptomMeta">{scoreBandDa(scores[symptom.key])}</div>
                    </div>
                    <div className="symptomScore">{scores[symptom.key]}</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={scores[symptom.key]}
                    onChange={(event) =>
                      setScores((current) => ({
                        ...current,
                        [symptom.key]: Number(event.target.value),
                      }))
                    }
                    className="range"
                  />
                </div>
              ))}
            </div>

            <div className="avgBox">
              Gennemsnit i dag: <strong>{averageScore}</strong>
            </div>

            <div>
              <label className="fieldLabel">Noter (valgfri)</label>
              <textarea
                className="textarea"
                placeholder="Tilføj evt. ekstra detaljer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button type="button" onClick={publish} disabled={saving} className="primaryBtn">
              {saving ? 'Gemmer...' : 'Gem oplysninger i din journal'}
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="body">
            {loading ? (
              <div className="muted">Loader...</div>
            ) : logs.length === 0 ? (
              <div className="emptyState">Ingen tidligere helbred logs endnu.</div>
            ) : (
              <div className="historyList">
                {logs.map((log, index) => (
                  <div key={log.id} className="historyCard">
                    <div className="historyDate">{new Date(log.created_at).toLocaleString('da-DK')}</div>
                    {editingLogId === log.id ? (
                      <div className="editBlock">
                        {SYMPTOMS.map((symptom) => (
                          <div key={symptom.key} className="editRow">
                            <div className="editRowHead">
                              <span>{symptom.label}</span>
                              <span>{editingScores[symptom.key] ?? 0}</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={10}
                              step={1}
                              value={editingScores[symptom.key] ?? 0}
                              onChange={(event) =>
                                setEditingScores((current) => ({
                                  ...current,
                                  [symptom.key]: Number(event.target.value),
                                }))
                              }
                              className="range"
                            />
                          </div>
                        ))}
                        <textarea
                          className="textarea"
                          value={editingNotes}
                          onChange={(event) => setEditingNotes(event.target.value)}
                          placeholder="Noter"
                        />
                        <div className="btnRow">
                          <button type="button" onClick={saveEdit} disabled={updating} className="primaryBtnInline">
                            {updating ? 'Gemmer...' : 'Gem ændringer'}
                          </button>
                          <button type="button" onClick={() => setEditingLogId(null)} className="secondaryBtn">
                            Annuller
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="scoreGrid">
                          {SYMPTOMS.map((symptom) => (
                            <div key={symptom.key} className="scoreChip">
                              <span className="scoreChipLabel">{symptom.label}:</span>{' '}
                              {log.symptom_scores?.[symptom.key] ?? 0}
                            </div>
                          ))}
                        </div>
                        {log.notes && <p className="notesText">{log.notes}</p>}
                        {index === 0 && (
                          <button type="button" onClick={() => startEdit(log)} className="secondaryBtn mt">
                            Rediger
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

        .banner {
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .bannerError {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
        }

        .bannerSuccess {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
        }

        .shell {
          min-height: 560px;
          background: #f7f5f2;
          border: 1px solid #ece7e1;
          border-radius: 18px;
          overflow: visible;
          display: flex;
          flex-direction: column;
        }

        .topbar {
          background: #ffffff;
          border-bottom: 1px solid #eee8e1;
          padding: 14px 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
        }

        .subtitle {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.35;
        }

        .tabRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }

        .tab {
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          background: #fff;
          cursor: pointer;
          color: #374151;
          transition:
            background 0.12s ease,
            border-color 0.12s ease;
        }

        .tab:hover {
          background: #f9fafb;
        }

        .tabActive {
          border-color: #84a795;
          background: #e8f0eb;
          color: #1f2937;
        }

        .notice {
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

        .body {
          padding: 16px 14px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .symptomList {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .symptomCard {
          background: #ffffff;
          border: 1px solid #eee8e1;
          border-radius: 14px;
          padding: 14px;
        }

        .symptomHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .symptomLabel {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
        }

        .symptomEmoji {
          margin-right: 6px;
        }

        .symptomMeta {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .symptomScore {
          font-size: 22px;
          font-weight: 700;
          color: #374151;
          flex-shrink: 0;
        }

        .range {
          width: 100%;
          margin-top: 10px;
          accent-color: #84a795;
        }

        .avgBox {
          background: #fffdfa;
          border: 1px solid #eee5dc;
          border-radius: 12px;
          padding: 12px;
          font-size: 13px;
          color: #374151;
        }

        .fieldLabel {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }

        .textarea {
          width: 100%;
          min-height: 96px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          resize: vertical;
          font-family: inherit;
        }

        .textarea:focus {
          border-color: #84a795;
        }

        .primaryBtn {
          width: 100%;
          margin-top: 4px;
          padding: 12px 16px;
          border-radius: 999px;
          border: 0;
          background: #84a795;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .primaryBtn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .primaryBtnInline {
          padding: 10px 16px;
          border-radius: 999px;
          border: 0;
          background: #84a795;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .primaryBtnInline:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .secondaryBtn {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 10px 14px;
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
        }

        .secondaryBtn:hover {
          background: #f9fafb;
        }

        .muted {
          font-size: 14px;
          color: #6b7280;
        }

        .emptyState {
          background: #ffffff;
          border: 1px solid #eee8e1;
          border-radius: 14px;
          padding: 14px;
          color: #6b7280;
          font-size: 14px;
        }

        .historyList {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .historyCard {
          background: #ffffff;
          border: 1px solid #eee8e1;
          border-radius: 14px;
          padding: 14px;
        }

        .historyDate {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9ca3af;
        }

        .scoreGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .scoreChip {
          background: #f7f5f2;
          border: 1px solid #ece7e1;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 13px;
          color: #374151;
        }

        .scoreChipLabel {
          font-weight: 600;
        }

        .notesText {
          margin: 10px 0 0;
          font-size: 13px;
          color: #374151;
          line-height: 1.45;
        }

        .mt {
          margin-top: 10px;
        }

        .editBlock {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .editRow {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .editRowHead {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .btnRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
      `}</style>
    </div>
  )
}
