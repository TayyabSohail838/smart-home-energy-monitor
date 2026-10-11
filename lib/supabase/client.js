"use client";

import { createBrowserClient } from "@supabase/ssr";

// One Supabase client for the browser (login, Realtime, reading own rows under RLS).
// Uses the public anon key only.
let client;

export function getSupabase() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return client;
}
