"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthTabs from "@/components/auth/AuthTabs";
import Stamp from "@/components/auth/Stamp";
import { getSupabase } from "@/lib/supabase/client";

const COPY = {
  login: {
    headerLabel: "Consumer login",
    headerUrdu: "خوش آمدید",
    refLine: "COUNTER 01",
    heading: "Welcome back.",
    subline: "Check today's units before they check you.",
    button: "Log in",
    busyButton: "Checking meter…",
    switchPrompt: "New here?",
    switchCta: "New connection",
  },
  signup: {
    headerLabel: "New connection application",
    headerUrdu: "نیا کنکشن",
    refLine: "FORM WTLY-01 · Residential",
    heading: "Get connected.",
    subline: "Create your account, then link your Wattly device.",
    button: "Apply for connection",
    busyButton: "Processing application…",
    switchPrompt: "Already connected?",
    switchCta: "Log in",
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Maps a Supabase auth error to the friendly copy in login-design.md §5.
// Login never reveals which part (email or password) was wrong.
function mapAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return { text: "Email or password doesn't match." };
  if (m.includes("email not confirmed")) return { text: "Confirm your email first. Check your inbox." };
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already"))
    return { text: "This email already has an account.", offerLogin: true };
  return { text: "Something went wrong. Try again in a moment." };
}

export default function AuthForm({ initialMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(null); // null | { type: "connected" | "receipt", email? }

  const c = COPY[mode];
  const signup = mode === "signup";

  function switchMode(next) {
    if (next === mode) return;
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    // Keeps every typed field (login-design.md §4.1 only requires email to
    // survive, so keeping password/confirm too is a superset, not a miss).
    router.replace(`/login?mode=${next}`, { scroll: false });
  }

  function triggerShake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 260);
  }

  function validate() {
    const errors = {};
    if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    else if (signup && password.length < 6) errors.password = "Use at least 6 characters.";
    if (signup && confirmPassword !== password) errors.confirm = "Passwords don't match.";
    return errors;
  }

  async function submit(e) {
    e.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      triggerShake();
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const supabase = getSupabase();
      const { data, error } = signup
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) {
        setBusy(false);
        triggerShake();
        setFormError(mapAuthError(error.message));
        return;
      }

      if (signup && !data.session) {
        // Email confirmation is on: no session yet. Replace the form with a
        // receipt instead of redirecting (login-design.md §5).
        setBusy(false);
        setSuccess({ type: "receipt", email: email.trim() });
        return;
      }

      // Either a login, or a sign-up with confirmation off (session already
      // returned). Show the stamp, then move on — sign-ups always need a
      // device link; logins may too, but that's useApi's existing 404 -> /link
      // redirect, not this form's job.
      setSuccess({ type: "connected" });
      setTimeout(() => {
        router.replace(signup ? "/link" : "/dashboard");
        router.refresh();
      }, 350);
    } catch {
      setBusy(false);
      triggerShake();
      setFormError({ text: "Something went wrong. Try again in a moment." });
    }
  }

  if (success?.type === "receipt") return <Receipt email={success.email} onBackToLogin={() => switchMode("login")} />;

  return (
    <div id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
      <AuthTabs mode={mode} onChange={switchMode} panelId="auth-panel" />

      <div className="bill-box rounded-t-none">
        <div className="bill-box-head flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
          <span className="font-display text-base font-extrabold uppercase tracking-wide">{c.headerLabel}</span>
          <span lang="ur" dir="rtl" className="font-urdu text-base text-ink-soft">
            {c.headerUrdu}
          </span>
        </div>
        <p className="border-b border-dotted border-rule px-5 py-1.5 font-bill text-[11px] uppercase tracking-wide text-ink-soft">
          {c.refLine}
        </p>

        {success?.type === "connected" ? (
          <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
            <Stamp tone="green" className="px-4 py-1.5 text-base">
              Connected
            </Stamp>
            <p className="font-bill text-xs uppercase tracking-wide text-ink-soft">
              {signup ? "Taking you to link your device…" : "Taking you to your dashboard…"}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-6">
            <h1 className="font-display text-[34px] font-black uppercase leading-none md:text-[44px]">{c.heading}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.subline}</p>

            {formError && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-5 flex items-start gap-2 rounded-[4px] border-[1.5px] border-stamp px-3.5 py-2.5 text-sm text-stamp"
              >
                <span aria-hidden="true">⚠</span>
                <span>
                  {formError.text}{" "}
                  {formError.offerLogin && (
                    <button type="button" onClick={() => switchMode("login")} className="font-semibold underline underline-offset-2">
                      Log in instead
                    </button>
                  )}
                </span>
              </div>
            )}

            <div className={`mt-6 space-y-5 ${shaking ? "field-shake" : ""}`}>
              <Field
                id="email"
                label="Email"
                urdu="ای میل"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                error={fieldErrors.email}
                disabled={busy}
              />

              <PasswordFields
                signup={signup}
                password={password}
                confirmPassword={confirmPassword}
                onPassword={setPassword}
                onConfirm={setConfirmPassword}
                show={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                passwordError={fieldErrors.password}
                confirmError={fieldErrors.confirm}
                disabled={busy}
              />
            </div>

            <button
              type="submit"
              disabled={busy || !email || !password || (signup && !confirmPassword)}
              className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-[4px] bg-ink px-5 py-3.5 font-display text-[20px] font-extrabold uppercase leading-none text-paper transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)] focus-visible:-translate-y-0.5 focus-visible:shadow-[4px_4px_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
            >
              {busy && <Spinner />}
              {busy ? c.busyButton : c.button}
            </button>

            <p className="mt-5 text-center text-sm text-ink-soft">
              {c.switchPrompt}{" "}
              <button type="button" onClick={() => switchMode(signup ? "login" : "signup")} className="font-semibold text-ink underline-offset-4 hover:underline">
                {c.switchCta}
              </button>
            </p>

            {signup && (
              <p className="mt-4 font-bill text-[11px] leading-relaxed text-ink-soft">
                By applying you agree to receive usage alert emails. You can turn them off in Settings.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, urdu, type, autoComplete, value, onChange, error, disabled, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="font-bill text-xs uppercase tracking-wide text-ink-soft">
          {label}
        </label>
        {urdu && (
          <span lang="ur" dir="rtl" className="font-urdu text-sm text-ink-soft">
            {urdu}
          </span>
        )}
      </div>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-none rounded-r-[4px] border-[1.5px] bg-paper px-3.5 py-3 font-bill text-base text-ink outline-none transition-colors disabled:opacity-60 ${
            error ? "border-stamp" : "border-ink"
          } focus:border-[2px] focus:border-usage focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-usage/40`}
        />
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-stamp">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
    </div>
  );
}

function PasswordFields({ signup, password, confirmPassword, onPassword, onConfirm, show, onToggleShow, passwordError, confirmError, disabled }) {
  const type = show ? "text" : "password";
  const strong = password.length >= 6;
  return (
    <>
      <Field
        id="password"
        label="Password"
        urdu="پاس ورڈ"
        type={type}
        autoComplete={signup ? "new-password" : "current-password"}
        value={password}
        onChange={onPassword}
        error={passwordError}
        disabled={disabled}
      />
      {signup && (
        <p className={`-mt-3.5 font-bill text-[11px] uppercase tracking-wide ${strong ? "text-ok" : "text-ink-soft"}`}>
          {strong ? "✓ " : ""}Min. 6 characters
        </p>
      )}

      {signup && (
        <Field
          id="confirm-password"
          label="Confirm password"
          type={type}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={onConfirm}
          error={confirmError}
          disabled={disabled}
        />
      )}

      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? "Hide password" : "Show password"}
        className="flex items-center gap-1.5 font-bill text-xs uppercase tracking-wide text-ink-soft hover:text-ink"
      >
        <EyeIcon open={show} /> {show ? "Hide password" : "Show password"}
      </button>
    </>
  );
}

function Receipt({ email, onBackToLogin }) {
  return (
    <div id="auth-panel" className="bill-box relative">
      <div className="bill-box-head px-5 py-2.5">
        <span className="font-display text-base font-extrabold uppercase tracking-wide">New connection application</span>
      </div>
      <div className="relative flex flex-col items-center gap-4 px-5 py-14 text-center">
        <Stamp tone="ink" faint className="px-4 py-1.5 text-base">
          Received
        </Stamp>
        <div className="font-bill text-sm uppercase tracking-wide text-ink-soft">
          <p>Application received</p>
          <p className="mt-1 text-ink">Email: {email}</p>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
          Check your inbox to confirm your email, then log in.
        </p>
        <button
          type="button"
          onClick={onBackToLogin}
          className="mt-2 rounded-[4px] bg-ink px-5 py-3 font-display text-base font-extrabold uppercase leading-none text-paper transition hover:opacity-85"
        >
          Back to log in
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-paper/40 border-t-paper" aria-hidden="true" />;
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      {open ? (
        <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M6.6 6.7C4.5 8 3 10 3 12c0 1 3 7 9 7 1.6 0 3-.4 4.2-1M17.5 17.4C19.6 16 21 14 21 12c0-1.2-1.4-4-4.2-5.7" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M3 12c0-1 3-7 9-7s9 6 9 7-3 7-9 7-9-6-9-7Z" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
    </svg>
  );
}
