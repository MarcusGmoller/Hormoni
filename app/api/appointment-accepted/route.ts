import { NextResponse } from 'next/server'

type Payload = {
  to?: string
  patientName?: string
  appointmentTime?: string
  googleMeetUrl?: string | null
  meetOpenAt?: string | null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload
    const to = body?.to?.trim()
    if (!to) {
      return NextResponse.json({ ok: false, error: 'Missing email recipient' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const from = process.env.FROM_EMAIL ?? 'noreply@scandinavianhealth.app'
    if (!resendApiKey) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const whenText = body.appointmentTime
      ? new Date(body.appointmentTime).toLocaleString('da-DK', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'det aftalte tidspunkt'
    const subject = 'Din tid er godkendt'
    const meetSection = body.googleMeetUrl
      ? `<p>Google Meet-link: <a href="${body.googleMeetUrl}">${body.googleMeetUrl}</a></p><p>Linket aktiveres ${new Date(body.meetOpenAt ?? body.appointmentTime ?? Date.now()).toLocaleString('da-DK')} (15 min før start).</p>`
      : '<p>Mødelink bliver vist i appen under dine aftaledetaljer.</p>'
    const html = `<p>Hej ${body.patientName ?? 'der'},</p><p>Din tid hos gynækologen er nu godkendt: <strong>${whenText}</strong>.</p>${meetSection}<p>Du kan se detaljerne i appen under dine beskeder/aftaler.</p>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      return NextResponse.json({ ok: false, error: details }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
