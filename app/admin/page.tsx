'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type PendingProfessional = {
  user_id: string
  professional_name: string | null
  professional_email: string | null
  professional_phone: string | null
  title: string | null
  bio: string | null
  created_at: string
  approval_status: 'pending' | 'approved' | 'rejected'
}

export default function AdminPage() {
  const [pending, setPending] = useState<PendingProfessional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadPending = async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('professionals')
      .select('user_id,professional_name,professional_email,professional_phone,title,bio,created_at,approval_status')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setPending([])
    } else {
      setPending((data ?? []) as PendingProfessional[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPending()
  }, [])

  const approve = async (professionalId: string) => {
    setBusyId(professionalId)
    setError(null)
    const { error: approveError } = await supabase
      .from('professionals')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        public_profile: true,
      })
      .eq('user_id', professionalId)
      .eq('approval_status', 'pending')

    setBusyId(null)
    if (approveError) {
      setError(approveError.message)
      return
    }

    await loadPending()
  }

  const reject = async (professionalId: string) => {
    setBusyId(professionalId)
    setError(null)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      setBusyId(null)
      setError('Session udløbet. Log ind igen.')
      return
    }

    const response = await fetch('/api/admin/reject-professional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ professionalUserId: professionalId }),
    })

    const json = (await response.json().catch(() => ({}))) as { error?: string }
    setBusyId(null)
    if (!response.ok) {
      setError(json.error ?? 'Afvisning mislykkedes.')
      return
    }

    await loadPending()
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Admin</h1>
      <p className="mb-6 text-sm text-slate-600">
        Midlertidigt åben side. Her kan du godkende oprettelse af gynækolog-profiler.
      </p>

      {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Fejl: {error}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-600">Henter pending profiler...</div>
      ) : pending.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Ingen pending gynækolog-profiler lige nu.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((row) => {
            return (
              <article key={row.user_id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-base font-semibold text-slate-900">
                  {row.professional_name?.trim() || 'Ukendt navn'}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {row.professional_email?.trim() || 'Ingen e-mail'}
                  {row.professional_phone?.trim() ? ` · ${row.professional_phone.trim()}` : ''}
                  {row.title ? ` · ${row.title}` : ''}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Oprettet: {new Date(row.created_at).toLocaleString('da-DK')}
                </div>
                {row.bio?.trim() ? <p className="mt-3 text-sm text-slate-700">{row.bio}</p> : null}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.user_id}
                    onClick={() => approve(row.user_id)}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busyId === row.user_id ? 'Gemmer...' : 'Godkend'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.user_id}
                    onClick={() => reject(row.user_id)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    Afvis
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
