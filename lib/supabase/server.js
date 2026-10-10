import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for requests from a logged-in user.
// Reads the session from cookies, so RLS sees who the user is.
// Create a new one per request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a place that can't set cookies; middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
