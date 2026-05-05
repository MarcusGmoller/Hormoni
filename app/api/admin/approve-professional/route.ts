import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { assertAdminByBearerToken } from '@/lib/serverAdminAuth'
import { getSupabaseServiceEnvOrError } from '@/lib/requireSupabaseServiceEnv'

export async function POST(request: NextRequest) {
  const boot = getSupabaseServiceEnvOrError()
  if (!boot.ok) return boot.response
  const { url, publishableKey, serviceRoleKey } = boot.env

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!jwt) {
    return NextResponse.json({ error: 'Mangler Authorization Bearer token.' }, { status: 401 })
  }

  let body: { professionalUserId?: string }
  try {
    body = (await request.json()) as { professionalUserId?: string }
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON.' }, { status: 400 })
  }

  const professionalUserId =
    typeof body.professionalUserId === 'string' ? body.professionalUserId.trim() : ''
  if (!professionalUserId) {
    return NextResponse.json({ error: 'Mangler professionalUserId.' }, { status: 400 })
  }

  const authClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const adminAuth = await assertAdminByBearerToken({
    supabase: authClient,
    jwt,
    serviceRoleClient: adminClient,
  })
  if (!adminAuth.ok) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
  }
  const { error } = await adminClient
    .from('professionals')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      public_profile: true,
    })
    .eq('user_id', professionalUserId)
    .eq('approval_status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
