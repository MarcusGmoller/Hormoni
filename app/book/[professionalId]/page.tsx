'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function BookPage() {
  const router = useRouter()
  const params = useParams<{ professionalId: string }>()
  const professionalId = params.professionalId

  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!date || !start) {
      setError('Vælg dato og starttid.')
      setSaving(false)
      return
    }

    const duration = parseInt(minutes, 10)
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Ugyldig varighed.')
      setSaving(false)
      return
    }

    // Byg tider (ISO) fra input
    const startTime = new Date(`${date}T${start}:00`)
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

    const { error: insertError } = await supabase
      .from('appointments')
      .insert({
        user_id: user.id,
        professional_id: professionalId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'requested',
      })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Book tid</h1>

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      <div className="space-y-3">
        <input className="border p-2 w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="border p-2 w-full" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input className="border p-2 w-full" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />

        <button onClick={save} disabled={saving} className="bg-black text-white rounded px-4 py-3">
          {saving ? 'Opretter...' : 'Send booking'}
        </button>
      </div>
    </main>
  )
}