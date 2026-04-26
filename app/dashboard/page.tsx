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

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionalNamesById, setProfessionalNamesById] = useState<Record<string, string>>({})
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('profile_completed')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error(error)
        router.push('/login')
        return
      }

      if (!profile?.profile_completed) {
        router.push('/onboarding')
        return
      }

      setLoading(false)

      setAppointmentsLoading(true)
      setAppointmentsError(null)

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

      const professionalIds = Array.from(
        new Set(nextAppointments.map((appointment) => appointment.professional_id))
      )

      if (professionalIds.length === 0) {
        setProfessionalNamesById({})
        return
      }

      const { data: professionals } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', professionalIds)

      const namesById = (professionals ?? []).reduce<Record<string, string>>((acc, professional: any) => {
        if (professional?.id && professional?.full_name) {
          acc[professional.id] = professional.full_name
        }

        return acc
      }, {})

      setProfessionalNamesById(namesById)
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

  if (loading) return <main className="p-6">Loader...</main>

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p>Du er logget ind, og profilen er udfyldt</p>
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="border rounded px-4 py-2"
        >
          {loggingOut ? 'Logger ud...' : 'Log ud'}
        </button>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Mine bookinger</h2>

        {appointmentsLoading && <div>Loader bookinger...</div>}

        {appointmentsError && (
          <div className="text-red-600 mb-4">Fejl: {appointmentsError}</div>
        )}

        {!appointmentsLoading && !appointmentsError && appointments.length === 0 && (
          <div className="text-gray-600">Du har ingen bookinger endnu.</div>
        )}

        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="border rounded p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {new Date(a.start_time).toLocaleString('da-DK')}
                  {' '}–{' '}
                  {new Date(a.end_time).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                </div>

                <span className="text-sm px-2 py-1 rounded border">
                  {a.status}
                </span>
              </div>

              <div className="text-sm text-gray-600 mt-2">
                Gynækolog: {professionalNamesById[a.professional_id] ?? a.professional_id}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}