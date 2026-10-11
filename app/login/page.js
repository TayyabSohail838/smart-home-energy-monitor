"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthFrame, { buttonClass, inputClass } from "@/components/AuthFrame";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = getSupabase();
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);

    if (error) return setMessage({ ok: false, text: error.message });
    if (mode === "signup" && !data.session) {
      return setMessage({ ok: true, text: "Account created. Check your email to confirm it, then log in." });
    }
    router.replace("/");
    router.refresh();
  }

  const signup = mode === "signup";
  return (
    <AuthFrame
      title={signup ? "Create account" : "Welcome back"}
      subtitle="See your electricity live, know your bill before it arrives."
    >
      <form onSubmit={submit} className="space-y-3">
        <input className={inputClass} type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className={buttonClass} disabled={busy}>
          {busy ? "Please wait…" : signup ? "Sign up" : "Log in"}
        </button>
      </form>

      {message && (
        <p className={`mt-4 text-sm animate-fade-up ${message.ok ? "text-[#006300]" : "text-[var(--critical)]"}`}>
          {message.ok ? "✓" : "⚠"} {message.text}
        </p>
      )}

      <p className="mt-6 text-center text-sm text-ink-3">
        {signup ? "Already have an account?" : "New here?"}{" "}
        <button
          onClick={() => {
            setMode(signup ? "login" : "signup");
            setMessage(null);
          }}
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          {signup ? "Log in" : "Create an account"}
        </button>
      </p>
    </AuthFrame>
  );
}
