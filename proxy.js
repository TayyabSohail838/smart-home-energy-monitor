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
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isLogin = pathname === "/login";
  if (!isApi && !user && !isLogin) return redirectKeepingCookies(request, response, "/login");
  if (!isApi && user && isLogin) return redirectKeepingCookies(request, response, "/");

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/readings|api/health).*)"],
};
