# design.md: Wattly Landing Page

Landing page for **Wattly** (Smart Home Energy Monitor). Audience: hackathon judges, but it must look and read like a real product for Pakistani homeowners. Goal: prove we built an end-to-end product (device → cloud → dashboard → alerts).

**Concept: "The electric bill, reimagined."** The page borrows the look of a WAPDA/FESCO bill: printed numbers, dotted rules, boxed panels, ink stamps, a tear-off slip. It should feel distinctive, not like a template site.

---

## 1. Design decisions (locked)

| Decision | Choice |
| --- | --- |
| Product name | **Wattly** |
| Visual direction | Electric bill reimagined: big bold type, bill layout |
| Language | English, with a few Urdu words on bill-style labels |
| Hero data | Animated **sample** bill (fake data, no API call) |
| Sections | Hero → How it works → Features → Dashboard preview → Tear-off CTA + footer |

---

## 2. Design tokens

### Colours

Bill colours on top of the dashboard's existing palette, so landing → app feels like one product.

```css
:root {
  --paper:        #F6F1E7;  /* bill paper background */
  --paper-dark:   #ECE4D3;  /* boxed panels, table header rows */
  --ink:          #1B1A17;  /* main text, heavy headings */
  --ink-soft:     #5C574D;  /* secondary text */
  --rule:         #B9AF9C;  /* dotted / dashed lines */
  --usage-blue:   #2a78d6;  /* same as dashboard usage colour */
  --ac-orange:    #eb6834;  /* same as dashboard AC/temperature colour */
  --stamp-red:    #C8302C;  /* ink stamps, warnings */
  --ok-green:     #2E7D4F;  /* "within slab" states */
}
```

Rules:
- The page is **light**; no dark hero. Paper is the base, ink is the voice.
- Red is only for stamps and warnings. Never use colour alone for meaning: pair with an icon or label (same rule as the dashboard).

### Typography

No generic fonts (no Inter, Roboto, Poppins, Montserrat). All from Google Fonts via `next/font/google` (built into Next.js, no new dependency).

| Role | Font | Use |
| --- | --- | --- |
| Display / headings | **Big Shoulders Display** (800–900) | Headline, section titles. Condensed, heavy, poster-like |
| Numbers / bill text | **Martian Mono** (400–700) | Units, rupees, reference numbers, table cells, slip details |
| Body | **Instrument Sans** (400–600) | Paragraphs, feature descriptions |
| Urdu labels | **Noto Nastaliq Urdu** (400–700) | The few Urdu words only |

Scale (desktop → mobile):
- Hero headline: 96px → 52px, line-height 0.95, uppercase optional
- Section title: 56px → 36px
- Big bill numbers: 64px → 40px (Martian Mono, tabular figures)
- Body: 18px → 16px

Urdu text: always `lang="ur" dir="rtl"`, slightly larger (≈1.15×) than the English beside it.

### Texture and details

- Background: `--paper` with a very faint noise/grain (inline SVG or CSS gradient; no image download).
- Dotted rules: `border-top: 2px dotted var(--rule)` between rows and sections.
- Boxed panels: 1.5px solid `--ink` border, small radius (4px), `--paper-dark` header strip.
- Stamps: rotated −6° to −10°, double border in `--stamp-red`, uppercase Martian Mono, slightly faded (opacity ~0.85).

### Urdu words used (only these)

| Urdu | Meaning | Where |
| --- | --- | --- |
| بجلی کا بل | Electricity bill | Hero header strip |
| یونٹس | Units | Hero bill card, Peak Hours box |
| سلیب | Slab | Slab Guard box |
| انتباہ | Warning | Spike Alerts box |
| موسم | Weather | Weather Forecast box |
| رسید | Receipt / slip | Tear-off slip |

---

## 3. Sections

### 3.1 Hero: the giant bill

Layout: two columns on desktop (headline left, bill card right); stacked on mobile (headline, then card).

**Top strip (header)**, styled like a utility company header:
- Left: **Wattly** logo (Big Shoulders, heavy) + Urdu label `بجلی کا بل`.
- Right: `Log in` (text link) and `Get started` (solid ink button).
- Bottom border: thick ink line + thin dotted line under it, like a bill header.

**Left column**
- Headline: **"Know your bill before it knows you."**
- Sub-line: *"Wattly clips onto your main wire, tracks every unit live, and warns you before you cross into the next slab."*
- Buttons: `Get started` (primary) + `See how it works` (scrolls to 3.2).

**Right column: animated bill card**
- Top strip: `REF NO. WTLY-2610-0457 · FESCO · Residential` in small mono.
- Rows (dotted rules between):
  - `Units consumed` / `یونٹس` → counts up 0 → **287**
  - `Current slab` → **201–300**
  - Slab bar: fills left to right, turns from blue to orange as it nears 300, label **"13 units to next slab"**
  - `Projected bill` → counts up to **Rs 14,820**
