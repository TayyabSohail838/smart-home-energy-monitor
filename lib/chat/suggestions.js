import { chat } from "@/lib/chat/gemini";

// Overview "AI suggestions" box: three short tips written by the same Gemini engine and
// tools as the chatbot (numbers only from this home's data). Cached per device for 30
// minutes so the free Gemini quota isn't spent on every page load; a manual refresh is
// allowed once the cached tips are 2 minutes old.
const CACHE_MS = 30 * 60 * 1000;
const MIN_REFRESH_MS = 2 * 60 * 1000;
const cache = new Map(); // deviceId -> { at, suggestions, tools_used }

const PROMPT = `Give exactly 3 short suggestions to save electricity and money in this home right now.
First look at the data: call get_summary, get_peak_hours and get_forecast (months 1); add get_live_power if useful.
Rules for the answer:
- Exactly 3 lines, each starting with "- ", no intro and no closing line.
- Each line at most 22 words, in English, practical and specific to this home.
- Each line includes at least one real number from the tools (units, Rs, an hour, °C, or W).
- Round like a bill: "12 units" not "12.38 units", "1,770 W" not "1,769.7 W", "Rs 20,121" not
  "Rs 20,120.94" (only per-unit rates keep decimals: "Rs 33.10 per unit").
- Write numbers the way people read a bill: whole units and watts ("12 units", "1,770 W"), Rs with commas,
  12-hour times ("3 pm", "1-4 pm"), and slabs by their unit range ("the 201-300 slab"), never "slab 3".
- units_to_next_slab is how many MORE units can be used this month before the next, dearer slab starts
  ("only 12 units left before the 201-300 slab"), not units to save.
- Start each line with a 2-4 word bold title, e.g. "- **Shift the iron**: ...".`;

// Safety net for numbers the model leaves raw: whole units/kWh/watts and whole rupees for
// amounts of Rs 100 or more ("12.38 units" -> "12 units", "Rs 20,120.94" -> "Rs 20,121").
// Per-unit rates ("Rs 33.10") and temperatures keep their decimals.
const num = (s) => Number(s.replace(/,/g, ""));
const whole = (n) => Math.round(n).toLocaleString("en-US");
function tidy(text) {
  return text
    .replace(/(\d[\d,]*\.\d+)(\s*)(units?|kWh|W)\b/g, (_, n, sp, unit) => `${whole(num(n))}${sp}${unit}`)
    .replace(/Rs\.?\s*(\d[\d,]*\.\d+)/g, (m, n) => (num(n) >= 100 ? `Rs ${whole(num(n))}` : m));
}

function parse(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, ""))
    .map((l) => {
      const m = l.match(/^\*\*(.+?)\*\*[:\s-–]*(.*)$/);
      return m ? { title: m[1].replace(/:$/, ""), text: tidy(m[2]) } : { title: null, text: tidy(l) };
    })
    .slice(0, 3);
}

export async function getSuggestions(ctx, { refresh = false } = {}) {
  const hit = cache.get(ctx.deviceId);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && (age < (refresh ? MIN_REFRESH_MS : CACHE_MS))) return { ...hit, cached: true };

  const { text, tools_used } = await chat([{ role: "user", text: PROMPT }], ctx);
  const suggestions = parse(text);
  if (suggestions.length === 0) throw new Error(`suggestions: could not parse reply: ${text.slice(0, 120)}`);

  const entry = { at: Date.now(), suggestions, tools_used };
  cache.set(ctx.deviceId, entry);
  return { ...entry, cached: false };
}
