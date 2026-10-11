# design-auth.md: Wattly Login & Sign-up

Login and sign-up pages for **Wattly**. They continue the landing page's concept, **"the electric bill, reimagined"**, and reuse its tokens, fonts and Urdu-label rules from `design.md`.

**Concept:** sign-up is a **"New Connection" application form** (like applying for a WAPDA/FESCO connection), and login is the **"Consumer login"** counter. Both sit on bill paper, with ink borders, mono fields and stamps.

Auth is Supabase email + password (already built). This file is design only; no new tables, no new dependencies.

---

## 1. Decisions

| Decision | Choice |
| --- | --- |
| Route | One page, `/login`, with two modes: `?mode=login` (default) and `?mode=signup` |
| Switching modes | Tab strip at the top of the form; updates the URL, no page reload |
| Layout | Split screen on desktop (form + bill panel); form only on mobile |
| Fields | Email + password (sign-up adds confirm password) |
| Out of scope | Social login, forgot password, name/phone fields. Don't build these. |

Landing page buttons already point here: `Get started` → `/login?mode=signup`, `Log in` → `/login`.

---

## 2. Tokens

Same as `design.md` (paper, ink, rule, usage-blue, ac-orange, stamp-red, ok-green; Big Shoulders Display, Martian Mono, Instrument Sans, Noto Nastaliq Urdu). No new colours.

### Urdu words used (only these)

| Urdu | Meaning | Where |
| --- | --- | --- |
| خوش آمدید | Welcome | Login heading label |
| نیا کنکشن | New connection | Sign-up heading label |
| ای میل | Email | Email field corner label |
| پاس ورڈ | Password | Password field corner label |

Urdu always `lang="ur" dir="rtl"`, ≈1.15× the size of the English beside it.

---

## 3. Layout

### Desktop (≥ 1024px): split screen

```
┌──────────────────────────────┬──────────────────────────────┐
│  WATTLY · بجلی کا بل          │                              │
│                              │      BILL PANEL (3.3)        │
│   [ Log in | New connection ]│      ink-on-paper visual,    │
│                              │      mini bill stub,         │
│        FORM SLIP (3.2)       │      one-line pitch          │
│                              │                              │
│   ← Back to home             │                              │
└──────────────────────────────┴──────────────────────────────┘
       ~45% width                       ~55% width
```

- Left: form side on `--paper`. Right: bill panel on `--paper-dark` with a faint grain and a vertical dotted rule separating the halves.
- Header strip (top-left): Wattly logo + `بجلی کا بل`, linking to `/`.

### Tablet (768–1023px)

Form centred, max-width 480px. The bill panel shrinks to a short strip above the form (stub only, no pitch text).

### Mobile (< 768px)

Form only, full width, 16px gutters. Header strip at the top. No bill panel. No horizontal scroll.

---

## 4. Components

### 4.1 Mode tabs

Two tabs styled like the perforated tabs on a bill folder:

- `Log in` | `New connection`
- Active tab: ink background, paper text, Big Shoulders 20px uppercase.
- Inactive: transparent, ink-soft text, dotted bottom border.
- `role="tablist"`; arrow keys switch tabs. Switching clears errors but keeps the typed email.

### 4.2 Form slip

A boxed card (1.5px ink border, 4px radius), like a form you fill at the utility office.

**Card header strip** (`--paper-dark`):
- Login: **"Consumer login"** + Urdu `خوش آمدید` on the right.
- Sign-up: **"New connection application"** + Urdu `نیا کنکشن` on the right.
- Small mono reference line under it: `FORM WTLY-01 · Residential` (login: `COUNTER 01`).

**Heading** (Big Shoulders, 44px → 34px mobile):
- Login: **"Welcome back."**
- Sign-up: **"Get connected."**

**Sub-line** (Instrument Sans, ink-soft):
- Login: *"Check today's units before they check you."*
- Sign-up: *"Create your account, then link your Wattly device."*

**Fields**, styled like boxes on a printed form:
- Label above in small mono uppercase (`EMAIL`, `PASSWORD`), Urdu label in the field's top-right corner.
- Input: paper background, 1.5px ink border, no radius on the left edge, Martian Mono 16px text (16px also stops iOS zoom).
- Focus: border thickens to 2px `--usage-blue` + soft blue outline. Never remove focus rings.
- Password: show/hide toggle (eye icon button, `aria-label="Show password"`).

| Mode | Fields | `autocomplete` |
| --- | --- | --- |
| Login | Email, Password | `email`, `current-password` |
| Sign-up | Email, Password, Confirm password | `email`, `new-password`, `new-password` |

Sign-up password hint under the field, in mono: `MIN. 6 CHARACTERS` (Supabase default). It turns green with a ✓ when met.

