import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY!
  )
  return supabase
}