import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SHA-256 hex of a device secret. Only this hash is stored in the database.
export function hashKey(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

// Returns true if `secret` belongs to device `deviceId`.
export async function verifyDevice(deviceId, secret) {
  if (typeof deviceId !== "string" || !UUID_RE.test(deviceId)) return false;
  if (typeof secret !== "string" || secret.length === 0) return false;

  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("device_key_hash")
    .eq("id", deviceId)
    .maybeSingle();
  if (error || !data) return false;

  // Constant-time compare so the response time doesn't leak the hash.
  const expected = Buffer.from(data.device_key_hash, "hex");
  const actual = Buffer.from(hashKey(secret), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
