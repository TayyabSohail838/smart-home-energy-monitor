import { checkAnomaly } from "@/lib/anomaly";
import { verifyDevice } from "@/lib/deviceAuth";
import { parseReadings } from "@/lib/readings";
import { checkSlab } from "@/lib/slabWarning";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST /api/readings - called by the ESP32 every 10 s.
// Headers: x-device-key (required), x-device-id (optional if device_id is in the body).
// Body: one reading or an array of readings (backlog after reconnect).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const first = Array.isArray(body) ? body[0] : body;
  const deviceId = request.headers.get("x-device-id") ?? first?.device_id;
  const key = request.headers.get("x-device-key");

  if (!(await verifyDevice(deviceId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { rows, skipped, error } = parseReadings(body, deviceId);
  if (error) return Response.json({ error }, { status: 400 });

  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("readings").insert(rows);
    if (insertError) {
      console.error("readings insert failed:", insertError.message);
      return Response.json({ error: "insert failed" }, { status: 500 });
    }
  }

  // Alert checks. They must never fail the insert, so errors are only logged.
  if (rows.length > 0) {
    try {
      const result = await checkAnomaly(deviceId);
      if (result.anomaly) console.log("anomaly alert:", result.message);
    } catch (err) {
      console.error("anomaly check failed:", err);
    }
    try {
      const result = await checkSlab(deviceId);
      if (result.warned) console.log("slab warning:", result.message);
    } catch (err) {
      console.error("slab check failed:", err);
    }
  }

  return Response.json({ ok: true, ...(skipped ? { skipped } : {}) }, { status: 201 });
}
