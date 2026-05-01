import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { syncProfileAfterAuthAndResolvePath } from '@/lib/authPostLogin'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const selectedRole = url.searchParams.get('role')
  const role = selectedRole === 'professional' ? 'professional' : 'user'

  // response først, så vi kan sætte cookies på den
  const response = NextResponse.redirect(
    new URL(role === 'professional' ? '/gynaekolog-dashboard' : '/dashboard', url.origin)
  )


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
    if (role === 'professional') {
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email ?? null,
          role,
        },
        { onConflict: 'id' }
      )
    } else {
      const destination = await syncProfileAfterAuthAndResolvePath(supabase, user)
      response.headers.set('location', new URL(destination, url.origin).toString())
    }
  }

  return response
}