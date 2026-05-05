import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureProfileSyncedWithAuth } from '@/lib/ensureProfileSyncedWithAuth'
import { routeByProfessionalState, type ProfessionalForRouting } from '@/lib/authRouting'

/** Minimalt bruger-objekt efter login (browser eller server). */
export type AuthUserLike = { id: string; email?: string | null }

/** Google fra /login: "Log ind" vs "Opret konto" (kun relevant for patient-flow). */
export type OAuthUserIntent = 'signin' | 'signup'

export type SyncProfileOptions = {
  oauthUserIntent?: OAuthUserIntent
}

export type PostLoginDestination =
  | '/onboarding'
  | '/dashboard'
  | '/gynaekolog-dashboard'
  | '/gynaekolog-onboarding'
  | '/gynaekolog-pending'
  | '/dashboard?oauth_signin=1'
  | '/admin'

function applyOAuthSigninPatientPreference(
  path: PostLoginDestination,
  oauthUserIntent?: OAuthUserIntent
): PostLoginDestination {
  if (path === '/admin') return '/admin'
  if (oauthUserIntent !== 'signin') return path
  if (
    path === '/gynaekolog-dashboard' ||
    path === '/gynaekolog-onboarding' ||
    path === '/gynaekolog-pending'
  ) {
    return path
  }
  if (path === '/onboarding') return '/dashboard?oauth_signin=1'
  return '/dashboard'
}

/**
 * Efter vellykket login som **patient/bruger** (e-mail, OAuth patient-callback m.m.):
 * - `profiles.role === 'professional'` → altid gynækolog-flow (`routeByProfessionalState`), også hvis login-formularen stod på "Bruger".
 * - Ellers: godkendt gynækolog → dashboard; afsluttet patientprofil → bruger-dashboard; ellers patient-onboarding.
 */
export async function syncProfileAfterAuthAndResolvePath(
  supabase: SupabaseClient,
  user: AuthUserLike,
  options?: SyncProfileOptions
): Promise<PostLoginDestination> {
  const intent = options?.oauthUserIntent

  await ensureProfileSyncedWithAuth(supabase, user, { intendedRole: 'user' })

  const { data: professional } = await supabase
    .from('professionals')
    .select(
      'approval_status,bio,professional_name,payment_information,professional_email,professional_phone'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: existing } = await supabase
    .from('profiles')
    .select('profile_completed, role')
    .eq('id', user.id)
    .maybeSingle()

  if (existing?.role === 'admin') {
    return '/admin'
  }

  if (existing?.role === 'professional') {
    const dest = routeByProfessionalState(professional as ProfessionalForRouting) as PostLoginDestination
    return applyOAuthSigninPatientPreference(dest, intent)
  }

  if (professional?.approval_status === 'approved') {
    return applyOAuthSigninPatientPreference('/gynaekolog-dashboard', intent)
  }

  if (professional) {
    const dest = routeByProfessionalState(professional as ProfessionalForRouting) as PostLoginDestination
    return applyOAuthSigninPatientPreference(dest, intent)
  }

  if (!existing) {
    return applyOAuthSigninPatientPreference('/onboarding', intent)
  }

  if (existing.profile_completed) {
    return applyOAuthSigninPatientPreference('/dashboard', intent)
  }
  return applyOAuthSigninPatientPreference('/onboarding', intent)
}
