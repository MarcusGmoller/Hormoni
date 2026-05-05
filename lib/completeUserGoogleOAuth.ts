import { NextRequest, NextResponse } from 'next/server'
import {
  createSupabaseRouteHandlerClient,
  exchangeOAuthCodeForUser,
  loginErrorRedirect,
  readOAuthProviderError,
} from '@/lib/authCallbackServer'
import { syncProfileAfterAuthAndResolvePath, type OAuthUserIntent } from '@/lib/authPostLogin'

/**
 * PKCE callback for OAuth (fx Google, Facebook) som **patient**: bytter code til session og dirigerer videre.
 * Brug `/auth/callback/user-signin` eller `user-signup` i redirectTo (intent i path, ikke query).
 */
export async function completeUserGoogleOAuth(
  request: NextRequest,
  oauthUserIntent: OAuthUserIntent
) {
  const url = new URL(request.url)
  const providerErr = readOAuthProviderError(url)
  if (providerErr) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(providerErr)}`, url.origin)
    )
  }

  const code = url.searchParams.get('code')
  if (!code) {
    return loginErrorRedirect(url.origin, 'Mangler OAuth-kode. Prøv igen.')
  }

  const response = NextResponse.redirect(new URL('/dashboard', url.origin))
  const supabase = createSupabaseRouteHandlerClient(request, response)

  const exchanged = await exchangeOAuthCodeForUser(supabase, code, url.origin)
  if (!exchanged.ok) {
    return exchanged.response
  }

  const destination = await syncProfileAfterAuthAndResolvePath(supabase, exchanged.user, {
    oauthUserIntent,
  })
  response.headers.set('Location', new URL(destination, url.origin).toString())
  return response
}
