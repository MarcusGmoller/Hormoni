'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  email: string | null
  role: string
  profile_completed: boolean
}

export default function DebugDbPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,role,profile_completed,full_name,address,contact_email,phone')
        .limit(5)

      if (error) setError(error.message)
      else setProfiles(data ?? [])
    }

    run()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Debug DB</h1>

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      <pre className="bg-gray-100 p-4 rounded text-sm">
        {JSON.stringify(profiles, null, 2)}
      </pre>
    </main>
  )
}
