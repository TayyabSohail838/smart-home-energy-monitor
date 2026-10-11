import { sendAlertEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SUBJECTS = {
  anomaly: "Unusual electricity usage",
  slab_warning: "You're heading into a higher tariff slab",
};

// Saves an alert row, then emails the device owner if they have email alerts on.
// Email failure is logged, never thrown.
export async function createAlert({ deviceId, type, message, powerW = null, subject = SUBJECTS[type] ?? "Alert" }) {
  const { data: alert, error } = await supabaseAdmin
    .from("alerts")
    .insert({ device_id: deviceId, type, message, power_w: powerW })
    .select("id, ts, type, message, power_w")
    .single();
  if (error) throw new Error(`alert insert failed: ${error.message}`);

  const to = await alertEmailFor(deviceId);
  if (to) {
    const sent = await sendAlertEmail(to, `Wattly: ${subject}`, message);
    if (sent) {
      const { error: updErr } = await supabaseAdmin
        .from("alerts").update({ emailed: true }).eq("id", alert.id);
      if (updErr) console.error("could not mark alert emailed:", updErr.message);
    }
  }
  return alert;
}

// The owner's alert email if the device is linked and email alerts are on, else null.
async function alertEmailFor(deviceId) {
  try {
    const { data: device } = await supabaseAdmin
      .from("devices").select("user_id").eq("id", deviceId).maybeSingle();
    if (!device?.user_id) return null;

    const { data: settings } = await supabaseAdmin
      .from("user_settings").select("email_alerts, alert_email").eq("user_id", device.user_id).maybeSingle();
    return settings?.email_alerts && settings.alert_email ? settings.alert_email : null;
  } catch (err) {
    console.error("alert email lookup failed:", err.message);
    return null;
  }
}

// True if this device already has an alert of this type since `sinceIso`
// (optionally only alerts whose message contains `messageContains`).
export async function hasRecentAlert(deviceId, type, sinceIso, messageContains = null) {
  let query = supabaseAdmin
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .eq("type", type)
    .gte("ts", sinceIso);
  if (messageContains) query = query.like("message", `%${messageContains}%`);

  const { count, error } = await query;
  if (error) throw new Error(`alert lookup failed: ${error.message}`);
  return count > 0;
}

// The user's alerts, newest first.
export async function listAlerts(supabase, deviceId, limit = 50) {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, ts, type, message, power_w, emailed")
    .eq("device_id", deviceId)
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`alerts: ${error.message}`);
  return data;
}
