// Logs in and prints an access token for testing user routes in Postman.
// Usage: npm run get-token -- you@example.com yourpassword
// Then in Postman: Authorization -> Bearer Token -> paste it. Valid for 1 hour.
const { createClient } = require("@supabase/supabase-js");

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run get-token -- <email> <password>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

supabase.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
  if (error) {
    console.error("Login failed:", error.message);
    process.exit(1);
  }
  console.log(data.session.access_token);
});
