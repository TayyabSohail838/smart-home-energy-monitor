import { bearerToken, createClient } from "@/lib/supabase/server";

const json = (error, status) => Response.json({ error }, { status });

// The logged-in user, or { response: 401 }.
export async function getUser() {
  const supabase = await createClient();
  const token = await bearerToken();
  // getUser() checks the session with Supabase Auth (not just the cookie contents).
  const { data, error } = await supabase.auth.getUser(token ?? undefined);
  if (error || !data.user) return { response: json("not logged in", 401) };
  return { supabase, user: data.user };
}

// The logged-in user and their one device.
// Returns { supabase, user, device } or { response } (401 not logged in, 404 no device).
// Every user route uses this, so they only ever read the user's own device.
export async function getUserDevice() {
  const result = await getUser();
  if (result.response) return result;

  const { data: device, error } = await result.supabase
    .from("devices")
    .select("id, name, link_code, created_at")
    .eq("user_id", result.user.id)
    .maybeSingle();
  if (error) return { response: json("could not load device", 500) };
  if (!device) return { response: json("no device linked", 404) };

  return { ...result, device };
}
