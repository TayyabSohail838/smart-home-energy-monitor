// Calls one of our API routes as the logged-in test user and prints the result.
// Needs TEST_EMAIL and TEST_PASSWORD in .env.local.
// Usage:
//   npm run api /api/stats/history?range=30d
//   npm run api /api/devices/link POST '{"link_code":"CQTV3R"}'
//   npm run api /api/stats/history?range=day GET "" https://<app>.vercel.app
const { createClient } = require("@supabase/supabase-js");

const [path, method = "GET", body = "", base = "http://localhost:3000"] = process.argv.slice(2);
const { TEST_EMAIL, TEST_PASSWORD } = process.env;

async function main() {
  if (!path) throw new Error("Usage: npm run api <path> [METHOD] [json-body] [base-url]");
  if (!TEST_EMAIL || !TEST_PASSWORD) throw new Error("Set TEST_EMAIL and TEST_PASSWORD in .env.local");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Login failed for ${TEST_EMAIL}: ${error.message}`);

  const res = await fetch(base.replace(/\/$/, "") + path, {
    method: method.toUpperCase(),
    headers: {
      authorization: `Bearer ${data.session.access_token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body || undefined,
  });

  const text = await res.text();
  console.log(`${method.toUpperCase()} ${path} -> ${res.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
