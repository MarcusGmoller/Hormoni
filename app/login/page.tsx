'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [role, setRole] = useState<'user' | 'professional'>('user')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err && err !== 'confirm') {
      setError(decodeURIComponent(err))
    } else if (err === 'confirm') {
      setError('Ugyldig eller udløbet bekræftelseslink. Prøv at oprette konto igen eller log ind.')
    }
  }, [searchParams])

  const signInWithGoogle = async (selectedRole: 'user' | 'professional') => {
    setError(null)
    setMessage(null)
    const callbackPath =
      selectedRole === 'professional' ? '/auth/callback/professional' : '/auth/callback/user'
    const callbackUrl = new URL(callbackPath, location.origin)
    callbackUrl.searchParams.set('selected_role', selectedRole)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })
    if (oauthError) setError(oauthError.message)
  }

  const ensureUserProfileAndRedirect = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Kunne ikke hente bruger efter login.')
      return
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? null,
        role: 'user',
      },
      { onConflict: 'id' }
    )

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', user.id)
      .single()

    router.push(profile?.profile_completed ? '/userdashboard' : '/onboarding')
    router.refresh()
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (role !== 'user') return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Udfyld e-mail og adgangskode.')
      return
    }

    if (authMode === 'signup') {
      if (password.length < 6) {
        setError('Adgangskoden skal være mindst 6 tegn.')
        return
      }
      if (password !== confirmPassword) {
        setError('Adgangskoderne matcher ikke.')
        return
      }
    }

    setLoading(true)

    try {
      if (authMode === 'signup') {
        const confirmUrl = new URL('/auth/confirm', window.location.origin).toString()
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: confirmUrl,
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        if (data.session) {
          await ensureUserProfileAndRedirect()
        } else if (data.user) {
          const isLocalHost =
            typeof window !== 'undefined' &&
            /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
          setMessage(
            [
              'Din konto afventer e-mailbekræftelse. Supabase har forsøgt at sende et link til din indbakke.',
              isLocalHost
                ? 'Bruger du `supabase start` lokalt, lander mail ikke i Gmail — åbn Inbucket på http://localhost:54324 og find mailen der.'
                : null,
              'På hosted Supabase: Authentication → Logs (Auth) viser om afsendelse fejler. Tjek spam. Under Authentication → Providers → Email skal e-mail være aktiveret.',
              'Bemærk: Hvis "Confirm email" er slået fra i Dashboard, oprettes du uden mail og uden dette trin — så skal du i stedet kunne logge ind med det samme (prøv fanen "Log ind").',
            ]
              .filter(Boolean)
              .join(' ')
          )
          setPassword('')
          setConfirmPassword('')
        } else {
          setError(
            'Oprettelsen gav ingen aktiv bruger. Måske er e-mailen allerede i brug — prøv "Log ind" eller en anden adresse.'
          )
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          return
        }

        await ensureUserProfileAndRedirect()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Log ind</h1>
        <p className="mb-6 text-sm text-gray-600">
          Vælg om du logger ind som bruger eller som gynækolog. Som bruger kan du også oprette konto med e-mail.
        </p>

        <div className="mb-4 rounded-full bg-gray-100 p-1">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setRole('user')
                setError(null)
                setMessage(null)
              }}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                role === 'user' ? 'bg-white text-black shadow-sm' : 'text-gray-600',
              ].join(' ')}
            >
              Bruger
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('professional')
                setError(null)
                setMessage(null)
              }}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                role === 'professional' ? 'bg-white text-black shadow-sm' : 'text-gray-600',
              ].join(' ')}
            >
              Gynækolog
            </button>
          </div>
        </div>

        {role === 'user' && (
          <>
            <div className="mb-4 flex rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin')
                  setError(null)
                  setMessage(null)
                }}
                className={[
                  'flex-1 rounded-md py-2 text-sm font-medium',
                  authMode === 'signin' ? 'bg-gray-900 text-white' : 'text-gray-600',
                ].join(' ')}
              >
                Log ind
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup')
                  setError(null)
                  setMessage(null)
                }}
                className={[
                  'flex-1 rounded-md py-2 text-sm font-medium',
                  authMode === 'signup' ? 'bg-gray-900 text-white' : 'text-gray-600',
                ].join(' ')}
              >
                Opret konto
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-700">
                  Adgangskode
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                  minLength={6}
                />
              </div>
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-gray-700">
                    Gentag adgangskode
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(ev) => setConfirmPassword(ev.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                    minLength={6}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {loading ? 'Vent…' : authMode === 'signup' ? 'Opret konto' : 'Log ind med e-mail'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase text-gray-500">
                <span className="bg-white px-2">eller</span>
              </div>
            </div>
          </>
        )}

        {role === 'professional' && (
          <p className="mb-4 text-sm text-gray-600">Som gynækolog logger du ind med Google.</p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => signInWithGoogle(role)}
            className="w-full rounded bg-black px-4 py-3 text-white"
          >
            {role === 'user' ? 'Fortsæt med Google' : 'Log ind med Google som gynækolog'}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Indlæser…</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
