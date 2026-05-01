'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { EmailOtpType } from '@supabase/supabase-js'
import { syncProfileAfterAuthAndResolvePath } from '@/lib/authPostLogin'

/**
 * E-mailbekræftelse: Opretter en NY Supabase-klient her, så detectSessionInUrl læser den aktuelle URL.
 * Den globale klient er ofte allerede initialiseret på /login, så den ser aldrig ?code= eller #access_token=.
 */
function ConfirmContent() {
  const router = useRouter()
  const [message, setMessage] = useState('Bekræfter din konto…')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    if (!url || !key) {
      router.replace('/login?error=' + encodeURIComponent('Mangler Supabase-konfiguration.'))
      return
    }

    const client = createClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })

    const redirectLogin = (errorKey: string, detail?: string) => {
      const q =
        errorKey === 'confirm'
          ? 'confirm'
          : encodeURIComponent(detail ?? errorKey)
      router.replace(`/login?error=${q}`)
    }

    const finishProfileAndGo = async (userId: string, userEmail: string | null | undefined) => {
      const dest = await syncProfileAfterAuthAndResolvePath(client, {
        id: userId,
        email: userEmail ?? null,
      })
      window.history.replaceState(null, '', `${window.location.pathname}`)
      router.replace(dest)
      router.refresh()
    }

    const run = async () => {
      const loc = new URL(window.location.href)

      const oauthError = loc.searchParams.get('error')
      const oauthDesc = loc.searchParams.get('error_description')
      if (oauthError) {
        redirectLogin('msg', oauthDesc ?? oauthError)
        return
      }

      const { data: initialSession } = await client.auth.getSession()
      if (initialSession.session?.user) {
        await finishProfileAndGo(
          initialSession.session.user.id,
          initialSession.session.user.email
        )
        return
      }

      const code = loc.searchParams.get('code')
      if (code) {
        const { data, error } = await client.auth.exchangeCodeForSession(code)
        if (error) {
          redirectLogin(
            'msg',
            `${error.message} — Tip: Åbn bekræftelseslinket i samme browser (og samme host, fx kun localhost eller kun 127.0.0.1) som du brugte ved "Opret konto".`
          )
          return
        }
        const user = data.session?.user ?? data.user
        if (user) {
          await finishProfileAndGo(user.id, user.email)
          return
        }
        redirectLogin('confirm')
        return
      }

      const token_hash = loc.searchParams.get('token_hash')
      const typeParam = loc.searchParams.get('type')
      if (token_hash && typeParam) {
        const { data, error } = await client.auth.verifyOtp({
          token_hash,
          type: typeParam as EmailOtpType,
        })
        if (error) {
          redirectLogin('msg', error.message)
          return
        }
        const user = data.session?.user ?? data.user
        if (user) {
          await finishProfileAndGo(user.id, user.email)
          return
        }
        redirectLogin('confirm')
        return
      }

      const hashRaw = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash
      if (hashRaw) {
        const params = new URLSearchParams(hashRaw)
        const hashErr = params.get('error')
        const hashErrDesc = params.get('error_description')
        if (hashErr) {
          redirectLogin('msg', hashErrDesc ?? hashErr)
          return
        }
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { data, error } = await client.auth.setSession({ access_token, refresh_token })
          if (error) {
            redirectLogin('msg', error.message)
            return
          }
          const user = data.session?.user
          if (user) {
            window.history.replaceState(null, '', `${loc.pathname}${loc.search}`)
            await finishProfileAndGo(user.id, user.email)
            return
          }
        }
      }

      redirectLogin('confirm')
    }

    void run().catch(() => redirectLogin('confirm'))
  }, [router])

  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6 text-center text-sm text-gray-600">Indlæser…</main>
      }
    >
      <ConfirmContent />
    </Suspense>
  )
}
