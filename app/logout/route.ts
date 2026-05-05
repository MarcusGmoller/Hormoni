import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/authCallbackServer'

/**
 * Hard logout: rydder Supabase Auth-cookies server-side og sender til login.
 * Brug ved redirect-deadlock: gå til /logout i adresselinjen.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const login = new URL('/login', origin)
  login.searchParams.set('signedOut', '1')
  const response = NextResponse.redirect(login)
  const supabase = createSupabaseRouteHandlerClient(request, response)
  await supabase.auth.signOut()
  return response
}
