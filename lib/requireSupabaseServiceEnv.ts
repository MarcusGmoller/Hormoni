import { NextResponse } from 'next/server'

export type SupabaseServiceEnv = {
  url: string
  publishableKey: string
  /** Supabase «Secret key» (sb_secret_…) eller legacy JWT «service_role». */
  serviceRoleKey: string
}

/**
 * URL + publishable + **hemmelig server-nøgle** til API-ruter der skal omgå RLS (admin, slet profil, …).
 * I dashboard: **Secret key** (`sb_secret_…`). Ældre projekter: **service_role** JWT.
 * Miljø: `SUPABASE_SECRET_KEY` eller `SUPABASE_SERVICE_ROLE_KEY` — kun på serveren, aldrig `NEXT_PUBLIC_*`.
 */
export function getSupabaseServiceEnvOrError():
  | { ok: true; env: SupabaseServiceEnv }
  | { ok: false; response: NextResponse } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ''

  const missing: string[] = []
  if (!url?.trim()) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!publishableKey?.trim()) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  if (!serviceRoleKey) {
    missing.push('SUPABASE_SECRET_KEY (Secret key i dashboard) eller SUPABASE_SERVICE_ROLE_KEY (legacy service_role)')
  }

  if (missing.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Mangler miljøvariabler: ${missing.join(', ')}. I Supabase: Settings → API Keys → kopier **Secret** (backend only) ind i .env.local som SUPABASE_SECRET_KEY=…`,
        },
        { status: 500 }
      ),
    }
  }

  return {
    ok: true,
    env: { url: url!, publishableKey: publishableKey!, serviceRoleKey: serviceRoleKey! },
  }
}
