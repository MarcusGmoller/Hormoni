import { NextRequest } from 'next/server'
import { completeUserGoogleOAuth } from '@/lib/completeUserGoogleOAuth'
import type { OAuthUserIntent } from '@/lib/authPostLogin'

/**
 * Bagudkompatibel patient-Google callback med ?intent=signin|signup.
 * Nye flows: `/auth/callback/user-signin` og `/auth/callback/user-signup` (intent i path).
 */
export async function GET(request: NextRequest) {
  const intentParam = new URL(request.url).searchParams.get('intent')
  const oauthUserIntent: OAuthUserIntent = intentParam === 'signup' ? 'signup' : 'signin'
  return completeUserGoogleOAuth(request, oauthUserIntent)
}
