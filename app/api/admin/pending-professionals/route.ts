import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { assertAdminByBearerToken } from '@/lib/serverAdminAuth'
import { getSupabaseServiceEnvOrError } from '@/lib/requireSupabaseServiceEnv'

export async function GET(request: NextRequest) {
  const boot = getSupabaseServiceEnvOrError()
  if (!boot.ok) return boot.response
  const { url, publishableKey, serviceRoleKey } = boot.env

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!jwt) {
    return NextResponse.json({ error: 'Mangler Authorization Bearer token.' }, { status: 401 })
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

  const { data, error } = await adminClient
    .from('professionals')
    .select('user_id,professional_name,professional_email,professional_phone,title,bio,created_at,approval_status')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ pending: data ?? [] })
}
