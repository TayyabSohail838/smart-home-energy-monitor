import { supabaseAdmin } from "@/lib/supabase/admin";

// Saves an alert row. (Step 12 adds the email here.)
export async function createAlert({ deviceId, type, message, powerW = null }) {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({ device_id: deviceId, type, message, power_w: powerW })
    .select("id, ts, type, message, power_w")
    .single();
  if (error) throw new Error(`alert insert failed: ${error.message}`);
  return data;
}

// True if this device already has an alert of this type since `sinceIso`.
export async function hasRecentAlert(deviceId, type, sinceIso) {
  const { count, error } = await supabaseAdmin
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .eq("type", type)
    .gte("ts", sinceIso);
  if (error) throw new Error(`alert lookup failed: ${error.message}`);
  return count > 0;
}
