import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export function loginErrorRedirect(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin))
}

export function createSupabaseRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }
  return createServerClient(supabaseUrl, supabaseKey, {
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
}

export type OAuthExchangeResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export async function exchangeOAuthCodeForUser(
  supabase: ReturnType<typeof createSupabaseRouteHandlerClient>,
  code: string,
  origin: string
): Promise<OAuthExchangeResult> {
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return { ok: false, response: loginErrorRedirect(origin, exchangeError.message) }
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return {
      ok: false,
      response: loginErrorRedirect(
        origin,
        userError?.message ?? 'Kunne ikke hente bruger efter login.'
      ),
    }
  }
  return { ok: true, user }
}

export function readOAuthProviderError(requestUrl: URL): string | null {
  const oauthError = requestUrl.searchParams.get('error')
  const oauthDesc = requestUrl.searchParams.get('error_description')
  if (!oauthError) return null
  return oauthDesc ?? oauthError
}
