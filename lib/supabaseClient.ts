import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/**
 * Browser-klient med PKCE-verifier i cookies (via @supabase/ssr).
 * Undgår "PKCE code verifier not found in storage" ved Google OAuth + Next production.
 * Session i ren localStorage (gammel createClient) deles ikke — brugere kan skulle logge ind igen én gang.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
