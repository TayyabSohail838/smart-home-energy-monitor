const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The user's alert settings (created when they link a device). Uses the user's
// client, so RLS limits it to their own row.
export async function getSettings(supabase, userId) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("email_alerts, alert_email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`user_settings: ${error.message}`);
  return data;
}

// Validates a PATCH body: { email_alerts?: boolean, alert_email?: string }.
// Returns { changes } or { error }.
export function parseSettingsPatch(body) {
  if (!body || typeof body !== "object") return { error: "body must be a JSON object" };
  const changes = {};

  if ("email_alerts" in body) {
    if (typeof body.email_alerts !== "boolean") return { error: "email_alerts must be true or false" };
    changes.email_alerts = body.email_alerts;
  }
  if ("alert_email" in body) {
    const email = typeof body.alert_email === "string" ? body.alert_email.trim() : "";
    if (!EMAIL_RE.test(email)) return { error: "alert_email must be a valid email" };
    changes.alert_email = email;
  }

  if (Object.keys(changes).length === 0) return { error: "nothing to update" };
  return { changes };
}

export async function updateSettings(supabase, userId, changes) {
  const { data, error } = await supabase
    .from("user_settings")
    .update(changes)
    .eq("user_id", userId)
    .select("email_alerts, alert_email")
    .maybeSingle();
  if (error) throw new Error(`user_settings update: ${error.message}`);
  return data;
}
