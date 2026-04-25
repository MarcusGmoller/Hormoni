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

export default function DoctorPage() {
  const router = useRouter()

  const [items, setItems] = useState<Appointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [doctorEmail, setDoctorEmail] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
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

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setItems((data ?? []) as any)
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

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Gynækolog: Booking-forespørgsler</h1>

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

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="border rounded p-4 bg-white flex items-center justify-between">
            <div>
              <div className="font-semibold">
                {new Date(a.start_time).toLocaleString('da-DK')}
                {' '}–{' '}
                {new Date(a.end_time).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm text-gray-600">Status: {a.status}</div>
            </div>

            <button onClick={() => accept(a.id)} className="bg-black text-white rounded px-3 py-2">
              Acceptér
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}