"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field, Spinner } from "@/components/auth/AuthForm";
import Stamp from "@/components/auth/Stamp";
import { getSupabase } from "@/lib/supabase/client";

// Opened from the reset email. The browser client swaps the ?code in the link for a
// session on load (it needs the code verifier saved when the link was requested,
// so the link must be opened in the same browser), then we set the new password.
export default function NewPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | done
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setStatus(data.session ? "ready" : "invalid"));
  }, []);

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (password.length < 6) next.password = "Use at least 6 characters.";
    if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      const same = /different from the old|same password/i.test(error.message);
      return setErrors({ password: same ? "Choose a password you haven't used before." : "Couldn't save it. Request a new link and try again." });
    }
    setStatus("done");
    setTimeout(() => router.replace("/dashboard"), 900);
  }

  return (
    <div className="bill-box">
      <div className="bill-box-head flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
        <span className="font-display text-base font-extrabold uppercase tracking-wide">New password</span>
        <span lang="ur" dir="rtl" className="font-urdu text-base text-ink-soft">
          نیا پاس ورڈ
        </span>
      </div>

      {status === "checking" && <p className="px-5 py-14 text-center font-bill text-xs uppercase tracking-wide text-ink-soft">Checking your link…</p>}

      {status === "invalid" && (
        <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
          <Stamp tone="ink" faint className="px-4 py-1.5 text-base">
            Expired
          </Stamp>
          <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
            This reset link is expired or was opened in a different browser. Request a new one from the login page.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-2 rounded-[4px] bg-ink px-5 py-3 font-display text-base font-extrabold uppercase leading-none text-paper transition hover:opacity-85"
          >
            Back to log in
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
          <Stamp tone="green" className="px-4 py-1.5 text-base">
            Updated
          </Stamp>
          <p className="font-bill text-xs uppercase tracking-wide text-ink-soft">Taking you to your dashboard…</p>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={submit} className="px-5 py-6">
          <h1 className="font-display text-[34px] font-black uppercase leading-none md:text-[44px]">Set a new password.</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">At least 6 characters.</p>
          <div className="mt-6 space-y-5">
            <Field id="new-password" label="New password" urdu="پاس ورڈ" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} disabled={busy} />
            <Field id="confirm-new-password" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} disabled={busy} />
          </div>
          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-[4px] bg-ink px-5 py-3.5 font-display text-[20px] font-extrabold uppercase leading-none text-paper transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {busy && <Spinner />}
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      )}
    </div>
  );
}
