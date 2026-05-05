'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function GynekologPendingPage() {
  const router = useRouter()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Profil afventer godkendelse</h1>
        <p className="mb-4 text-sm text-gray-700">
          Din professionelle profil er oprettet som <strong>pending</strong>. En admin skal godkende den,
          før du kan bruge gynækolog-dashboardet.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Log ud
        </button>
      </div>
    </main>
  )
}
