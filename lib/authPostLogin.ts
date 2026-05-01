import type { SupabaseClient } from '@supabase/supabase-js'

/** Minimalt bruger-objekt efter login (browser eller server). */
export type AuthUserLike = { id: string; email?: string | null }

/** Google fra /login: "Log ind" vs "Opret konto" (kun relevant for patient-flow). */
export type OAuthUserIntent = 'signin' | 'signup'

export type SyncProfileOptions = {
  oauthUserIntent?: OAuthUserIntent
}

/**
 * Efter vellykket login som **patient/bruger**:
 * - Opretter profil-række kun hvis den mangler (undgår upsert der kan overskrive rolle/data).
 * - Professionelle (`role === 'professional'`) sendes altid til læge-dashboard uden at nedgradere til `user`.
 * - Afsluttet profil (`profile_completed`) → bruger-dashboard; ellers onboarding.
 * - `oauthUserIntent: 'signin'`: som ved "Log ind" + Google — dashboard først (`?oauth_signin=1` hvis profil ikke er færdig), ikke onboarding.
 */
export async function syncProfileAfterAuthAndResolvePath(
  supabase: SupabaseClient,
  user: AuthUserLike,
  options?: SyncProfileOptions
): Promise<'/onboarding' | '/dashboard' | '/gynaekolog-dashboard' | '/dashboard?oauth_signin=1'> {
  const intent = options?.oauthUserIntent
  const finish = (p: '/onboarding' | '/dashboard' | '/gynaekolog-dashboard') =>
    applyGoogleSigninDashboardFirst(p, intent)

  const { data: existing } = await supabase
    .from('profiles')
    .select('profile_completed, role')
    .eq('id', user.id)
    .maybeSingle()

  if (existing?.role === 'professional') {
    await supabase.from('profiles').update({ email: user.email ?? null }).eq('id', user.id)
    return finish('/gynaekolog-dashboard')
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email ?? null,
      role: 'user',
    })

    if (!insertError) {
      return finish('/onboarding')
    }

    const { data: again } = await supabase
      .from('profiles')
      .select('profile_completed, role')
      .eq('id', user.id)
      .maybeSingle()

    if (again?.role === 'professional') {
      return finish('/gynaekolog-dashboard')
    }
    if (again?.profile_completed) {
      return finish('/dashboard')
    }
    return finish('/onboarding')
  }

  await supabase.from('profiles').update({ email: user.email ?? null }).eq('id', user.id)

  if (existing.profile_completed) {
    return finish('/dashboard')
  }
  return finish('/onboarding')
}

function applyGoogleSigninDashboardFirst(
  path: '/onboarding' | '/dashboard' | '/gynaekolog-dashboard',
  oauthUserIntent?: OAuthUserIntent
): typeof path | '/dashboard?oauth_signin=1' {
  if (oauthUserIntent !== 'signin') return path
  if (path === '/gynaekolog-dashboard') return path
  if (path === '/onboarding') return '/dashboard?oauth_signin=1'
  return '/dashboard'
}
