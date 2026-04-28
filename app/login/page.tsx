'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [role, setRole] = useState<'user' | 'professional'>('user')

  const signInWithGoogle = async (role: 'user' | 'professional') => {
    const callbackPath =
      role === 'professional'
        ? '/auth/callback/professional'
        : '/auth/callback/user'

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}${callbackPath}`,
      },
    })
    if (error) alert(error.message)
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Log ind</h1>
        <p className="mb-6 text-sm text-gray-600">
          Vaelg om du logger ind som bruger eller som gynaekolog.
        </p>

        <div className="mb-4 rounded-full bg-gray-100 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                role === 'user' ? 'bg-white text-black shadow-sm' : 'text-gray-600',
              ].join(' ')}
            >
              Bruger
            </button>

            <button
              type="button"
              onClick={() => setRole('professional')}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                role === 'professional' ? 'bg-white text-black shadow-sm' : 'text-gray-600',
              ].join(' ')}
            >
              Gynaekolog
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signInWithGoogle(role)}
            className="w-full rounded bg-black px-4 py-3 text-white"
          >
            {role === 'user'
              ? 'Log ind med Google som bruger'
              : 'Log ind med Google som gynaekolog'}
          </button>
        </div>
      </div>
    </main>
  )
}
