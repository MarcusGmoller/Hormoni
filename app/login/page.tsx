'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { syncProfileAfterAuthAndResolvePath } from '@/lib/authPostLogin'
import { ensureProfileSyncedWithAuth } from '@/lib/ensureProfileSyncedWithAuth'

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
    queueMicrotask(() => {
      const err = searchParams.get('error')
      if (err && err !== 'confirm') {
        setError(decodeURIComponent(err))
        return
      }
      if (err === 'confirm') {
        setError('Ugyldig eller udløbet bekræftelseslink. Prøv at oprette konto igen eller log ind.')
        return
      }
      if (searchParams.get('signedOut') === '1') {
        setError(null)
        setMessage(
          'Du er logget ud. Du kan logge ind igen når som helst og fortsætte oprettelsen, hvis den ikke er færdig.'
        )
      }
    })
  }, [searchParams])

  const signInWithOAuthProvider = async (
    provider: 'google' | 'facebook',
    selectedRole: 'user' | 'professional'
  ) => {
    setError(null)
    setMessage(null)
    const callbackPath =
      selectedRole === 'professional'
        ? '/auth/callback/professional'
        : authMode === 'signup'
          ? '/auth/callback/user-signup'
          : '/auth/callback/user-signin'
    const callbackUrl = new URL(callbackPath, location.origin)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })
    if (oauthError) setError(oauthError.message)
  }

  const ensureProfessionalProfileAndRedirect = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Kunne ikke hente gynækolog-bruger efter login.')
      return
    }

    const ensured = await ensureProfileSyncedWithAuth(supabase, user, {
      intendedRole: 'professional',
    })
    if (!ensured.ok) {
      setError(`Profil kunne ikke synkroniseres: ${ensured.message}`)
      return
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('approval_status,bio,professional_name,payment_information,professional_email,professional_phone')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) {
      router.push('/gynaekolog-onboarding')
      router.refresh()
      return
    }

    if (professional.approval_status === 'approved') {
      router.push('/gynaekolog-dashboard')
    } else if (
      !professional.bio?.trim() ||
      !professional.professional_name?.trim() ||
      !professional.payment_information?.trim() ||
      !professional.professional_email?.trim() ||
      !professional.professional_phone?.trim()
    ) {
      router.push('/gynaekolog-onboarding')
    } else {
      router.push('/gynaekolog-pending')
    }
    router.refresh()
  }

  const ensureUserProfileAndRedirect = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Kunne ikke hente bruger efter login.')
      return
    }

    const destination = await syncProfileAfterAuthAndResolvePath(supabase, user)
    router.push(destination)
    router.refresh()
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

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
            ...(role === 'professional'
              ? { data: { registration_channel: 'professional' } }
              : {}),
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        if (data.session) {
          if (role === 'professional') await ensureProfessionalProfileAndRedirect()
          else await ensureUserProfileAndRedirect()
        } else if (data.user) {
          // Midlertidigt flow: forsøg at logge ind direkte efter signup,
          // så brugeren kan fortsætte uden at vente på mailbekræftelse.
          const { error: immediateSignInError } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          })

          if (!immediateSignInError) {
            if (role === 'professional') await ensureProfessionalProfileAndRedirect()
            else await ensureUserProfileAndRedirect()
            return
          }

          setMessage(
            `Konto oprettet. Automatisk login lykkedes ikke endnu (${immediateSignInError.message}). ` +
              'Prøv at logge ind med e-mail og adgangskode med det samme.'
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

        if (role === 'professional') {
          await ensureProfessionalProfileAndRedirect()
        } else {
          await ensureUserProfileAndRedirect()
        }
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

        {role === 'user' && (
          <>
            <p className="mb-2 text-xs text-gray-500">
              Som bruger kan du logge ind med e-mail/adgangskode, Google eller Facebook.
            </p>
          </>
        )}

        {role === 'professional' && (
          <p className="mb-4 text-sm text-gray-600">
            Som gynækolog kan du oprette dig med e-mail, Google eller Facebook. Nye profiler markeres som
            pending og skal godkendes af admin.
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => signInWithOAuthProvider('google', role)}
            className="w-full rounded bg-black px-4 py-3 text-white"
          >
            {role === 'user' ? 'Fortsæt med Google' : 'Log ind med Google som gynækolog'}
          </button>
          <button
            type="button"
            onClick={() => signInWithOAuthProvider('facebook', role)}
            className="w-full rounded bg-[#1877F2] px-4 py-3 font-medium text-white hover:bg-[#166FE5]"
          >
            {role === 'user' ? 'Fortsæt med Facebook' : 'Log ind med Facebook som gynækolog'}
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
