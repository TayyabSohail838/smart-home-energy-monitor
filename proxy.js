import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Runs before each page/API request (Next 16 calls middleware "proxy").
// Refreshes the Supabase login cookie when it's about to expire, so routes
// and pages always see a valid session.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          // No-cache headers so a CDN never serves one user's cookie to another.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static files and the device-only routes (the ESP32 has no login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/readings|api/health).*)"],
};
