import { NextRequest, NextResponse } from 'next/server'
import {
  createSupabaseRouteHandlerClient,
  exchangeOAuthCodeForUser,
  loginErrorRedirect,
  readOAuthProviderError,
} from '@/lib/authCallbackServer'
import { syncProfileAfterAuthAndResolvePath } from '@/lib/authPostLogin'
import { ensureProfileSyncedWithAuth } from '@/lib/ensureProfileSyncedWithAuth'
import { roleFromCallbackSearchParams, routeByProfessionalState, type ProfessionalForRouting } from '@/lib/authRouting'

/**
 * Bagudkompatibel OAuth-return (fx hvis Supabase stadig peger på /auth/callback).
 * Foretræk eksplicitte paths: /auth/callback/professional, /auth/callback/user-signin|user-signup.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const providerErr = readOAuthProviderError(url)
  if (providerErr) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(providerErr)}`, url.origin)
    )
  }

  const code = url.searchParams.get('code')
  const role = roleFromCallbackSearchParams(url.searchParams)

  const fallbackPath = role === 'professional' ? '/gynaekolog-onboarding' : '/dashboard'
  if (!code) {
    return loginErrorRedirect(url.origin, 'Mangler OAuth-kode. Prøv igen.')
  }

  const response = NextResponse.redirect(new URL(fallbackPath, url.origin))
  const supabase = createSupabaseRouteHandlerClient(request, response)

  const exchanged = await exchangeOAuthCodeForUser(supabase, code, url.origin)
  if (!exchanged.ok) {
    return exchanged.response
  }

  if (role === 'professional') {
    const ensured = await ensureProfileSyncedWithAuth(supabase, exchanged.user, {
      intendedRole: 'professional',
    })
    if (!ensured.ok) {
      return loginErrorRedirect(url.origin, ensured.message)
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select(
        'approval_status,bio,professional_name,payment_information,professional_email,professional_phone'
      )
      .eq('user_id', exchanged.user.id)
      .maybeSingle()

    const destination = routeByProfessionalState(professional as ProfessionalForRouting)
    response.headers.set('Location', new URL(destination, url.origin).toString())
  } else {
    const destination = await syncProfileAfterAuthAndResolvePath(supabase, exchanged.user)
    response.headers.set('Location', new URL(destination, url.origin).toString())
  }

  return response
}
