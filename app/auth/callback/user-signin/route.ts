import { NextRequest } from 'next/server'
import { completeUserGoogleOAuth } from '@/lib/completeUserGoogleOAuth'

/** Google + fanen "Log ind" → dashboard først (ufuldstændig profil: ?oauth_signin=1). */
export async function GET(request: NextRequest) {
  return completeUserGoogleOAuth(request, 'signin')
}
