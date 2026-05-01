import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { syncProfileAfterAuthAndResolvePath, type OAuthUserIntent } from '@/lib/authPostLogin'

/**
 * Google OAuth return (patient): PKCE code byttes på serveren med cookies fra requesten.
 * Det matcher createBrowserClient på /login — verifier ligger i cookies, ikke kun i JS-storage.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const intentParam = requestUrl.searchParams.get('intent')
  const oauthUserIntent: OAuthUserIntent = intentParam === 'signup' ? 'signup' : 'signin'

  const oauthError = requestUrl.searchParams.get('error')
  const oauthDesc = requestUrl.searchParams.get('error_description')
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(oauthDesc ?? oauthError)}`, requestUrl.origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('Mangler OAuth-kode. Prøv igen.')}`,
        requestUrl.origin
      )
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  let response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin))

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
  })

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('Kunne ikke hente bruger efter login.')}`,
        requestUrl.origin
      )
    )
  }

  const destination = await syncProfileAfterAuthAndResolvePath(supabase, user, {
    oauthUserIntent,
  })

  response.headers.set('Location', new URL(destination, requestUrl.origin).toString())
  return response
}
