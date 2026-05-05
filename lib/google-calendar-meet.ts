import { google } from 'googleapis'

export type CreateMeetResult = {
  meetUrl: string
  eventId: string | null
}

function readGoogleCalendarEnv() {
  return {
    clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    calendarId: process.env.GOOGLE_CALENDAR_ID,
  }
}

/** Sandt når alle tre påkrævede variabler er sat (bruges af API-ruten). */
export function isGoogleCalendarConfigured(): boolean {
  const { clientEmail, privateKey, calendarId } = readGoogleCalendarEnv()
  return Boolean(clientEmail && privateKey && calendarId)
}

export const GOOGLE_CALENDAR_CONFIG_HELP =
  'Tilføj i .env.local: GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY (med \\n i nøglen), GOOGLE_CALENDAR_ID. Se env.example. ' +
  'Lokalt uden Google: sæt BOOKING_DEV_PLACEHOLDER_MEET=true (kun development).'

/**
 * Creates a Google Calendar event with a real Google Meet conference.
 *
 * Required env:
 * - GOOGLE_CALENDAR_CLIENT_EMAIL — service account client_email
 * - GOOGLE_CALENDAR_PRIVATE_KEY — private key (use \n for newlines in .env)
 * - GOOGLE_CALENDAR_ID — calendar to insert into (often the service account email,
 *   or a shared calendar ID; with Workspace domain-wide delegation use the target user's calendar)
 *
 * Optional:
 * - GOOGLE_CALENDAR_IMPERSONATE — Workspace user email to impersonate (domain-wide delegation)
 * - GOOGLE_CALENDAR_TIMEZONE — default Europe/Copenhagen
 */
export async function createGoogleMeetCalendarEvent(params: {
  summary: string
  description?: string
  startIso: string
  endIso: string
  timeZone?: string
  attendeeEmails?: string[]
}): Promise<CreateMeetResult> {
  const { clientEmail, privateKey, calendarId } = readGoogleCalendarEnv()
  const impersonate = process.env.GOOGLE_CALENDAR_IMPERSONATE?.trim() || undefined
  const timeZone = params.timeZone ?? process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'Europe/Copenhagen'

  if (!clientEmail || !privateKey || !calendarId) {
    throw new Error(`Google Calendar er ikke konfigureret. ${GOOGLE_CALENDAR_CONFIG_HELP}`)
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
    subject: impersonate,
  })

  const calendar = google.calendar({ version: 'v3', auth })
  const requestId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

  const attendeeEmails = [...new Set((params.attendeeEmails ?? []).map((e) => e.trim()).filter(Boolean))]

  const res = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startIso, timeZone },
      end: { dateTime: params.endIso, timeZone },
      ...(attendeeEmails.length > 0 ? { attendees: attendeeEmails.map((email) => ({ email })) } : {}),
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  })

  const meetUrl =
    res.data.hangoutLink ??
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri

  if (!meetUrl) {
    throw new Error('Google returnerede ikke et Meet-link. Tjek Calendar API og kalendertilgang.')
  }

  return { meetUrl, eventId: res.data.id ?? null }
}
