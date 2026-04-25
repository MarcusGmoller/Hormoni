'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

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
    </main>
  )
}