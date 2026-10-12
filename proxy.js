import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Runs before each page/API request (Next 16 calls middleware "proxy").
// Refreshes the Supabase login cookie when it's about to expire, so routes
// and pages always see a valid session.
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // The landing page and its images are public, so skip the auth work entirely:
  // there is no session to refresh, a first-time visitor shouldn't wait on a
  // Supabase round-trip, and the page still renders if Supabase is down.
  // Logged-in users are NOT bounced off it, so the demo can open on the landing
  // page and click through to the dashboard.
  if (pathname === "/" || pathname.startsWith("/landing/")) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // @supabase/ssr calls this with the cookie list only, so set the no-cache
        // headers here directly: a response that carries a refreshed session
        // cookie must never be cached by a CDN and served to another user.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate");
          response.headers.set("vary", "cookie");
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pages need a login; API routes answer 401 themselves.
  const isApi = pathname.startsWith("/api/");
  const isLogin = pathname === "/login";
  // The reset link signs the user in on the page itself (code in the URL), so let it through.
  const isReset = pathname === "/reset-password";
  if (!isApi && !user && !isLogin && !isReset) return redirectKeepingCookies(request, response, "/login");
  if (!isApi && user && isLogin) return redirectKeepingCookies(request, response, "/dashboard");

  return response;
}

// Redirect, carrying over any refreshed session cookies.
function redirectKeepingCookies(request, response, path) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  // A redirect is per-user (it depends on the session cookie) and may carry a
  // refreshed one, so it must not be cached either.
  redirect.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate");
  redirect.headers.set("vary", "cookie");
  return redirect;
}

export const config = {
  // Skip static files and the device-only routes (the ESP32 has no login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|landing/|api/readings|api/health).*)"],
};
