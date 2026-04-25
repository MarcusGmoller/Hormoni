'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Professional = {
  user_id: string
  title: string | null
  bio: string | null
  public_profile: boolean
  profiles: {
    full_name: string | null
  } | null
}

export default function ProfessionalsPage() {
  const [items, setItems] = useState<Professional[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from('professionals')
        .select('user_id,title,bio,public_profile,profiles(full_name)')
        .eq('public_profile', true)

      if (error) setError(error.message)
      else setItems((data as any) ?? [])
    }

    run()
  }, [])

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Gynækologer</h1>

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}

      <div className="space-y-3">
        {items.map((p) => (
          <div key={p.user_id} className="border rounded p-4 bg-white">
            <div className="font-semibold">
              {p.profiles?.full_name ?? 'Ukendt navn'}
            </div>
            {p.title && <div className="text-sm text-gray-600">{p.title}</div>}
            {p.bio && <div className="mt-2 text-sm">{p.bio}</div>}
            <button
                onClick={() => (location.href = `/book/${p.user_id}`)}
                className="mt-3 border rounded px-3 py-2">
                     Book tid
            </button>    
          </div>
        ))}
      </div>
    </main>
  )
}