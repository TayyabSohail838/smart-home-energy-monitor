"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthFrame, { buttonClass, inputClass } from "@/components/AuthFrame";
import { getSupabase } from "@/lib/supabase/client";

export default function LinkDevicePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let res, body;
    try {
      res = await fetch("/api/devices/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ link_code: code }),
      });
      body = await res.json().catch(() => ({}));
    } catch {
      // Without this the button stays disabled on "Linking…" until a reload.
      setBusy(false);
      return setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
    if (res.status === 401) return router.replace("/login");
    if (!res.ok && body.error !== "you already have a device") return setError(body.error ?? "Could not link the device");
    router.replace("/");
  }

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <AuthFrame title="Link your device" subtitle="Enter the 6-character code printed on your energy monitor.">
      <form onSubmit={submit} className="space-y-3">
        <input
          className={`${inputClass} text-center font-mono text-2xl uppercase tracking-[0.5em]`}
          maxLength={6}
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          required
        />
        <button className={buttonClass} disabled={busy || code.length !== 6}>
          {busy ? "Linking…" : "Link device"}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-[var(--critical)] animate-fade-up">⚠ {error}</p>}
      <button onClick={logout} className="mt-6 w-full text-center text-sm text-ink-3 hover:text-ink">
        Log out
      </button>
    </AuthFrame>
  );
}
