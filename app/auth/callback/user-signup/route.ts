import { NextRequest } from 'next/server'
import { completeUserGoogleOAuth } from '@/lib/completeUserGoogleOAuth'

/** Google + fanen "Opret konto" → onboarding hvis profil ikke er færdig. */
export async function GET(request: NextRequest) {
  return completeUserGoogleOAuth(request, 'signup')
}
