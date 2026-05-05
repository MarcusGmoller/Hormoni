import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createGoogleMeetCalendarEvent,
  isGoogleCalendarConfigured,
} from '@/lib/google-calendar-meet'

type Body = {
  startTime?: string
  endTime?: string
  professionalId?: string
}

function pickEmail(row: { contact_email?: string | null; email?: string | null } | null) {
  const a = row?.contact_email?.trim()
  const b = row?.email?.trim()
  if (a && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return a
  if (b && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b)) return b
  return null
}

/**
 * POST — opretter rigtigt Google Meet via Calendar API (server-side).
 * Auth: Authorization: Bearer <supabase access token>
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (!token) {
      return NextResponse.json({ error: 'Mangler autorisation' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase er ikke konfigureret' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, anonKey)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Ugyldig session' }, { status: 401 })
    }

    const body = (await req.json()) as Body
    const startIso = body.startTime?.trim()
    const endIso = body.endTime?.trim()
    const professionalId = body.professionalId?.trim()

    if (!startIso || !endIso || !professionalId) {
      return NextResponse.json({ error: 'Mangler startTime, endTime eller professionalId' }, { status: 400 })
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const [{ data: patientRow }, { data: proRow }] = await Promise.all([
      supabaseUser.from('profiles').select('full_name,contact_email,email').eq('id', user.id).single(),
      supabaseUser.from('profiles').select('full_name,contact_email,email').eq('id', professionalId).single(),
    ])

    const patientName = patientRow?.full_name?.trim() || 'Patient'
    const proName = proRow?.full_name?.trim() || 'Behandler'
    const patientEmail = pickEmail(patientRow)
    const proEmail = pickEmail(proRow)

    const start = new Date(startIso)
    const end = new Date(endIso)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Ugyldige tider' }, { status: 400 })
    }

    const meetOpenAt = new Date(start.getTime() - 15 * 60 * 1000).toISOString()
    const openDa = new Date(meetOpenAt).toLocaleString('da-DK', {
      timeZone: 'Europe/Copenhagen',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    let meetUrl: string

    if (isGoogleCalendarConfigured()) {
      const created = await createGoogleMeetCalendarEvent({
        summary: `Videokonsultation: ${patientName} / ${proName}`,
        description: `Videokonsultation booket via appen.\n\nMødelinket kan bruges fra ${openDa} (15 min før start).`,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        attendeeEmails: [patientEmail, proEmail].filter((e): e is string => Boolean(e)),
      })
      meetUrl = created.meetUrl
    } else if (
      process.env.NODE_ENV === 'development' &&
      process.env.BOOKING_DEV_PLACEHOLDER_MEET === 'true'
    ) {
      meetUrl =
        'https://meet.google.com/placeholder-dev-udvikling-konfigurer-google-calendar-for-rigtigt-link'
    } else {
      return NextResponse.json(
        {
          error:
            'Google Calendar er ikke konfigureret. Sæt GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY og GOOGLE_CALENDAR_ID i .env.local (se env.example). ' +
            'Til lokal test uden Google: BOOKING_DEV_PLACEHOLDER_MEET=true (kun når Next kører i development).',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      googleMeetUrl: meetUrl,
      meetOpenAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Uventet fejl'
    console.error('[google-meet]', e)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
