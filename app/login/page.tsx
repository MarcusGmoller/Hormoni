'use client'

import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
    if (error) alert(error.message)
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <button
        onClick={signInWithGoogle}
        className="w-full bg-black text-white rounded px-4 py-3"
      >
        Log ind med Google
      </button>
    </main>
  )
}
