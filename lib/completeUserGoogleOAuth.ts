import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { syncProfileAfterAuthAndResolvePath, type OAuthUserIntent } from '@/lib/authPostLogin'

/**
 * PKCE callback for Google som **patient**: bytter code til session og dirigerer videre.
 * Brug separate path'er (user-signin / user-signup) — Supabase bevarer dem i redirect URL,
 * i modsætning til ekstra query-params der ofte stripper.
 */
export async function completeUserGoogleOAuth(
  request: NextRequest,
  oauthUserIntent: OAuthUserIntent
) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  const response = NextResponse.redirect(new URL('/dashboard', url.origin))

  if (!code) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.exchangeCodeForSession(code)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const destination = await syncProfileAfterAuthAndResolvePath(supabase, user, {
      oauthUserIntent,
    })
    response.headers.set('location', new URL(destination, url.origin).toString())
  }

  return response
}
