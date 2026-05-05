import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const routeByProfessionalState = (
  professional: {
    approval_status: string
    bio?: string | null
    professional_name?: string | null
    payment_information?: string | null
    professional_email?: string | null
    professional_phone?: string | null
  } | null
) => {
  if (!professional) return '/gynaekolog-onboarding'
  if (professional.approval_status === 'approved') return '/gynaekolog-dashboard'
  if (
    !professional.bio?.trim() ||
    !professional.professional_name?.trim() ||
    !professional.payment_information?.trim() ||
    !professional.professional_email?.trim() ||
    !professional.professional_phone?.trim()
  ) {
    return '/gynaekolog-onboarding'
  }
  return '/gynaekolog-pending'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const response = NextResponse.redirect(new URL('/gynaekolog-onboarding', url.origin))

  if (!code) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
    }
  )

  await supabase.auth.exchangeCodeForSession(code)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: professional } = await supabase
      .from('professionals')
      .select('approval_status,bio,professional_name,payment_information,professional_email,professional_phone')
      .eq('user_id', user.id)
      .maybeSingle()

    const destination = routeByProfessionalState(
      professional as {
        approval_status: string
        bio?: string | null
        professional_name?: string | null
        payment_information?: string | null
        professional_email?: string | null
        professional_phone?: string | null
      } | null
    )
    response.headers.set('Location', new URL(destination, url.origin).toString())
  }

  return response
}