- Red ink stamp lands last, rotated: **"PROJECTED"** (or **"ESTIMATE"**).
- Tiny footnote: *"Sample data. Energy charge only, excludes taxes."* (matches the real API's `excludes_taxes`).

**Animation order** (on load, total ≈ 2.2 s):
1. Card fades and slides up (0.4 s)
2. Units count up (1.0 s)
3. Slab bar fills (0.6 s, overlaps)
4. Projected bill counts up (0.6 s)
5. Stamp "thumps" in: scale 1.4 → 1, rotate, slight overshoot (0.25 s)

### 3.2 How it works: itemised charges

Heading: **"How it works"** · small mono caption *"Itemised charges"*.

Styled as the charges table of a bill: header row in `--paper-dark`, dotted rules between rows, mono numbers, right-aligned last column.

| # | Item | Charge |
| --- | --- | --- |
| 01 | **Clip the sensor.** The SCT-013 clamp goes around your main wire. No rewiring. | *2 min* |
| 02 | **ESP32 sends readings.** Every 10 seconds, over your Wi-Fi. | *Every 10 s* |
| 03 | **Cloud crunches it.** Units, slab, spikes, weather forecast. | *Instant* |
| 04 | **You see it live.** Dashboard, plus email alerts before you cross a slab. | *Rs 0 surprise* |

- Total row (double rule above, bold): **"Total effort: one clip-on."**
- Small line illustrations beside the table: clamp + ESP32, and a dashboard thumbnail.
- On mobile: the table becomes stacked rows (number + item on top, charge below, right-aligned).

### 3.3 Features: bill side-panels

Heading: **"What Wattly watches for you"**.

A 2×2 grid (1 column on mobile) of boxed panels, like the side boxes on a FESCO bill. Each box: ink border, `--paper-dark` header strip with the feature name, Urdu label in the top-right corner, a mini visual, one line of copy.

| Box | Urdu label | Mini visual | Copy |
| --- | --- | --- | --- |
| **Slab Guard** | سلیب | Slab bar with a red "WARNING" stamp | "We email you before you cross into the next slab, not after." |
| **Spike Alerts** | انتباہ | Power line with one spike circled in red | "Iron left on? AC running all night? You'll know." |
| **Peak Hours** | یونٹس | 24 tiny bars, top 3 in orange | "See exactly when your home burns the most units." |
| **Weather Forecast** | موسم | Sun icon + upward arrow + "Rs ↑" | "Heatwave coming? We predict next month's units and bill." |

Scroll animation: each box "stamps" into place (scale 1.06 → 1, rotate ±1.5° → 0°), staggered 80 ms.

### 3.4 Dashboard preview: proof it exists

Heading: **"Your bill, live. Not once a month."**

- Background switches to the dashboard's **light glass** style (soft white, frosted cards): the visual bridge from paper bill to the app.
- Centre: real screenshot of the Overview page inside a laptop frame, tilted slightly (perspective, ~6°).
- Overlapping bottom-right: a phone frame showing a slab-warning alert email.
- Three callouts with hand-drawn style arrows (inline SVG), text in mono:
  - "Live watts" → live power panel
  - "Slab meter" → slab meter
  - "This month so far" → bill card
- Caption under it: *"Real dashboard. Real device. Built in 24 hours."*

Assets: `public/landing/dashboard.png` (Overview screenshot, seeded data), `public/landing/alert-email.png`. Take screenshots after `npm run seed`.

### 3.5 Tear-off slip: final CTA + footer

- Full-width dashed line (`3px dashed var(--rule)`) with a small scissors icon at the left: **"cut here"** in tiny mono.
- Below it, a slip card (ink border, `--paper` background), two halves like a bank copy:
  - Left: **"Stop paying for surprises."** + `Get started` (large primary) + `Log in` (link).
  - Right, mono details:
    ```
    CUSTOMER        You
    DUE DATE        Never late again
    AMOUNT PAYABLE  Less than last month
    ```
  - Urdu label `رسید` in the slip corner, and a faint "PAID" stamp.
- Footer (simple, ink on paper): Wattly logo · "Built at [hackathon name] by Inovix & Co" · GitHub · Team.

---

## 4. Motion rules

- CSS-only animations (same rule as the dashboard; no animation library).
- Count-up numbers: a tiny client component using `requestAnimationFrame` (no library), or CSS `@property` counters.
- Scroll-triggered effects: one small `IntersectionObserver` hook that adds a class; the animation itself is CSS.
- `prefers-reduced-motion: reduce` → no motion; show final numbers and stamps immediately.
- Nothing loops forever except an optional subtle pulse on the hero "live" dot.

---

## 5. Responsive

- Breakpoints follow Tailwind defaults (`md` 768px, `lg` 1024px).
- 16px side gutters on mobile, no horizontal scroll.
- Hero: stacked, bill card full width under the headline.
- Charges table: stacked rows on mobile.
- Features: 1 column → 2 columns from `md`.
- Dashboard preview: no tilt on mobile; phone frame moves below the laptop.
- Slip: two halves stack on mobile.

---

## 6. Implementation notes

- **Route conflict:** `app/(dashboard)/page.js` currently serves `/`. The landing page needs `/`, so move the Overview to `/dashboard` (`app/(dashboard)/dashboard/page.js`) and update sidebar links and post-login redirects.
- **Public page:** update `proxy.js` so `/` is not redirected to `/login`. Optionally redirect logged-in users from `/` to `/dashboard`.
- Files:
  ```
  app/page.js                    # landing page (server component)
  components/landing/Hero.js
  components/landing/BillCard.js # client: count-up + stamp
  components/landing/HowItWorks.js
  components/landing/Features.js
  components/landing/Preview.js
  components/landing/Slip.js
  components/landing/useInView.js
  ```
- Fonts loaded once in the landing page (or root layout) with `next/font/google`; expose as CSS variables (`--font-display`, `--font-mono`, `--font-body`, `--font-urdu`).
- Tokens go in `app/globals.css` (Tailwind v4 `@theme`), next to the existing dashboard tokens.
- No API calls on the landing page; all hero numbers are hard-coded sample data.
- Buttons: `Get started` → `/login?mode=signup`, `Log in` → `/login`.

---

## 7. Copy checklist

- [ ] Headline: "Know your bill before it knows you."
- [ ] Hero sub-line
- [ ] Charges table (4 rows + total)
- [ ] 4 feature lines
- [ ] Preview heading + caption
- [ ] Slip text + footer (fill in hackathon name)
- [ ] "Sample data. Energy charge only, excludes taxes." footnote