**Primary button** (full width, ink background, paper text, Big Shoulders 20px uppercase):
- Login: **"Log in"**
- Sign-up: **"Apply for connection"**
- Hover: lifts 2px with a hard ink shadow (`4px 4px 0 var(--ink)`), like a rubber stamp.

**Below the button:**
- Login: *"New here?"* → switches to sign-up tab.
- Sign-up: *"Already connected?"* → switches to login tab.
- Small mono footnote (sign-up): *"By applying you agree to receive usage alert emails. You can turn them off in Settings."*

**Back link** (below the slip): `← Back to home`.

### 4.3 Bill panel (desktop right side)

A decorative, static version of the landing hero, so the brand carries over:

- A **mini bill stub**, slightly rotated (−3°), showing: `Units 287 · Slab 201–300 · Projected Rs 14,820`, with the red **"PROJECTED"** stamp.
- Below it, pitch in Big Shoulders 40px: **"Your bill, live. Not once a month."**
- Three mono bullet lines with ✓:
  - `Live units every 10 seconds`
  - `Email before you cross a slab`
  - `Next month's bill, forecast`
- Tiny footnote: *"Sample data."*
- No animation except the stamp thumping in once on load (respects reduced motion).
- `aria-hidden="true"` on the decorative stub; the pitch text stays readable to screen readers.

---

## 5. States

| State | Look |
| --- | --- |
| **Idle** | As above. Button enabled once fields are non-empty. |
| **Submitting** | Button shows a small spinner + text: login **"Checking meter…"**, sign-up **"Processing application…"**. Inputs disabled. |
| **Field error** | Field border `--stamp-red`, message under it in red with a ⚠ icon. Linked via `aria-describedby`. |
| **Form error** | Red-bordered note at the top of the slip with ⚠ icon, in an `aria-live="polite"` region. |
| **Success (login)** | A green **"CONNECTED"** stamp thumps onto the slip (0.3 s), then redirect. |
| **Success (sign-up, email confirmation on)** | The form is replaced by a "receipt": mono lines `APPLICATION RECEIVED`, `EMAIL: you@…`, then *"Check your inbox to confirm your email, then log in."* A faint **"RECEIVED"** stamp. Button: **"Back to log in"**. |
| **Success (sign-up, confirmation off)** | Same "CONNECTED" stamp, then redirect to `/link`. |

### Validation (client-side, before calling Supabase)

| Check | Message |
| --- | --- |
| Email empty or invalid | "Enter a valid email address." |
| Password empty | "Enter your password." |
| Sign-up password < 6 chars | "Use at least 6 characters." |
| Confirm doesn't match | "Passwords don't match." |

### Supabase error → friendly message

| Supabase error | Shown as |
| --- | --- |
| `Invalid login credentials` | "Email or password doesn't match." |
| `Email not confirmed` | "Confirm your email first. Check your inbox." |
| `User already registered` | "This email already has an account." + link **"Log in instead"** |
| Rate limit / network / anything else | "Something went wrong. Try again in a moment." |

Never reveal which part (email or password) was wrong on login.

---

## 6. After login / sign-up

- Login success → `/dashboard`. The existing `useApi` logic already sends users with no device to `/link`.
- Sign-up success (session returned) → `/link`.
- Already logged-in user opening `/login` → redirect to `/dashboard` (in `proxy.js` or the page).

---

## 7. Motion

- CSS-only; no animation library.
- Tab switch: form content cross-fades (150 ms) and the slip height animates smoothly.
- Stamps: scale 1.4 → 1 with rotation, 0.25–0.3 s, slight overshoot.
- Field error: one small horizontal shake (0.25 s).
- `prefers-reduced-motion: reduce` → no shake, no thump, instant switches.

---

## 8. Accessibility checklist

- [ ] Every input has a visible `<label>`; Urdu labels are decorative extras, not the only label.
- [ ] Errors use colour + ⚠ icon + text, never colour alone.
- [ ] Focus order: tabs → email → password → (confirm) → show/hide → button → switch link → back link.
- [ ] Submit with Enter works in both modes.
- [ ] Contrast: ink on paper and paper on ink both pass WCAG AA.
- [ ] Page `<title>`: "Log in · Wattly" / "Create account · Wattly".

---

## 9. Implementation notes

- Keep the existing `app/login/page.js`; restyle it to this design. Read `mode` from `searchParams`.
- Suggested pieces:
  ```
  app/login/page.js               # layout: header, tabs, slip, bill panel
  components/auth/AuthTabs.js
  components/auth/AuthForm.js     # client: fields, validation, Supabase calls, states
  components/auth/BillPanel.js    # decorative right panel
  components/auth/Stamp.js        # reusable stamp (also usable on landing)
  ```
- Auth calls stay in the browser with `lib/supabase/client.js` (anon key only): `signInWithPassword` and `signUp`.
- Tokens and fonts come from the same `app/globals.css` / `next/font` setup as the landing page.