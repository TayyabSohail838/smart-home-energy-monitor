import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

// Supabase client for requests from a logged-in user, so RLS sees who the user is.
// The browser sends its session in cookies. Postman can instead send
// "Authorization: Bearer <access_token>" (get one with `npm run get-token`).
// Create a new one per request.
export async function createClient() {
  const token = await bearerToken();
  if (token) {
    return createPlainClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }

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
            // Called from a place that can't set cookies; proxy.js refreshes the session instead.
          }
        },
      },
    }
  );
}

// The access token from an "Authorization: Bearer ..." header, or null.
export async function bearerToken() {
  const auth = (await headers()).get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}
