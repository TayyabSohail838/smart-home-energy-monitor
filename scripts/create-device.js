// Creates one device and prints its id, secret and link code ONCE.
// Usage: npm run create-device -- "Living room"
const { randomBytes, randomInt, createHash } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// No 0/O/1/I so the printed code is easy to read.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function linkCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

async function main() {
  const name = process.argv[2] || "Demo device";
  const secret = randomBytes(24).toString("hex");
  // Same hash as hashKey() in lib/deviceAuth.js
  const device_key_hash = createHash("sha256").update(secret).digest("hex");

  const { data, error } = await supabase
    .from("devices")
    .insert({ name, link_code: linkCode(), device_key_hash })
    .select("id, link_code")
    .single();
  if (error) throw error;

  console.log("Device created. Save these now; the secret is not stored anywhere.\n");
  console.log("device_id :", data.id);
  console.log("secret    :", secret);
  console.log("link_code :", data.link_code);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
