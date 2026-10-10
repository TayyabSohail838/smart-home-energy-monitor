import { supabaseAdmin } from "@/lib/supabase/admin";

// Links the device with this link code to the user.
// Rules: the device must be unlinked, and the user must not have a device yet.
// Returns { device } or { error, status }.
export async function linkDevice(user, rawCode) {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { error: "link_code must be 6 letters/numbers", status: 400 };
  }

  const { data: existing } = await supabaseAdmin
    .from("devices")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { error: "you already have a device", status: 409 };

  // Only links if still unlinked, so two users can't grab the same device.
  const { data: device, error } = await supabaseAdmin
    .from("devices")
    .update({ user_id: user.id })
    .eq("link_code", code)
    .is("user_id", null)
    .select("id, name, link_code")
    .maybeSingle();
  if (error) {
    // 23505 = unique index devices_one_per_user (user linked another device at the same moment)
    if (error.code === "23505") return { error: "you already have a device", status: 409 };
    console.error("link failed:", error.message);
    return { error: "could not link device", status: 500 };
  }

  if (!device) {
    const { data: found } = await supabaseAdmin
      .from("devices")
      .select("id")
      .eq("link_code", code)
      .maybeSingle();
    return found
      ? { error: "device is already linked to another account", status: 409 }
      : { error: "link code not found", status: 404 };
  }

  // Email alerts on by default, sent to the login email. Keep existing settings.
  const { error: settingsError } = await supabaseAdmin
    .from("user_settings")
    .upsert(
      { user_id: user.id, email_alerts: true, alert_email: user.email },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
  if (settingsError) console.error("user_settings insert failed:", settingsError.message);

  return { device };
}
